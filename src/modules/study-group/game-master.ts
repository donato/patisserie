// Assuming Agent and Environment classes are defined as in previous conversions:
import { Logger } from './run-sim';
import { Agent } from './agent';
import { Environment } from './environment';

export class Simulation {
  agents: Agent[];
  environment: Environment;
  numTurns: number;
  logger: Logger;


  constructor({
    agents,  
    environment,   
    numTurns = 10 ,
    logger
  }: { 
    agents: Agent[];
    environment: Environment;
    numTurns?: number;
    logger: Logger;
  }) {
    this.agents = agents;
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

    for (let turn = 1; turn <= this.numTurns; turn++) {
      this.logger.log(`\n--- Turn ${turn} ---`);

      for (const agent of this.agents) {
        // Get observations for the current agent from the environment
        const observations = this.environment.getLatestObservations();

        // Agent generates an action based on observations and its memory/persona
        const action = await agent.proposeAction(observations, this.environment.description);

        // The action is then added to the environment's public log
        const eventString = `${agent.name} says: "${action}"`;
        this.environment.addPublicEvent(eventString);

        // All other agents also get this event added to their memory for the next turn
        // ** Commented out to avoid double logging. In the MVP, environment actions are not filtered by the game master
        // for (const otherAgent of this.agents) {
        //   if (otherAgent !== agent) {
        //     otherAgent.addResultToMemory(eventString);
        //   }
        // }
      }
    }
    this.logger.log("\n--- Simulation Ended ---");
  }
}