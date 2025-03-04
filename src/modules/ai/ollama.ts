import { ChatResponse, GenerateResponse, Ollama, Message as OllamaMessage } from 'ollama'
import { streamChatOutput, streamGenerateOutput } from './stream-utils'
import { Models, BASE_MODELS, MODEL_TEMPERATURE, SYSTEM_PROMPTS } from './prompts';

export const INFO_PREFIX = '[info]';

function generate(ollama: Ollama, model: Models, prompt: string) {
  console.log(`ollama.generate [${model}]`);
  return ollama.generate({
    model: BASE_MODELS[model],
    system: SYSTEM_PROMPTS[model],
    prompt: prompt,
    options: {
      temperature: MODEL_TEMPERATURE[model],
    },
    stream: true,
    keep_alive: '1h'
  // the type casting can be removed when bug is fixed https://github.com/ollama/ollama-js/issues/135
  }) as unknown as Promise<AsyncIterableIterator<GenerateResponse>>;
}

function chat(ollama: Ollama, model: Models, msgs: OllamaMessage[]) {
  console.log(`ollama.chat [${model}]`);
  msgs.unshift({
    role: 'system',
    content: SYSTEM_PROMPTS[model]
  });
  return ollama.chat({
    model: BASE_MODELS[model],
    messages: msgs,
    options: {
      temperature: MODEL_TEMPERATURE[model]
    },
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

export class AiModule {
  private readonly ollama: Ollama;

  constructor() {
    // todo(): Add a queue and/or lock
    this.ollama = new Ollama({ host: 'http://192.168.2.132:11434' })
  }

  async *generate(prompt: string, model: Models) {
    try {
      yield* initialize(this.ollama, model);
      const stream = await generate(this.ollama, model, prompt);
      yield* streamGenerateOutput(stream, model);
    } catch (e) {
      yield* handleError(e);
    }
  }

  async *chat(msgs: OllamaMessage[], model: Models) {
    if (!msgs.length) { return; }

    try {
      yield* initialize(this.ollama, model);
      const stream = await chat(this.ollama, model, msgs);
      yield* streamChatOutput(stream, model);
    } catch (e) {
      yield* handleError(e);
    }
  }
}