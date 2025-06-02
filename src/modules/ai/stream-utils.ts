import { INFO_PREFIX } from './common'


export async function* emptyIterator<T>() {
  return (async function*():AsyncIterable<T> {})();
}

export async function* transformAsyncIterator<T, V>(iterator: AsyncIterable<T>, transformFn: (item: T) => V|false) {
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

export async function* batchByNewlines(stream: AsyncIterable<string>) {
  let msgBuffer = '';
  for await (const newWord of stream) {
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

export async function* stripThinkingTokens(stream:AsyncIterable<string>) {
  for await (const newWord of stream) {
    if (newWord.includes("</think>")) {
      break;
    }
  }
  yield* stream;
}

export async function* streamForChat(stream: AsyncIterable<string>) {
  let msgBuffer = '';
  for await (const newWord of stream) {
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

export async function extractFinalResult(stream: AsyncIterable<string>) {
  let lastLine = '';
  for await (const s of stream) {
    lastLine = s;
  }
  return lastLine;
}
export async function exhaust(stream: AsyncIterable<string>): Promise<string> {
  let text = '';
  for await (const s of stream) {
    text+=s;
  }
  return text;
}