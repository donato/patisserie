import { ChatResponse, GenerateResponse, Ollama, Message as OllamaMessage } from 'ollama'
import {Models } from './prompts';
import {INFO_PREFIX} from './ollama'

export async function* transformAsyncIterator<T, V>(iterator: AsyncIterableIterator<T>, transformFn:(item:T) => V) {
  for await (const item of iterator) {
    yield await transformFn(item);
  }
}

export async function* streamChatOutput(stream: AsyncIterableIterator<ChatResponse>, model: Models) {
  const map = (json:ChatResponse) => json.message.content;
  yield* streamOutput(transformAsyncIterator(stream, map), model);
}

export async function* streamGenerateOutput(stream: AsyncIterableIterator<GenerateResponse>, model: Models) {
  const map = (json:GenerateResponse) => json.response;
  yield* streamOutput(transformAsyncIterator(stream, map), model);
}

async function* streamOutput(stream: AsyncIterable<string> , model:Models) {
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
      console.log(msgBuffer, msgBuffer.length);
      yield msgBuffer;
      msgBuffer = '';
    }
  }
  if (msgBuffer.length) {
    yield msgBuffer;
  }
}

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