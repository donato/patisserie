// First, define an interface for your LLM (Large Language Model)

import { Environment } from "./environment";
import {createAgentPrompt} from "./prompts/prompts";
import { Logger } from "./run-sim";

// This ensures that any LLM you use with the Agent class will have a 'generate' method.
export interface LLM {
  generate(prompt: string): Promise<string>; // Assuming generate is async and returns a string
}


interface AgentConstructorParams {
  name: string;
  role: string;
  persona: string;
  environment: Environment;
  llm: LLM;
  logger: Logger; // Note: 'readonly' is a TS keyword for class properties, not for destructuring parameters
}

export interface AgentAction {
  action: string;
  speech: string;
}

export class Agent {
  name: string;
  role: string;
  persona: string;
  llm: LLM;
  environment: Environment;
  memory: string[] = [];

  readonly logger: Logger; // Keep the readonly modifier for the class property

  constructor({ name, role = '', persona = '', environment, llm, logger }: AgentConstructorParams) {
    this.name = name;
    this.role = role;
    this.persona = persona;
    this.environment = environment;
    this.llm = llm;
    this.logger = logger;
  }

  /**
   * Generates an action (e.g., a statement) based on current observations and persona.
   * @param observations A list of current observations.
   * @returns The generated action as a string.
   */
  async proposeAction(): Promise<AgentAction> {
    const prompt = await this.constructPrompt();

    const response = await this.llm.generate(prompt);
    const action = this.parseLlmResponse(response);

    return action;
  }

  /**
   * Builds the prompt for the LLM. This is crucial for guiding the agent's behavior.
   * @param observations A list of current observations.
   * @returns The constructed prompt string.
   */
  private async constructPrompt() {
    const memories = this.memory.length ? this.memory.slice(-10) : ['None'];
    return createAgentPrompt({
      name: this.name,
      role: this.role,
      persona: this.persona,
      environmentDescription: this.environment.getDescription(),
      history: memories.join('\n')
    });
  }

  /**
   * Parses the raw LLM output to extract the agent's intended action/dialogue.
   * This might involve simple string manipulation or more complex regex if LLM output is structured.
   * @param rawResponse The raw string output from the LLM.
   * @returns The parsed action string.
   */
  private parseLlmResponse(rawResponse: string): AgentAction {
    return JSON.parse(rawResponse) as AgentAction;
  }

  /**
   * Adds an event (e.g., what another agent said) to the agent's memory.
   * @param event The event string to add to memory.
   */
  addToMemory(events: string[]): void {
    this.memory.push(...events);
  }
}