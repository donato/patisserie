import { Logger } from './run-sim';
import { LLM } from './types';
import { createGroundingPrompt } from './prompts/prompts';
import { IdentityContextComponent } from './components/identity-context-component';
import { OutputType, ActionSpecSimple, EntityWithComponents, ActingComponent, BaseComponent, ContextComponent } from './types';

interface GroundingResponse {
  outcome: 'success' | 'failure',
  description: string,
  observations: string[],
}

function isValidGroundingResponse(obj: any): obj is GroundingResponse {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  if (!('outcome' in obj) || typeof obj.outcome !== "string") {
    console.error("Missing or incorrect 'outcome' field. Expected 'success'.");
    return false;
  }

  if (!('description' in obj) || typeof obj.description !== 'string') {
    console.error("Missing or incorrect 'description' field. Expected a string.");
    return false;
  }

  if (!('observations' in obj) || !Array.isArray(obj.observations)) {
    console.error("Missing or incorrect 'observations' field. Expected an array.");
    return false;
  }

  for (const obs of obj.observations) {
    if (typeof obs !== 'string') {
      console.error("All items in 'observations' array must be strings.");
      return false;
    }
  }

  return true;
}

export class GameMaster {
  contextComponents: ContextComponent[];
  llm: LLM;
  logger: Logger;


  // TODO - these should be shared across all GM instances
  events: string[] = [];

  constructor({
    contextComponents,
    llm,
    logger
  }: {
    contextComponents: ContextComponent[],
    llm: LLM,
    logger: Logger;
  }) {
    this.contextComponents = contextComponents;
    this.llm = llm;
    this.logger = logger;
  }

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

  /* Generates an observation for a specific agent, from their perspective. */
  async partialObservation(actor: EntityWithComponents): Promise<string[]> {
    // equivalent to Concordia MAKE_OBSERVATION
    const identity = await actor.getComponent<IdentityContextComponent>(IdentityContextComponent);
    const events = this.events.join('\n\n');
    const prompt = `What is the current situation faced by ${identity.name}? What do they now observe?
Only include information of which they are aware.


Recent Events:
${events}


Output Format:
Respond with a JSON object containing \`observations\` (array of strings: what is observed by ${identity.name}).
`;

    const result = await this.llm.generate(prompt);
    // TODO(): verify the structure of the response
    const json = (JSON.parse(result) as any);
    const obsArray = json['observations'];
    return obsArray;
  }

  async resolve(actor: EntityWithComponents, callToAction: string) {
    const identity = await actor.getComponent<IdentityContextComponent>(IdentityContextComponent);
    const proposedAction = `${identity.name}: ${callToAction}.`;

    const prompt = await createGroundingPrompt({
      world: '',
      proposedAction: proposedAction,
      agentName: identity.name,
      agentRole: identity.role
    });
    const result = await this.llm.generate(prompt)
    const json = JSON.parse(result);
    if (isValidGroundingResponse(json)) {
      return json;
    } {
      throw 'Invalid grounding llm response';
    }
  }
}
