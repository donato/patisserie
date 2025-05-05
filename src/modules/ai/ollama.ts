import { ChatResponse, GenerateResponse, Ollama, Message as OllamaMessage, Tool, ToolCall } from 'ollama'
import { streamChatOutput, streamGenerateOutput } from './stream-utils'
import { Models, BASE_MODELS, MODEL_TEMPERATURE, SYSTEM_PROMPTS } from './prompts';
import { executeToolCalls, createToolPrompt, triggerToolCall, getToolDefinitions } from './tools';

export const INFO_PREFIX = '[info]';

function generate(ollama: Ollama, model: Models, prompt: string) {
  console.log('------------------------------------');
  console.log(`ollama.generate [${model}]`);
  console.log(prompt);
  console.log('------------------------------------');
  return ollama.generate({
    model: BASE_MODELS[model],
    system: SYSTEM_PROMPTS[model],
    prompt: prompt,
    options: {
      temperature: MODEL_TEMPERATURE[model],
      stop: ['Observation:'],
    },
    stream: false,
    keep_alive: '1h'
    // the type casting can be removed when bug is fixed https://github.com/ollama/ollama-js/issues/135
  }) as unknown as Promise<GenerateResponse>;
}

function chat(ollama: Ollama, model: Models, msgs: OllamaMessage[]) {
  console.log(`ollama.chat [${model}]`);
  msgs.unshift({
    role: 'system',
    content: SYSTEM_PROMPTS[model]
  });
  let tools = getToolDefinitions();
  if (model == Models.DEEP_SEEK) {
    tools = [];
  }
  return ollama.chat({
    model: BASE_MODELS[model],
    messages: msgs,
    options: {
      temperature: MODEL_TEMPERATURE[model]
    },
    tools,
    stream: true,
    keep_alive: '1h',
    // the type casting can be removed when bug is fixed https://github.com/ollama/ollama-js/issues/135
  }) as unknown as Promise<AsyncIterableIterator<ChatResponse>>;
}

async function isModelActive(ollama: Ollama, model: Models) {
  const runningModels = await ollama.ps();
  return runningModels.models.some(
    m => m.name == BASE_MODELS[model]);
}

async function* initialize(ollama: Ollama, model: Models) {
  try {
    if (await isModelActive(ollama, model)) {
      return;
    }
  } catch (e) {
    throw new Error("Unable to connect to TenStep Gaming PC");
  }

  let isActive = false;
  let retries = 0;
  while (!isActive && retries < 3) {
    yield `${INFO_PREFIX} Attempting to boot ${BASE_MODELS[model]}`;
    generate(ollama, model, 'test');

    await new Promise(resolve => setTimeout(resolve, 2000));

    isActive = await isModelActive(ollama, model);
    retries++;
  }
  if (isActive) {
    yield `${INFO_PREFIX} Model ${BASE_MODELS[model]} running!`;
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

function parseAgentResponse(stream: GenerateResponse): ToolCall | string {
  const c = stream.response;
  const lines = c.split('\n').filter(l => l != '');
  const finalLine = lines[lines.length - 1];
  if (finalLine && finalLine.includes('Action:')) {
    try {
      const json = JSON.parse(finalLine.split('Action: ')[1]);
      const toolCall: ToolCall = {
        function: {
          name: json['function_name'],
          arguments: json['arguments']
        }
      };
      return toolCall
    } catch (e) {
      console.log(c);
      console.log(e);
      return 'Error';
    }
  } else if (finalLine && finalLine.includes('Final Answer')) {
    return finalLine.split('Final Answer: ')[1];
  } else {
    console.log('No action found, exiting');
    return 'Unexpected result: ' + c;
  }
}

export class AiModule {
  private readonly ollama: Ollama;

  constructor() {
    // todo(): Add a queue and/or lock
    this.ollama = new Ollama({ host: 'http://192.168.2.132:11434' })
  }

  async *generate(prompt: string, model: Models): AsyncIterableIterator<string> {
    try {
      // TODO - think of better way to avoid adding the tools many times with recursion
      if (model == Models.AGENT && !prompt.includes('Available Tools:')) {
        // prompt = `${prompt}\n\n\n${createToolPrompt(getToolDefinitions())}`;
        prompt = `${createToolPrompt(getToolDefinitions())}Question: ${prompt}\n`;
      }
      yield* initialize(this.ollama, model);
      while (true) {
        const response = await generate(this.ollama, model, prompt);

        const result = parseAgentResponse(response)
        if (typeof result == "string") {
          yield result;
          return;
        } else {
          const toolResults = await triggerToolCall(result);
          prompt += response.response + `Observation: ${toolResults}\n`;
        }
      }
    } catch (e) {
      yield* handleError(e);
    }
  }

  async *chat(msgs: OllamaMessage[], model: Models): AsyncIterable<string> {
    if (!msgs.length) { return; }

    async function* handleToolCalls(module: AiModule, stream: AsyncIterableIterator<ChatResponse>) {
      for await (const s of stream) {
        if (s.message.tool_calls && s.message.tool_calls.length) {
          const toolResults = await executeToolCalls(s.message.tool_calls);
          // handle tool stuff
          msgs.push(s.message);
          toolResults.forEach(r => {
            msgs.push({
              role: 'tool',
              content: r
            });
          });
          yield* module.chat(msgs, model);
          break;
        } else {
          yield s;
        }
      }
    }
    try {
      yield* initialize(this.ollama, model);
      const stream = await chat(this.ollama, model, msgs);
      const finalStream = handleToolCalls(this, stream);
      // the will have tool messages and string messages
      yield* streamChatOutput(finalStream);
    } catch (e) {
      yield* handleError(e);
    }
  }
}
