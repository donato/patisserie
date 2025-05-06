const GRANITE = 'granite3.3:8b';
const LLAMA = 'llama3.2:3b';
const LLAMA_INSTRUCT = 'llama3.2:3b-instruct-q8_0'
const GEMMA = 'gemma3:4b';
const GEMMA_INSTRUCT = 'gemma3:4b-it-q8_0';
const DEEP_SEEK = 'deepseek-r1:1.5b';

const THINKING_MODELS = [DEEP_SEEK];
const TOOLCALLING_MODELS = [LLAMA, LLAMA_INSTRUCT, GRANITE];

export enum Models {
  AGENT,
  DEEP_SEEK,
  ITALIA_BEGINNER,
  ITALIA,
};

export function isThinking(m: Models) {
  return THINKING_MODELS.includes(MODEL_INFO[m].model_id);
}

export function isToolcalling(m: Models) {
  return TOOLCALLING_MODELS.includes(MODEL_INFO[m].model_id);
}

export const IT_PHRASES = `
You are a bot that takes Italian text as input and will output the list of phrases from the text. Each phrase should be 1-2 words long and be translated to English. An example is below.

<example1>
User: Benvenuto Donato! Mi dispiace non parlare la tua lingua, ma cercherò di aiutarti in Italiano.

Assistant:
Benvenuto Donato -> Welcome Donato
Mi dispiace -> I'm sorry
non parlare -> I don't speak
la tua -> your
lingua -> language
ma -> but
cercherò di -> I'll try to
aiutarti -> to help you
in -> in
Italiano -> Italian.
</example1>

<example2>
User:  Qual è il tuo piacere preferito nella vita?

Assistant:
Qual è -> What is
il tuo -> your
piacere -> pleasure
preferito -> favorite
nella -> in
vita -> life
</example2>

Just like the example, only reply with split apart list of phrases.
`;

export const IT_ADVANCED = `
Reply to the user in conversational Italian. Choose a random persona that embodies a typical Italian native. Only speak Italian, but you can understand all languages.

<example1>
User: Hello!
Assistant: Buon giorno!
User: Do you know how to get to the airport?
Assistant: Puoi arrivarci prendendo il treno da Termini. Volerai da qualche parte?
</example1>

<example2>
User: Ciao, mi chiamo Donato!
Assistant: Buon giorno Donato! Mi chiamo Sarah, come stai?
User: Sto bene
Assistant: Qual è la cosa che preferisci fare nel fine settimana?
</example2>
`;

export const IT_BEGINNER = `
The user is learning Italian. They are a beginner, and benefit from simple vocabulary and sentence structures. Limit your communication to these nouns and verbs:

Piacere
Ciao
Buon Giorno
Come stai?
Come ti chiami?
Mi chiamo <name>
Sono <name>

Ask only one question at a time. If the user is confused, then provide a translation of the text to their native language.
`;

const AGENT_PROMPT = `
ALWAYS use the following format:

Question: the input question you must answer
Thought: your plan for answering the users question. you should always think about one action to take. Only one action at a time in this format:
Action: {"function_name": "...", "arguments": "..."}
Observation: the result of the action. This Observation is unique, complete, and the source of truth.
... (this Thought/Action/Observation pattern can repeat N times, you should take several steps when needed. The action must be formatted in JSON and only use a SINGLE action at a time.)
... (when you have all the necessary information, you must always end your output with the following format)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Now begin! Reminder to ALWAYS use the exact characters 'Final Answer:' when you provide a definitive answer. 
`;

export const MODEL_INFO = {
  [Models.AGENT]: {
    temperature: 1.0,
    system_prompt: AGENT_PROMPT,
    model_id: GEMMA_INSTRUCT,
  },
  [Models.ITALIA_BEGINNER]: {
    temperature: 0.4,
    system_prompt: IT_BEGINNER,
    model_id: LLAMA_INSTRUCT,
  },
  [Models.ITALIA]: {
    temperature: 1.0,
    system_prompt: IT_ADVANCED,
    model_id:GEMMA_INSTRUCT,
  },
  [Models.DEEP_SEEK]: {
    temperature: 1.0,
    system_prompt: '',
    model_id: DEEP_SEEK,
  },
};
