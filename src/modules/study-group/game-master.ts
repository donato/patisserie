// Assuming Agent and Environment classes are defined as in previous conversions:
import { Logger } from './run-sim';
import { Agent, LLM, AgentAction } from './agent';
import { Environment } from './environment';
import { createGroundingPrompt} from './prompts/prompts';

interface GroundingResponse {
  outcome: 'success' | 'failure',
  description: string,
  observations: string[],
}

export class Simulation {
  agents: Agent[];
  environment: Environment;
  numTurns: number;
  logger: Logger;
  llm: LLM;


  constructor({
    agents,
    environment,
    numTurns = 10,
    llm,
    logger
  }: {
    llm: LLM,
    agents: Agent[];
    environment: Environment;
    numTurns?: number;
    logger: Logger;
  }) {
    this.agents = agents;
    this.llm = llm;
    this.environment = environment;
    this.numTurns = numTurns;
    this.logger = logger;
  }

  /**
   * Runs the simulation for the specified number of turns,
   * allowing agents to observe, act, and update their memories.
   */
  async run(): Promise<void> {
    this.logger.log("--- Simulation Started ---");

    // define simulation goal, otherwise decisions like sequential vs parallel can flip-flop.
    // Goal: learn and understand more about interactions between agents and environment
    // Method: 
    for (let turn = 1; turn <= this.numTurns; turn++) {
      this.logger.log(`\n--- Turn ${turn} ---`);

      const actions = [];
      for (const agent of this.agents) {
        // const observations = this.environment.getObservationsForAgent(agent);

        const proposedAction = await agent.proposeAction();

        this.logger.log('INTENTION -> ' + JSON.stringify(proposedAction));
        const groundedAction = await this.groundAction(agent, proposedAction);
        actions.push(groundedAction.observations)
        this.logger.log('OUTCOME -> ' + JSON.stringify(groundedAction));
        this.agents.forEach(a => a.addToMemory(groundedAction.observations));
      }

      // for (const agent of this.agents) {
      //   // update their memory for what they perceived to happen
      // }
    }
    this.logger.log("\n--- Simulation Ended ---");
  }

  async groundAction(agent: Agent, proposedAction: AgentAction): Promise<GroundingResponse> {
    const groundingPrompt = await this.generateGroundingPrompt(agent, proposedAction);
    const result = await this.llm.generate(groundingPrompt)
    const json = JSON.parse(result);
    if (isValidGroundingResponse(json)) {
      return json;
    } {
      throw 'Invalid grounding llm response';
    }
  }

  async generateGroundingPrompt(agent: Agent, action: AgentAction) {
    const proposedAction = `${agent.name}'s action is: ${action.action}.
${agent.name} says: ${action.speech}.`;

    return createGroundingPrompt({
      world: this.environment.getWorldState(),
      proposedAction: proposedAction,
      agentName: agent.name,
      agentRole: agent.role
    });
  }
}


function isValidGroundingResponse(obj: any) : obj is GroundingResponse {
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