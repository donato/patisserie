  import fs from 'fs'
import YAML from 'yaml'
import { ChatResponse, GenerateResponse, Ollama, Message as OllamaMessage, Tool, ToolCall } from 'ollama'
import { batchByNewlines, streamOutput, transformAsyncIterator } from './stream-utils'
import { AgentFactory, Agent, AgentType, useManualToolCalling, useNativeToolCalling} from './agents';
import { executeToolCalls, createToolPrompt, triggerToolCall, getToolDefinitions } from './tools';
import { executePython } from './tools-python-interpreter';

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
  const tools = useNativeToolCalling(agent) ? getToolDefinitions() : [];

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

async function* initialize(ollama: Ollama, agent: Agent) {
  try {
    if (await isModelActive(ollama, agent)) {
      return;
    }
  } catch (e) {
    throw new Error("Unable to connect to TenStep Gaming PC");
  }

  let isActive = false;
  let retries = 0;
  while (!isActive && retries < 3) {
    yield `${INFO_PREFIX} Attempting to boot ${agent}`;
    generate(ollama, agent, 'test');

    await new Promise(resolve => setTimeout(resolve, 2000));

    isActive = await isModelActive(ollama, agent);
    retries++;
  }
  if (isActive) {
    yield `${INFO_PREFIX} Model ${agent} running!`;
  } else {
    yield `${INFO_PREFIX} Stopping retrying.`;
  }
}

function* handleError(e: unknown) {
  console.log(e);
  if (e instanceof Error) {
    yield `${INFO_PREFIX} Error: ${e.message.toString()}`;
  } else {
    yield `${INFO_PREFIX} Unknown error, check logs`;
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
function isPythonToolCall(o : PythonToolCall | ToolCall): o is PythonToolCall {
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
  constructor(private readonly ollama: Ollama, private readonly agentFactory: AgentFactory) {
    // todo(): Add a queue and/or lock
  }

  async *generate(prompt: string, agentType: AgentType): AsyncIterableIterator<string> {
    const agent = this.agentFactory.create(agentType);
    try {
      // Note: Native tool calling is not supported by Ollama for generate APIs.
      if (useManualToolCalling(agent)) {
        prompt = `${createToolPrompt(getToolDefinitions())}Question: ${prompt}\n`;
      }
      yield* initialize(this.ollama, agent);
      let iterations = 0;
      while (iterations++ < MAX_ITERATIONS) {
        const generateResponse = await generate(this.ollama, agent, prompt);
        const response = generateResponse.response;

        // This will yield thoughts and actions as well
        yield response;
        const lines = response.split('\n').filter(l => l != '');
        const finalLine = lines[lines.length - 1];

        if (response.includes('Final Answer:')) {
          return;
        }
        const toolCall = extractToolCall(finalLine)
        if (toolCall && isPythonToolCall(toolCall)) {
          const toolResults = await executePython(toolCall.code);
          prompt += generateResponse.response + `Observation: ${toolResults}\n`;
        } else if (toolCall) {
          const toolResults = await triggerToolCall(toolCall);
          prompt += generateResponse.response + `Observation: ${toolResults}\n`;
        }
      }
    } catch (e) {
      yield* handleError(e);
    }
  }

  async *chat(msgs: OllamaMessage[], agentType: AgentType): AsyncIterable<string> {
    const agent = this.agentFactory.create(agentType);
    this.ollama.abort();
    if (!msgs.length) { return; }

    // helper function required to allow batching yields together for streamOutput()
    async function* iterateThroughStreamWithNormalFunctionCalling(ollama: Ollama) {
      let iterations = 0;
      while (true && iterations++ < MAX_ITERATIONS) {
        const stream = await chat(ollama, agent, msgs);
        let receivedFunctionCall = false;
        for await (const s of stream) {
          yield s.message.content;
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

    // helper function required to allow batching yields together for streamOutput()
    async function* iterateThroughStreamManualParsing(ollama: Ollama) {
      let iterations = 0;
      while (iterations++ < MAX_ITERATIONS) {
        const s1 = await chat(ollama, agent, msgs);
        const s2 = await transformAsyncIterator(s1, (i => i.message.content));
        
        let sBuilder = '';
        for await (const str of s2) {
          sBuilder += str;
          yield str;
        }

        const toolCall = extractToolCall(sBuilder)
        if (toolCall && isPythonToolCall(toolCall)) {
          const toolResults = await executePython(toolCall.code);
          const observation = `\nObservation: ${toolResults}\n`;
          yield observation;
          sBuilder += observation;
        } else if (toolCall) {
          console.log(`++ [ Function Call : ${JSON.stringify(toolCall)}] ++`);
          const toolResults = await triggerToolCall(toolCall);
          console.log(`++ [ Function Results : ${toolResults}] ++`);
          const observation = `Observation: ${toolResults}\n`;
          yield observation;
          sBuilder += observation;
        } else {
          // If it was not 'stop'ed on an Action, then stop looping
          return;
        }
        // The final message is the Assistant message that is initially prefilled, and then iteratively generated.
        msgs[msgs.length - 1].content += sBuilder;
      }
    }

    let system_prompt = agent.system_prompt;
    if (useManualToolCalling(agent)) {
      system_prompt += `\n\n\n${createToolPrompt(getToolDefinitions())}`;
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
        yield* streamOutput(iterateThroughStreamWithNormalFunctionCalling(this.ollama));
      } else {
        yield* streamOutput(iterateThroughStreamManualParsing(this.ollama));
      }
    } catch (e) {
      yield* handleError(e);
    }
  }
}

export async function createAiModule(): Promise<AiModule> {
  const allFiles = await Promise.all([
      fs.promises.readFile('./modules/ai/prompts/react_agent.yml', 'utf8'),
      fs.promises.readFile('./modules/ai/prompts/smolagents_code_agent.yml', 'utf8'),
      fs.promises.readFile('./modules/ai/prompts/italia_beginner.yml', 'utf8'),
      fs.promises.readFile('./modules/ai/prompts/italia_agent.yml', 'utf8'),
  ]);
  const [prompt_react, prompt_coding, prompt_italia_beginner, prompt_italia_conversational] = allFiles.map((f) => YAML.parse(f)).map(y => y.system_prompt);
  const af = new AgentFactory({
    prompt_coding, prompt_italia_beginner, prompt_italia_conversational, prompt_react
  })

  const ollama = new Ollama({ host: 'http://192.168.2.132:11434' });
  return new AiModule(ollama, af);
}