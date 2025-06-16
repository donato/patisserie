import { BaseComponent, ContextComponent, ActionSpec } from "../types";

export class ObservationsComponent extends BaseComponent implements ContextComponent {
  private memories: string[] = []

  constructor() {
    super();
  }

  async actionContext(actionSpec: ActionSpec): Promise<string> {
    return this.memories.slice(-5).join('\n');
  }

  async receiveObservation(observation: string) {
    this.memories.push(observation);
  }
}