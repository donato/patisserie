import { ChatResponse, GenerateResponse, Ollama, Message as OllamaMessage, Tool, ToolCall } from 'ollama'
import { batchByNewlines, streamOutput, transformAsyncIterator } from './stream-utils'
import { Models, MODEL_INFO, isToolcalling } from './prompts';
import { executeToolCalls, createToolPrompt, triggerToolCall, getToolDefinitions } from './tools';

export const INFO_PREFIX = '[info]';
// Somewhat arbitrary, but the default value was insanely low
const CONTEXT_LENGTH = 16000;

function generate(ollama: Ollama, model: Models, prompt: string) {
  console.log('------------------------------------');
  console.log(`ollama.generate [${model}]`);
  console.log(prompt);
  console.log('------------------------------------');
  const { model_id, temperature, system_prompt } = MODEL_INFO[model];
  return ollama.generate({
    model: model_id,
    system: system_prompt,
    prompt: prompt,
    options: {
      num_ctx: CONTEXT_LENGTH,
      temperature,
      stop: ['Observation:'],
    },
    stream: false,
    keep_alive: '1h'
    // the type casting can be removed when bug is fixed https://github.com/ollama/ollama-js/issues/135
  }) as unknown as Promise<GenerateResponse>;
}

function chat(ollama: Ollama, model: Models, msgs: OllamaMessage[]) {
  let { model_id, temperature } = MODEL_INFO[model];
  const tools = isToolcalling(model) ? getToolDefinitions() : [];

  console.log('------------------------------------');
  console.log(`ollama.chat [${model}]`);
  console.log(msgs);
  console.log('------------------------------------');
  return ollama.chat({
    model: model_id,
    messages: msgs,
    options: {
      num_ctx: CONTEXT_LENGTH,
      temperature,
      stop: ['Observation:'],
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
    m => m.name == MODEL_INFO[model].model_id);
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
    yield `${INFO_PREFIX} Attempting to boot ${MODEL_INFO[model].model_id}`;
    generate(ollama, model, 'test');

    await new Promise(resolve => setTimeout(resolve, 2000));

    isActive = await isModelActive(ollama, model);
    retries++;
  }
  if (isActive) {
    yield `${INFO_PREFIX} Model ${MODEL_INFO[model].model_id} running!`;
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

function extractToolCall(line: string): ToolCall | null {
  if (line && line.includes('Action:')) {
    try {
      const json = JSON.parse(line.split('Action: ')[1]);
      const toolCall: ToolCall = {
        function: {
          name: json['function_name'],
          arguments: json['arguments']
        }
      };
      return toolCall;
    } catch (e) {
      console.log(line);
      console.log(e);
    }
  }
  return null;
}

export class AiModule {
  private readonly ollama: Ollama;

  constructor() {
    // todo(): Add a queue and/or lock
    this.ollama = new Ollama({ host: 'http://192.168.2.132:11434' })
  }

  async *generate(prompt: string, model: Models): AsyncIterableIterator<string> {
    try {
      if (model == Models.AGENT) {
        prompt = `${createToolPrompt(getToolDefinitions())}Question: ${prompt}\n`;
      }
      yield* initialize(this.ollama, model);
      let iterations = 0;
      while (iterations++ < 100) {
        const generateResponse = await generate(this.ollama, model, prompt);
        const response = generateResponse.response;

        // This will yield thoughts and actions as well
        yield response;
        const lines = response.split('\n').filter(l => l != '');
        const finalLine = lines[lines.length - 1];

        const result = extractToolCall(finalLine)
        if (response.includes('Final Answer:')) {
          return;
        }
        if (result) {
          const toolResults = await triggerToolCall(result);
          prompt += generateResponse.response + `Observation: ${toolResults}\n`;
        }
      }
    } catch (e) {
      yield* handleError(e);
    }
  }

  async *chat(msgs: OllamaMessage[], model: Models): AsyncIterable<string> {
    this.ollama.abort();
    if (!msgs.length) { return; }

    // helper function required to allow batching yields together for streamOutput()
    async function* iterateThroughStreamWithNormalFunctionCalling(ollama: Ollama) {
      let iterations = 0;
      while (true && iterations++ < 10) {
        const stream = await chat(ollama, model, msgs);
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
      let lastLine = '';
      while (iterations++ < 100) {
        const s1 = await chat(ollama, model, msgs);
        const s2 = await transformAsyncIterator(s1, (i => i.message.content));
        
        for await (const line of batchByNewlines(s2)) {
          lastLine = line;
          yield line;
          // msg[0] = system prompt
          // msg[1] = user prompt
          // msg[2] = reasoning
          msgs[2].content += line;

          const result = extractToolCall(line)
          if (result) {
            console.log(`++ [ Function Call : ${JSON.stringify(result)}] ++`);
            const toolResults = await triggerToolCall(result);
            console.log(`++ [ Function Results : ${toolResults}] ++`);
            const observation = `Observation: ${toolResults}\n`;
            yield observation;
            msgs[2].content += observation;
          }
        }
        // If it was not 'stop'ed on an Action, then we can finish
        if (!lastLine.includes('Action:')) {
          return;
        }
      }
    }

    let { system_prompt } = MODEL_INFO[model];
    if (model == Models.AGENT && !isToolcalling(model)) {
      system_prompt += `\n\n\n${createToolPrompt(getToolDefinitions())}`;
    }

    msgs.unshift({
      role: 'system',
      content: system_prompt,
    });

    try {
      yield* initialize(this.ollama, model);
      if (isToolcalling(model)) {
        yield* streamOutput(iterateThroughStreamWithNormalFunctionCalling(this.ollama));
      } else {
        yield* streamOutput(iterateThroughStreamManualParsing(this.ollama));
      }
    } catch (e) {
      yield* handleError(e);
    }
  }
}

