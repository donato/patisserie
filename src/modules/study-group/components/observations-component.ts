import { BaseComponent, ContextComponent, ActionSpec } from "../types";

export class ObservationsComponent extends BaseComponent implements ContextComponent {
  private memories: string[] = []

  constructor() {
    super();
  }

  async preAction(actionSpec: ActionSpec): Promise<string> {
    return this.memories.slice(-5).join('\n');
  }

  async postAction(attempt: string): Promise<void> {}

  preObserve(observation: string): void {
    this.memories.push(observation);
  }

  postObserve(): void {}

  update(): void {}
}