import { ChatResponse, GenerateResponse, Ollama, Message as OllamaMessage, Tool, ToolCall } from 'ollama'
import { streamForChat, transformAsyncIterator } from './stream-utils'
import { createAgentFactory, AgentFactory, Agent, AgentType, useManualToolCalling, useNativeToolCalling } from './agents';
import { executeToolCalls, createToolPrompt, triggerToolCall } from './tools';
import { executePython } from './tools-python-interpreter';

const OLLAMA_HOST = 'http://192.168.1.132:11434'
export const INFO_PREFIX = '[info]';

// Somewhat arbitrary, but the default value was insanely low
const CONTEXT_LENGTH = 16000;
const MAX_ITERATIONS = 10;

function generate(ollama: Ollama, agent: Agent, prompt: string) {
  console.log('------------------------------------');
  console.log(`ollama.generate [${agent}]`);
  console.log(prompt);
  console.log('------------------------------------');
  return ollama.generate({
    model: agent.model_id,
    system: agent.system_prompt,
    prompt: prompt,
    options: {
      num_ctx: CONTEXT_LENGTH,
      temperature: agent.temperature,
      stop: ['Observation:'],
    },
    stream: false,
    keep_alive: '1h'
    // the type casting can be removed when bug is fixed https://github.com/ollama/ollama-js/issues/135
  }) as unknown as Promise<GenerateResponse>;
}

function chat(ollama: Ollama, agent: Agent, msgs: OllamaMessage[]) {
  const tools = useNativeToolCalling(agent) ? agent.tools : [];

  console.log('------------------------------------');
  console.log(`ollama.chat [${agent}]`);
  console.log(msgs);
  console.log('------------------------------------');
  return ollama.chat({
    model: agent.model_id,
    messages: msgs,
    options: {
      num_ctx: CONTEXT_LENGTH,
      temperature: agent.temperature,
      stop: ['Observation:'],
    },
    tools,
    stream: true,
    keep_alive: '1h',
    // the type casting can be removed when bug is fixed https://github.com/ollama/ollama-js/issues/135
  }) as unknown as Promise<AsyncIterableIterator<ChatResponse>>;
}

async function isModelActive(ollama: Ollama, agent: Agent) {
  const runningModels = await ollama.ps();
  return runningModels.models.some(
    m => m.name == agent.model_id);
}

async function* initialize(ollama: Ollama, agent: Agent): AsyncIterable<MyChatResponse> {
  try {
    if (await isModelActive(ollama, agent)) {
      return;
    }
  } catch (e) {
    console.log(e);
    throw new Error("Unable to connect to TenStep Gaming PC");
  }

  let isActive = false;
  let retries = 0;
  while (!isActive && retries < 3) {
    yield info(`Attempting to boot ${agent}`);
    generate(ollama, agent, 'test');

    await new Promise(resolve => setTimeout(resolve, 2000));

    isActive = await isModelActive(ollama, agent);
    retries++;
  }
  if (isActive) {
    yield info(`Model ${agent} running!`);
  } else {
    yield info(`Stopping retrying.`);
  }
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

interface MyChatResponse {
  type: 'info' | 'text' | 'result'
  content: string
}

function info(content: string): MyChatResponse {
  const f = content.split('\n').map(line =>  `${INFO_PREFIX} ${line}`);
  return {
    type: 'info',
    content: f.join('\n')
  }
}

function text(content: string) : MyChatResponse {
  return {
    type: 'text',
    content
  }
}

export class AiModule {
  constructor(private readonly ollama: Ollama, private readonly agentFactory: AgentFactory) {
    // todo(): Add a queue and/or lock
  }

  private async *generateInternal(prompt: string, agentType: AgentType): AsyncIterableIterator<MyChatResponse> {
    const agent = this.agentFactory.create(agentType);
    try {
      // Note: Native tool calling is not supported by Ollama for generate APIs.
      if (useManualToolCalling(agent)) {
        prompt = `${createToolPrompt(agent.tools)}Question: ${prompt}\n`;
      }
      yield* initialize(this.ollama, agent);
      let iterations = 0;
      while (iterations++ < MAX_ITERATIONS) {
        const generateResponse = await generate(this.ollama, agent, prompt);
        const response = generateResponse.response;

        // This will yield thoughts and actions as well
        yield info(response);
        const lines = response.split('\n').filter(l => l != '');
        const finalLine = lines[lines.length - 1];

        if (finalLine.indexOf('Final Answer:') == 0) {
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
          prompt += generateResponse.response + `Observation: ${toolResults}\n`;
        } else {
          return;
        }
      }
    } catch (e) {
      yield* handleError(e);
    }
  }

  private async *chatInternal(msgs: OllamaMessage[], agentType: AgentType): AsyncIterable<MyChatResponse> {
    const agent = this.agentFactory.create(agentType);
    this.ollama.abort();
    if (!msgs.length) { return; }

    async function* iterateThroughStreamWithNormalFunctionCalling(ollama: Ollama): AsyncIterable<MyChatResponse> {
      let iterations = 0;
      while (true && iterations++ < MAX_ITERATIONS) {
        const stream = await chat(ollama, agent, msgs);
        let receivedFunctionCall = false;
        for await (const s of stream) {
          yield text(s.message.content);
          if (s.message.tool_calls && s.message.tool_calls.length) {
            receivedFunctionCall = true;
            console.log(`++ [ Function Call : ${JSON.stringify(s.message.tool_calls)}] ++`);
            const toolResults = await executeToolCalls(s.message.tool_calls);
            msgs.push(s.message);
            toolResults.forEach(r => {
              msgs.push({
                role: 'tool',
                content: r
              });
            });
          }
          if (s.done && !receivedFunctionCall) {
            return;
          }
        }
      }
    }

    async function* iterateThroughStreamManualParsing(ollama: Ollama): AsyncIterable<MyChatResponse> {
      let iterations = 0;
      while (iterations++ < MAX_ITERATIONS) {
        const s1 = await chat(ollama, agent, msgs);
        const s2 = await transformAsyncIterator(s1, (i => i.message.content));

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
      yield* initialize(this.ollama, agent);
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

  async *chat(msgs: OllamaMessage[], agentType: AgentType): AsyncIterable<string> {
    const iterator = this.chatInternal(msgs, agentType);
    for await (const output of iterator) {
      yield output.content;
    }
  }

  async *chatItalian(msgs: OllamaMessage[]) : AsyncIterable<string> {
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

export async function createAiModule(): Promise<AiModule> {
  const agentFactory = await createAgentFactory();

  const ollama = new Ollama({ host: OLLAMA_HOST });
  return new AiModule(ollama, agentFactory);
}
