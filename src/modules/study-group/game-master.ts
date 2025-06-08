import { Logger } from './run-sim';
import { Agent, LLM } from './agent';
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
  name: string;
  actingComponent: ActingComponent;
  contextComponents: ContextComponent[];
  llm: LLM;
  logger: Logger;
  gmEntity: Agent;


  // TODO - these should be shared across all GM instances
  events: string[] = [];

  constructor({
    name,
    actingComponent,
    contextComponents,
    llm,
    logger
  }: {
    name: string,
    actingComponent: ActingComponent,
    contextComponents: ContextComponent[],
    llm: LLM,
    logger: Logger;
  }) {
    this.name = name;
    this.actingComponent = actingComponent;
    this.contextComponents = contextComponents;
    this.llm = llm;
    this.logger = logger;
    this.gmEntity = new Agent({
      actingComponent,
      contextComponents,
      logger,
      llm
    })
  }

  getComponent(componentType: typeof BaseComponent) {
    for (const c of this.contextComponents) {
      if (c instanceof componentType) {
        return c;
      }
    }
    throw "Unexpected component type access"
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

  async getNextActorsToSimulate(actors: EntityWithComponents[]) {
    // TODO(): Can filter out actors who are not relevant to the scene.
    return {
      actors,
      actionSpec: {
        callToAction: "What do they do?",
        outputType: OutputType.FREE_TEXT
      } as ActionSpecSimple
    };
  }

  async partialObservation(actor: EntityWithComponents) {
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
    return (JSON.parse(result) as any).observations.join('\n\n');
  }
}

export class Simulation {
  private numTurns: number;
  private logger: Logger;
  private gameMaster: GameMaster;
  private actors: EntityWithComponents[];

  constructor({ numTurns, logger, gameMaster, actors }: { numTurns: number, gameMaster: GameMaster, logger: Logger, actors: EntityWithComponents[] }) {
    this.actors = actors;
    this.numTurns = numTurns;
    this.logger = logger;
    this.gameMaster = gameMaster;
  }

  /** Different GMs can run in parallel on different areas of the simulation. */
  async getNextGameMaster() {
    return this.gameMaster;
  }

  /** Initiates the simulation. */
  async run(): Promise<void> {
    this.logger.log("--- Simulation Started ---");

    this.gameMaster.events.push('[OBSERVATION] The premise is a town square where merchants sell their goods.');

    for (let turn = 1; turn <= this.numTurns; turn++) {
      this.logger.log(`--- Turn ${turn} ---`);
      const gm = await this.getNextGameMaster();

      const actionBlock = await gm.getNextActorsToSimulate(this.actors);

      for (const actor of actionBlock.actors) {
        const observation = await gm.partialObservation(actor);
        actor.observe(observation);
        const proposedAction = await actor.act(actionBlock.actionSpec);
        this.logger.log('action attempted: ' + proposedAction);
        const event = await gm.resolve(actor, proposedAction);
        gm.events.push('[OBSERVATION] ' + event.description);
        this.logger.log('resolved action: ' + event.description);
      }
    }
    this.logger.log("--- Simulation Ended ---");
  }
}