
import { Logger } from './run-sim';
import { EntityWithComponents, Scenario } from './types';
import { GameMaster } from './game-master';

export class Simulation {
  private numTurns: number;
  private logger: Logger;
  private gameMaster: GameMaster;
  private actors: EntityWithComponents[];
  private scenario: Scenario;

  constructor({ numTurns, logger, gameMaster, actors, scenario }: { numTurns: number, gameMaster: GameMaster, scenario: Scenario, logger: Logger, actors: EntityWithComponents[] }) {
    this.actors = actors;
    this.numTurns = numTurns;
    this.logger = logger;
    this.gameMaster = gameMaster;
    this.scenario = scenario;
  }

  /** Different GMs can run in parallel on different areas of the simulation. */
  async getNextGameMaster() {
    return this.gameMaster;
  }

  /** Initiates the simulation. */
  async run(): Promise<void> {
    this.logger.log("--- Simulation Started ---");

    this.gameMaster.events.push(this.scenario.getPremise());


    for (let turn = 1; turn <= this.numTurns; turn++) {
      this.logger.log(`--- Turn ${turn} ---`);
      const gm = await this.getNextGameMaster();

      const actionBlock = await this.scenario.getNextActorsToSimulate(this.actors);

      for (const actor of actionBlock.actors) {
        if (!actor) {
          console.error(actionBlock);
          this.logger.log("Error selecting actors for the scenario");
          return;
        }
        const actionSpec = actionBlock.actionSpec;
        const observations = await gm.partialObservation(actor, actionSpec);
        actor.observe(observations);

        const proposedAction = await actor.act(actionSpec);
        this.logger.log('action attempted: ' + proposedAction);

        const events = await gm.resolve(actor, actionSpec, proposedAction);
        gm.events.push(...events);
        this.logger.log('resolved action: ' + events.join('\n'));
      }
    }
    this.logger.log("--- Simulation Ended ---");
  }
}