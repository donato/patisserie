import { BaseComponent, ContextComponent, ActionSpec } from "../types";

/**
 * Records agent observations/memories and provides them back for generating 
 * action context.
 */
export class ObservationsComponent extends BaseComponent implements ContextComponent {
  private memories: string[] = []

  constructor() {
    super();
  }

  async actionContext(actionSpec: ActionSpec): Promise<string> {
    // TODO(): This should intelligently filter based on actionSpec.callToAction
    const chosenMemories = this.memories.slice(-5);
    const formattedMemories = chosenMemories.map(
      m => `  - ${m}`
    ).join('\n');

    return `Recent observations from your perspective: \n\n${formattedMemories}`;
  }

  async receiveObservations(observations: string[]) {
    this.memories.push(...observations);
  }
}