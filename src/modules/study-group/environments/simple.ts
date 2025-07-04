import { OutputType, ActionSpecSimple, EntityWithComponents } from "../types";

export class SimpleScenario {
  async getNextActorsToSimulate(actors: EntityWithComponents[]) {
    // TODO(): Can filter out actors who are not relevant to the scene.
    const action = 'What do you say or do next as ${name} (${role})? Be concise and stay in character.';
    return {
      actors,
      actionSpec: {
        callToAction:action,
        outputType: OutputType.FREE_TEXT
      } as ActionSpecSimple
    };
  }
}