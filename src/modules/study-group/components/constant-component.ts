import { BaseComponent, ContextComponent, ActionSpec } from "../types";

/**
 * A context component that always returns the same static text for generating
 * action context.
 */
export class ConstantComponent extends BaseComponent implements ContextComponent {
  constructor(private readonly text: string) {
    super();
  }

  async actionContext(actionSpec: ActionSpec): Promise<string> {
    return this.text;
  }

  async receiveObservations(obs: string[]): Promise<void> {}

  preObserve(observation: string): void {}

  postObserve(): void {}

  update(): void {}
}