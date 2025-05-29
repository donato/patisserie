import { CONTEXT_LENGTH} from './common';
import { ChatResponse as OllamaChatResponse, GenerateResponse, Ollama } from 'ollama'
import { Agent, AgentType, useManualToolCalling, useNativeToolCalling } from './agents';
import { Provider , ChatMessage} from './provider';
import { transformAsyncIterator } from './stream-utils';

const OLLAMA_HOST = 'http://192.168.1.132:11434'

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
      stop: agent.stop_sequence,
    },
    stream: false,
    keep_alive: '1h'
    // the type casting can be removed when bug is fixed https://github.com/ollama/ollama-js/issues/135
  }) as unknown as Promise<GenerateResponse>;
}

function chat(ollama: Ollama, agent: Agent, msgs: ChatMessage[]) {
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
      stop: agent.stop_sequence,
    },
    tools,
    stream: true,
    keep_alive: '1h',
    // the type casting can be removed when bug is fixed https://github.com/ollama/ollama-js/issues/135
  }) as unknown as Promise<AsyncIterableIterator<OllamaChatResponse>>;
}

async function isModelActive(ollama: Ollama, agent: Agent) {
  const runningModels = await ollama.ps();
  return runningModels.models.some(
    m => m.name == agent.model_id);
}

async function* initialize(ollama: Ollama, agent: Agent): AsyncIterable<string> {
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
    yield `Attempting to boot ${agent}`;
    generate(ollama, agent, 'test');

    await new Promise(resolve => setTimeout(resolve, 2000));

    isActive = await isModelActive(ollama, agent);
    retries++;
  }
  if (isActive) {
    yield `Model ${agent} running!`;
  } else {
    yield `Stopping retrying.`;
  }
}

export class ProviderOllama implements Provider {
  readonly ollama: Ollama;

  constructor() {
    this.ollama = new Ollama({ host: OLLAMA_HOST });
  }

  initialize(agent: Agent) {
    return initialize(this.ollama, agent);
  }

  async generate(agent: Agent, prompt: string) {
    return generate(this.ollama, agent, prompt).then(genResponse => {
      return {
        content: genResponse.response
      };
    });
  }

  async chat(agent: Agent, messages: ChatMessage[]): Promise<AsyncIterable<ChatMessage>> {
    const chatStream = await chat(this.ollama, agent, messages);
    return transformAsyncIterator(chatStream, (item) => {
      return item.message as ChatMessage
    });
  }

  abort() {
    this.ollama.abort();
  }
}