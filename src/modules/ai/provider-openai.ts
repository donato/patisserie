import { Agent, AgentType } from './agents'
import { Provider , CompletionResponse, ChatMessage} from "./provider";
import OpenAI from 'openai';
import { emptyIterator, transformAsyncIterator } from './stream-utils';



// The corrected wrapper function using async function*
async function* constantToIterable<T>( c: T): AsyncIterable<T> {
  yield c;
}

export class ProviderOpenaAi implements Provider {
  private client: OpenAI;

  constructor() {
    const key = process.env['OPENAI_API_KEY'];
    this.client = new OpenAI({
      // baseURL: 'abc',
      apiKey: key
    })
  }

  abort() {}

  initialize(agent: Agent): AsyncIterable<string> {
    return emptyIterator();
  }

  async generate(agent: Agent, prompt: string): Promise<CompletionResponse> {
    const templatePrompt = agent.system_prompt + '\n\n\n' + prompt
    // console.log(templatePrompt);
    const r = await this.client.completions.create({
      model: 'gpt-4o-mini',
      // : agent.system_prompt,
      max_tokens: 1000,
      prompt: templatePrompt.trim(),
      stream: false,
      // temperature: agent.temperature,
      stop: agent.stop_sequence,
    });

    // console.log(r);
    return {
      content: r.choices[0].text
    };
  }

  async chat(agent: Agent, messages: ChatMessage[]): Promise<AsyncIterable<ChatMessage>> {
    const msgs: OpenAI.ChatCompletionMessageParam[] = messages.map(m => {
      // leaving the map, in case I need to do transformation
      return m;
    })

    // TODO - consider enabling 'json_object'
    const format = 'text';
    const completion = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: {type: format},
      messages: msgs,
      // stream: true
      stop: agent.stop_sequence,
    });

    const resp :  ChatMessage= {
      role: 'assistant',
      content: completion.choices[0].message.content || ''
    }
    return constantToIterable(resp);
  }

  async sample(prompt: string, format:"text"|"json_object" = "text") {
    const msgs: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: 'You always continue sentences provided '
                + 'by the user and you never repeat what '
                + 'the user already said.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];
    const completion = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: {type: format},
      messages: msgs,
      // stream: true
      // stop: agent.stop_sequence,
    });

    return completion.choices[0].message.content || '';
  }
}