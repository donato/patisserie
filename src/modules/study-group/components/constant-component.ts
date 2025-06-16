import { BaseComponent, ContextComponent, ActionSpec } from "../types";

export class ConstantComponent extends BaseComponent implements ContextComponent {
  constructor(private readonly text: string) {
    super();
  }

  async preAction(actionSpec: ActionSpec): Promise<string> {
    return this.text;
  }

  async postAction(attempt: string): Promise<void> {}

  preObserve(observation: string): void {}

  postObserve(): void {}

  update(): void {}
}