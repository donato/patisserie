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

  async actionContext(actionSpec: ActionSpec): Promise<string> {
    return `
You are roleplaying as ${this.name} (${this.role}). Your persona is: ${this.persona}.
`;
  }

  async receiveObservation(attempt: string): Promise<void> {}
}