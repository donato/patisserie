import { Logger } from './run-sim';
import { LLM } from './types';
import { IdentityContextComponent } from './components/identity-context-component';
import { ActionSpec, GroundedEnvironment, EntityWithComponents } from './types';

export class GameMaster {
  environmentComponents: GroundedEnvironment[];
  llm: LLM;
  logger: Logger;


  // TODO - these should be shared across all GM instances
  events: string[] = [];

  constructor({
    environmentComponents,
    llm,
    logger
  }: {
    environmentComponents: GroundedEnvironment[],
    llm: LLM,
    logger: Logger;
  }) {
    this.environmentComponents = environmentComponents;
    this.llm = llm;
    this.logger = logger;
  }

  /* Generates an observation for a specific agent, from their perspective. */
  async partialObservation(actor: EntityWithComponents, actionSpec: ActionSpec): Promise<string[]> {
    const identity = await actor.getComponent<IdentityContextComponent>(IdentityContextComponent);
    const events = this.events.join('\n\n');
    const prompt = `What is the current situation faced by ${identity.name}? What do they now observe?
Only include information of which they are aware.


Recent Events:
${events}


Output Format:
Respond with a JSON object containing \`observations\` (array of strings: what is observed by ${identity.name}).
`;

    const result = await this.llm.json(prompt);
    // TODO(): verify the structure of the response
    const json = (JSON.parse(result) as any);
    const obsArray = json['observations'];
    return obsArray;
  }

  async resolve(actor: EntityWithComponents, actionSpec: ActionSpec, proposedAction: string) {
    const results: string[] = [];
    for (const env of this.environmentComponents) {
      const result = await env.resolve(actor.id, actionSpec, proposedAction)

      if (result.isChanged) {
        results.push(result.description);
      }
    }
    return results;
  }
}
