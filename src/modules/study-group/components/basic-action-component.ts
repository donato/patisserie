import { LLM } from "../agent";
import { BaseComponent, ActingComponent, ActionSpec } from "../types";

export class BasicActingComponent extends BaseComponent implements ActingComponent {
  constructor(private readonly llm: LLM) {
    super();
  }

  async getActionAttempt(contextMap: { [componentName: string]: string; }, actionSpec: ActionSpec): Promise<string> {
    let sb = [];
    for (let [component, context] of Object.entries(contextMap)) {
      sb.push(context);
    }

    sb.push(actionSpec.callToAction); // todo - formatting?
    return await this.llm.generate(sb.join('\n\n\n'));
  }
}