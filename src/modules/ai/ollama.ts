import { ChatResponse, GenerateResponse, Ollama, Message as OllamaMessage } from 'ollama'
import { streamChatOutput, streamGenerateOutput } from './stream-utils'
import { Models, BASE_MODELS, MODEL_TEMPERATURE, SYSTEM_PROMPTS } from './prompts';

export const INFO_PREFIX = '[info]';



function generate(ollama: Ollama, model: Models, prompt: string) {
  console.log(`ollama.generate [${model}]`);
  return ollama.generate({
    model: BASE_MODELS[model],
    options: {
      temperature: MODEL_TEMPERATURE[model],
    },
    system: SYSTEM_PROMPTS[model],
    stream: true,
    prompt: prompt,
    keep_alive: '1h'
  });
}

function chat(ollama: Ollama, model: Models, msgs: OllamaMessage[]) {
  console.log(`ollama.chat [${model}]`);
  msgs.unshift({
    role: 'system',
    content: SYSTEM_PROMPTS[model]
  });
  return ollama.chat({
    model: BASE_MODELS[model],
    stream: true,
    messages: msgs,
    keep_alive: '1h'
  });
}

async function activeModel(ollama: Ollama, model: Models) {
  const runningModels = await ollama.ps();
  console.log(runningModels);
  for (const m of runningModels.models) {
    console.log(BASE_MODELS[model]);
    if (m.name == BASE_MODELS[model]) {
      return m.name;
    }
  }
  return false;
}

async function* initialize(ollama: Ollama, model: Models) {
  let isActive;
  try {
    isActive = await activeModel(ollama, model);
  } catch (e) {
    yield `${INFO_PREFIX} Unable to connect to the TenStep Gaming PC`;
    return;
  }
  if (isActive) {
    return;
  }

  let retries = 0;
  while (!isActive && retries < 3) {
    yield `${INFO_PREFIX} Attempting to boot ${BASE_MODELS[model]}`;
    generate(ollama, model, 'test');

    await new Promise(resolve => setTimeout(resolve, 2000));

    isActive = await activeModel(ollama, model);
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
    yield `${INFO_PREFIX} ${e.message.toString()}`;
  } else {
    yield `${INFO_PREFIX} Unknown error, check logs`;
  }
}

export class AiModule {

  async *generate(prompt: string, model: Models) {
    const ollama = new Ollama({ host: 'http://192.168.2.132:11434' })
    yield* initialize(ollama, model);

    try {
      const chatReply = await generate(ollama, model, prompt);
      // the type casting can be removed when bug is fixed https://github.com/ollama/ollama-js/issues/135
      yield* streamGenerateOutput(chatReply as unknown as AsyncIterableIterator<GenerateResponse>, model);
    } catch (e) {
      yield* handleError(e);
    }
  }

  async *chat(msgs: OllamaMessage[], model: Models) {
    if (!msgs.length) { return; }
    const ollama = new Ollama({ host: 'http://192.168.2.132:11434' })
    yield* initialize(ollama, model);

    try {
      const chatReply = await chat(ollama, model, msgs);
      // the type casting can be removed when bug is fixed https://github.com/ollama/ollama-js/issues/135
      yield* streamChatOutput(chatReply as unknown as AsyncIterableIterator<ChatResponse>, model);
    } catch (e) {
      yield* handleError(e);
    }
  }
}