
import { Logger } from './run-sim';
import { EntityWithComponents } from './types';
import { GameMaster } from './game-master';


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