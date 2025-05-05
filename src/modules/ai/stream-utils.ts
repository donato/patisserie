import { ChatResponse, GenerateResponse, Ollama, Message as OllamaMessage } from 'ollama'
import { Models } from './prompts';
import { INFO_PREFIX } from './ollama'


export async function* transformAsyncIterator<T, V>(iterator: AsyncIterableIterator<T>, transformFn: (item: T) => V|false) {
  for await (const item of iterator) {
    const result = await transformFn(item);
    // break the chain if the transformation ever returns false
    if (result === false) {
      break;
    }
    yield result;
  }
}

/** Streams to a discord channel from an AsyncIterable of strings.  */
export async function sendMessageIterator(msg: any, replyIterator: AsyncIterable<string>) {
  let stringBuilder = '';
  for await (const r of replyIterator) {
    if (!r || r.trim().length == 0) {
      continue;
    }
    msg.channel.send(r);
    if (r.indexOf(INFO_PREFIX) === -1) {
      stringBuilder += r.trim();
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  return stringBuilder;
}

export async function* streamChatOutput(stream: AsyncIterableIterator<ChatResponse|string>) {
  const map = (json: ChatResponse|string) => typeof json == 'string' ? json : json.message.content;
  const stringStream = transformAsyncIterator(stream, map);
  yield* streamOutput(stringStream);
}

export async function* streamGenerateOutput(stream: AsyncIterableIterator<string>) {
  yield* streamOutput(stream);
}

// Internal helper function
async function* streamOutput(stream: AsyncIterable<string>) {
  let msgBuffer = '';
  // let isThinking = isThinkingFn(model);
  // if (isThinking) {
  //   yield '[info] Chain of Thought omitted';
  // }
  for await (const newWord of stream) {
    // if (newWord == '</think>') {
    //   isThinking = false;
    //   continue;
    // }
    // if (isThinking) {
    //   continue;
    // }
    if (msgBuffer.length + newWord.length > 500) {
      yield msgBuffer;
      msgBuffer = newWord;
      continue;
    }
    msgBuffer += newWord;
    // should we flush on newlines?
    if (newWord.indexOf('\n') !== -1 && msgBuffer.length > 100) {
      yield msgBuffer;
      msgBuffer = '';
    }
  }
  if (msgBuffer.length) {
    yield msgBuffer;
  }
}