// First, define an interface for your LLM (Large Language Model)

import { Logger } from "./run-sim";

// This ensures that any LLM you use with the Agent class will have a 'generate' method.
export interface LLM {
  generate(prompt: string): Promise<string>; // Assuming generate is async and returns a string
}

export class Agent {
  name: string;
  persona: string;
  llm: LLM; 
  memory: string[]; 

  constructor(name: string, persona: string, llmModel: LLM, logger: Logger) {
    this.name = name;
    this.persona = persona;
    this.llm = llmModel;
    this.memory = [];
  }

  /**
   * Generates an action (e.g., a statement) based on current observations and persona.
   * @param observations A list of current observations.
   * @returns The generated action as a string.
   */
  async proposeAction(observations: string[], environmentDescription: string): Promise<string> {
    // first add the new observations into memory
    this.memory.push(...observations.map(o => 'OBSERVATION: ' +o));

    // Combine persona, memory, and current observations into a single prompt
    const prompt = this.constructPrompt(observations, environmentDescription);
    console.log(prompt);
    const response = await this.llm.generate(prompt); 
    const action = this.parseLlmResponse(response);

    this.memory.push(`PROPOSE ACTION: ${action}`);
    
    return action;
  }

  /**
   * Builds the prompt for the LLM. This is crucial for guiding the agent's behavior.
   * @param observations A list of current observations.
   * @returns The constructed prompt string.
   */
  private constructPrompt(observations: string[], environmentDescription: string): string {
    const promptParts: string[] = [
      `You are ${this.name}. Your persona is: ${this.persona}`,
      `Your environment is: ${environmentDescription}`,
      "Here's what has happened recently:",
    ];

    // Add recent memories (e.g., last 5 turns)
    for (const mem of this.memory.slice(-5)) {
      promptParts.push(mem);
    }
    if (this.memory.length === 0) {
      promptParts.push('OBSERVATION: Nothing');
    }

    if (observations.length > 0) {
      promptParts.push(`Current observations: ${observations[observations.length - 1]}`);
    }

    promptParts.push(`What do you intend to say or do next as ${this.name}?`);
    return promptParts.join("\n");
  }

  /**
   * Parses the raw LLM output to extract the agent's intended action/dialogue.
   * This might involve simple string manipulation or more complex regex if LLM output is structured.
   * @param rawResponse The raw string output from the LLM.
   * @returns The parsed action string.
   */
  private parseLlmResponse(rawResponse: string): string {
    // For a simple MVP, just return the raw response, or strip leading/trailing whitespace.
    return rawResponse.trim();
  }

  /**
   * Adds an event (e.g., what another agent said) to the agent's memory.
   * @param event The event string to add to memory.
   */
  addResultToMemory(event: string): void {
    this.memory.push('ACTION: ' + event);
  }
}