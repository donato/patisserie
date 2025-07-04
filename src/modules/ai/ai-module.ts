import { INFO_PREFIX, MAX_ITERATIONS, AgentResponse, info, text} from './common';
import { transformAsyncIterator } from './stream-utils'
import { createAgentFactory, AgentFactory, Agent, AgentType, useManualToolCalling, useNativeToolCalling } from './agents';
import { executeToolCalls, createToolPrompt, triggerToolCall } from './tools';
import { executePython } from './tools-python-interpreter';
import { ProviderOllama } from './provider-ollama';
import { ToolCall, ChatMessage, Provider } from './provider';
import { ProviderOpenaAi } from './provider-openai';
import * as pg from 'pg';


function *init(provider: Provider, agent:Agent) {
  return transformAsyncIterator(provider.initialize(agent), (item:string) => {
    return info(item);
  });
}

function* handleError(e: unknown) {
  console.log(e);
  if (e instanceof Error) {
    yield info(`Error: ${e.message.toString()}`);
  } else {
    yield info(`Unknown error, check logs`);
  }
}

// ChatGPT code...
function extractLastMarkdownCode(markdown: string): string | null {
  const codeMatches: string[] = [];

  // Match all fenced code blocks
  const fencedBlockRegex = /```(?:\w*\n)?([\s\S]*?)```/g;
  let match;
  while ((match = fencedBlockRegex.exec(markdown)) !== null) {
    codeMatches.push(match[1].trim());
  }

  return codeMatches.length > 0 ? codeMatches[codeMatches.length - 1] : null;
}

interface PythonToolCall {
  code: string
}

function isPythonToolCall(o: PythonToolCall | ToolCall): o is PythonToolCall {
  return typeof (o as PythonToolCall).code == 'string';
}

function extractToolCall(text: string): ToolCall | PythonToolCall | null {
  if (text && text.includes('Action:')) {
    try {
      const json = JSON.parse(text.split('Action: ')[1]);
      const toolCall: ToolCall = {
        function: {
          name: json['function_name'],
          arguments: json['arguments']
        }
      };
      return toolCall;
    } catch (e) {
      console.log(text);
      console.log(e);
    }
  } else if (text && text.includes('Code:')) {

    const pyText = extractLastMarkdownCode(text);
    if (pyText) {
      return {
        code: pyText
      }
    }
  }
  return null;
}


export class AiModule {
  constructor(private readonly pgClient : pg.Client, private readonly ollama: Provider, private readonly agentFactory: AgentFactory) {
    // todo(): Add a queue and/or lock
  }

  private async *generateInternal(prompt: string, agentType: AgentType): AsyncIterableIterator<AgentResponse> {
    const agent = this.agentFactory.create(agentType);
    yield* this.generateFromAgent(prompt, agent);
  }

  async *generateFromAgent(prompt: string, agent: Agent) {
    try {
      prompt = agent.prefillText + prompt;
      // Note: Native tool calling is not supported by Ollama for generate APIs.
      if (useManualToolCalling(agent)) {
        prompt = `${createToolPrompt(agent.tools)} ${prompt}\n`;
      }
      yield* init(this.ollama, agent);
      let iterations = 0;
      while (iterations++ < MAX_ITERATIONS) {
        const generateResponse = await this.ollama.generate(agent, prompt);
        const response = generateResponse.content;

        // This will yield thoughts and actions as well.
        yield text(response);
        const lines = response.split('\n').filter(l => l != '');
        const finalLine = lines[lines.length - 1];

        // TODO - final answer stuff should be isolated to REACT agent 
        if (finalLine && finalLine.indexOf('Final Answer:') == 0) {
          yield text(finalLine.split('Final Answer:')[1]);
          return;
        }
        const toolCall = extractToolCall(finalLine)
        if (toolCall) {
          let toolResults;
          if (isPythonToolCall(toolCall)) {
            toolResults = await executePython(toolCall.code);
          } else {
            toolResults = await triggerToolCall(toolCall);
          }
          yield info(`Observation: ${toolResults}\n`);
          prompt += generateResponse.content + `Observation: ${toolResults}\n`;
        } else {
          return;
        }
      }
    } catch (e) {
      yield* handleError(e);
    }
  }

  private async *chatInternal(msgs: ChatMessage[], agentType: AgentType): AsyncIterable<AgentResponse> {
    const agent = this.agentFactory.create(agentType);
    this.ollama.abort();
    if (!msgs.length) { return; }

    async function* iterateThroughStreamWithNormalFunctionCalling(ollama: Provider): AsyncIterable<AgentResponse> {
      let iterations = 0;
      while (true && iterations++ < MAX_ITERATIONS) {
        const stream = await ollama.chat(agent, msgs);
        let receivedFunctionCall = false;
        for await (const message of stream) {
          yield text(message.content);
          if (message.role == 'tool' && message.tool_calls && message.tool_calls.length) {
            receivedFunctionCall = true;
            console.log(`++ [ Function Call : ${JSON.stringify(message.tool_calls)}] ++`);
            const toolResults = await executeToolCalls(message.tool_calls);
            
            msgs.push(message);
            toolResults.forEach(r => {
              msgs.push({
                role: 'tool',
                tool_calls: [],
                tool_call_id: message.tool_call_id,
                content: r
              });
            });
          }
        }
        if (!receivedFunctionCall) {
          return;
        }
      }
    }

    async function* iterateThroughStreamManualParsing(ollama: Provider): AsyncIterable<AgentResponse> {
      let iterations = 0;
      while (iterations++ < MAX_ITERATIONS) {
        const s1 = await ollama.chat(agent, msgs);
        const s2 = await transformAsyncIterator(s1, (i => i.content));

        let sBuilder = '';
        for await (const str of s2) {
          sBuilder += str;
          yield text(str);
        }

        const toolCall = extractToolCall(sBuilder)
        if (toolCall) {
          console.log(`++ [ Function Call : ${JSON.stringify(toolCall)}] ++`);
          let toolResults;
          if (isPythonToolCall(toolCall)) {
            toolResults = await executePython(toolCall.code);
          } else {
            toolResults = await triggerToolCall(toolCall);
          }
          console.log(`++ [ Function Results : ${toolResults}] ++`);
          const observation = `Observation: ${toolResults}\n`;
          yield text(observation);
          sBuilder += observation;
        } else {
          // If it was not 'stop'ed on an Action, then stop looping
          return;
        }
        // With manual parsing we have to keep editing the Assistant message, to iteratively generate it.
        msgs[msgs.length - 1].content += sBuilder;
      }
    }

    let system_prompt = agent.system_prompt;
    if (useManualToolCalling(agent)) {
      system_prompt += `\n\n\n${createToolPrompt(agent.tools)}`;
    }

    msgs.unshift({
      role: 'system',
      content: system_prompt,
    });

    msgs.push({
      role: 'assistant',
      content: agent.prefillText
    })

    try {
      yield* init(this.ollama, agent);
      if (useNativeToolCalling(agent)) {
        yield* iterateThroughStreamWithNormalFunctionCalling(this.ollama);
      } else {
        yield* iterateThroughStreamManualParsing(this.ollama);
      }
    } catch (e) {
      yield* handleError(e);
    }
  }

  async *generate(prompt: string, agentType: AgentType): AsyncIterable<string> {
    const iterator = this.generateInternal(prompt, agentType);
    for await (const output of iterator) {
      yield output.content;
    }
  }

  async *chat(msgs: ChatMessage[], agentType: AgentType): AsyncIterable<string> {
    const iterator = this.chatInternal(msgs, agentType);
    for await (const output of iterator) {
      yield output.content;
    }
  }

  async *chatItalian(msgs: ChatMessage[]) : AsyncIterable<string> {
    let iterator;

    // First review for natural/idiomatic phrasing
    iterator = this.generateInternal(msgs[msgs.length-1].content, AgentType.ITALIA_IDIOMATIC);
    for await (const output of iterator) {
      if (output.type == 'text') {
        if (output.content.includes('No Suggestions')) {
          console.log(output.content);
          continue;
        } else {
          yield output.content;
          return;
        }
      }
    }

    // Now continue the conversation
    iterator = this.chatInternal(msgs, AgentType.ITALIA_CONVERSATIONAL);
    let sb = '';
    for await (const output of iterator) {
      yield output.content;
      if (output.type == 'text') {
        sb += output.content;
      }
    }
    
    // double linebreak to cause discord to render [INFO] messages in a separate
    // chat message - which makes it easier to extract conversation from the
    // channel.
    yield '\n\n'; 

    // Now translate any confusing phrases, to make it easier to continue
    iterator = this.generateInternal(sb, AgentType.ITALIA_TRANSLATE_PHRASES);
    for await (const output of iterator) {
      if (output.type == 'text') {
        yield `${INFO_PREFIX} ${output.content}`;
      }
    }
  }
}

export async function createAiModule(pgClient:pg.Client): Promise<AiModule> {
  const agentFactory = await createAgentFactory();

  const unused = new ProviderOllama();
  return new AiModule(pgClient, new ProviderOpenaAi(), agentFactory);
}
