import { Agent} from './agents';

export interface CompletionResponse {
  content: string
}

interface ChatMessageToolCall {
  role: 'tool';
  content: string;
  tool_calls: ToolCall[];
  tool_call_id: string;
}

export interface ChatMessageText {
    role: 'user' | 'assistant' | 'system';
    content: string;
    // images?: Uint8Array[] | string[];
}

export type ChatMessage = ChatMessageText | ChatMessageToolCall;

export interface ToolCall {
    function: {
        name: string;
        arguments: {
            [key: string]: any;
        };
    };
}

export interface Provider {
  initialize(agent:Agent) : AsyncIterable<string>;

  generate(agent: Agent, prompt: string) : Promise<CompletionResponse>;

  chat(agent: Agent, messages: ChatMessage[]) : Promise<AsyncIterable<ChatMessage>>;

  abort(): void;
}