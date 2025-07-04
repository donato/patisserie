import { LLM, OutputType } from "../types";
import { BaseComponent, ActingComponent, ActionSpec } from "../types";

/**
 * Uses an LLM call to generates an agents action by concatenating all of the 
 * strings generatated by the agents ContextComponents.
 */
export class BasicActingComponent extends BaseComponent implements ActingComponent {
  constructor(private readonly llm: LLM) {
    super();
  }

  async getActionAttempt(contextMap: Map<Symbol, string>, actionSpec: ActionSpec): Promise<string> {
    let sb = [];
    for (let [id, context] of contextMap.entries()) {
      sb.push(context);
    }

    sb.push(actionSpec.callToAction); // todo - formatting?
    return await this.llm.freeText(sb.join('\n\n\n'));
  }
}