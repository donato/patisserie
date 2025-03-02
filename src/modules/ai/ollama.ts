import { ChatResponse, GenerateResponse, Ollama, Message as OllamaMessage } from 'ollama'


const LLM_MODEL = 'deepseek-r1:1.5b';
const LLM_MODEL_SLOW = 'deepseek-r1:7b';



function generate(ollama: Ollama, prompt: string) {
  console.log('doing chat.');
  return ollama.generate({
    model: LLM_MODEL,
    stream: true,
    prompt: prompt,
    keep_alive: '1h'
  });
}
function interactiveGenerate(ollama: Ollama, msgs: OllamaMessage[]) {
  console.log('doing chat.');
  return ollama.chat({
    model: LLM_MODEL,
    stream: true,
    messages: msgs,
    keep_alive: '1h'
  });
}

async function activeModel(ollama: Ollama) {
  const runningModels = await ollama.ps();
  if (runningModels.models.length == 0) {
    return false;
  }
  return runningModels.models[0].name;
}

async function* initialize(ollama: Ollama) {
  let modelName;
  try {
    modelName = await activeModel(ollama);
  } catch (e) {
    yield '[info] Unable to connect to the TenStep Gaming PC';
    return;
  }
  let retries = 0;
  while (modelName == false) {
    if (retries > 3) {
      yield '[info] Stopping retrying.';
      return;
    }
    yield '[info] Attempting to boot up a model...';
    generate(ollama, 'test');

    await new Promise(resolve => setTimeout(resolve, 2000));

    modelName = await activeModel(ollama);
  }
  yield `[info] Model ${modelName} running!`;
}

async function* streamChatOutput(chatReply: AsyncIterableIterator<ChatResponse>) {
  let msgBuffer = '';
  let isThinking = true;
  yield '> Chain of Thought omitted';
  for await (const json of chatReply) {
    const newWord = json.message.content;
    if (newWord == '</think>') {
      isThinking = false;
      continue;
    }
    if (isThinking) {
      continue;
    }
    if (msgBuffer.length + newWord.length > 500) {
      yield msgBuffer;
      msgBuffer = newWord;
      continue;
    }
    msgBuffer += newWord;
    if (newWord.indexOf('\n') !== -1) {
      yield msgBuffer;
      msgBuffer = '';
    }
  }
  if (msgBuffer.length) {
    yield msgBuffer;
  }
}

async function* streamOutput(chatReply: AsyncIterableIterator<GenerateResponse>) {
  let msgBuffer = '';
  for await (const json of chatReply) {
    const newWord = json.response;
    if (msgBuffer.length + newWord.length > 500) {
      yield msgBuffer;
      msgBuffer = newWord;
      continue;
    }
    msgBuffer += newWord;
    if (newWord.indexOf('\n') !== -1) {
      yield msgBuffer;
      msgBuffer = '';
    }
  }
  if (msgBuffer.length) {
    yield msgBuffer;
  }
}

function* handleError(e: unknown) {
  console.log(e);
  if (e instanceof Error) {
    yield '[info] ' + e.message.toString();
  } else {
    yield '[info] Unknown error, check logs';
  }
}

export class AiModule {

  async *generate(prompt: string) {
    const ollama = new Ollama({ host: 'http://192.168.2.132:11434' })
    yield* initialize(ollama);

    try {
      const chatReply = await generate(ollama, prompt);
      // the type casting can be removed when bug is fixed https://github.com/ollama/ollama-js/issues/135
      yield* streamOutput(chatReply as unknown as AsyncIterableIterator<GenerateResponse>);
    } catch (e) {
      yield* handleError(e);
    }
  }

  async *chat(msgs: OllamaMessage[]) {
    if (!msgs.length) { return; }
    const ollama = new Ollama({ host: 'http://192.168.2.132:11434' })
    yield* initialize(ollama);

    try {
      const chatReply = await interactiveGenerate(ollama, msgs);
      // the type casting can be removed when bug is fixed https://github.com/ollama/ollama-js/issues/135
      yield* streamChatOutput(chatReply as unknown as AsyncIterableIterator<ChatResponse>);
    } catch (e) {
      yield* handleError(e);
    }
  }
}