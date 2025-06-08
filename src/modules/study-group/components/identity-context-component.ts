import { createAgentPrompt } from "../prompts/prompts";
import { BaseComponent, ContextComponent, ActionSpec } from "../types";

interface ConstructorParams {
  name: string;
  role: string;
  persona: string;
}

export class IdentityContextComponent extends BaseComponent implements ContextComponent {
  name: string;
  role: string;
  persona: string;

  constructor({name, role, persona}: ConstructorParams) {
    super();
    this.name = name;
    this.role = role;
    this.persona = persona;
  }

  async preAction(actionSpec: ActionSpec): Promise<string> {
    return createAgentPrompt({
      name: this.name,
      role: this.role,
      persona:this.persona,
      environmentDescription: '',
      history: ''
    });
  }

  async postAction(attempt: string): Promise<void> {}

  preObserve(observation: string): void {}

  postObserve(): void {}

  update(): void {}
}