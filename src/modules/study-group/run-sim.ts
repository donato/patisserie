import { Simulation } from "./simulation"
import { Agent } from "./agent"
import { LLM, OutputType } from "./types"
import { GameMaster } from "./game-master"
import { BasicActingComponent } from "./components/basic-action-component"
import { IdentityContextComponent } from "./components/identity-context-component"
import { ObservationsComponent } from "./components/observations-component"
import { InstructionsFreeAction } from "./components/instructions-free-action"
import { EnvironmentInventory, createItemType } from "./components/environment-Inventory"
import { DeceptionGame, DeceptionGameContextComponent } from "./environments/deception-game"
import { ProviderOpenaAi } from '../ai/provider-openai';

export interface Logger {
  log: (m: string) => void;
}
class GptLlmImpl implements LLM {
  constructor(readonly ai = new ProviderOpenaAi()) { }


  async freeText(prompt: string) {
    console.log('===LLM PROMPT===')
    console.log(prompt)
    const s = await this.ai.sample(prompt);
    console.log('===LLM RESPONSE===')
    console.log(s);
    return s;
  }

  async json(prompt: string) {
    console.log('===LLM PROMPT===')
    console.log(prompt)
    const s = await this.ai.sample(prompt, "json_object");
    console.log('===LLM RESPONSE===')
    console.log(s);
    return s;
  }

  async choose(prompt: string, options: string[]) {
    const fullPrompt = `${prompt}\n\n\nThis is a multiple choice question. Respond with EXACTLY one of the following strings\n${options.join('\n')}`

    const choice = await this.freeText(fullPrompt);
    if (!options.includes(choice)) {
      // TODO - try again
    }
    return choice;
  }
}

export function runSim(logger: Logger) {

  const llm = new GptLlmImpl();

  const agent1 = new Agent({
    actingComponent: new BasicActingComponent(llm),
    contextComponents: [
      new IdentityContextComponent({
        name: "Alice",
        role: "Shopkeeper",
        persona: "A friendly shopkeeper, always looking to make a sale.",
      }),
      new ObservationsComponent(),
      new DeceptionGameContextComponent(),
      // new InstructionsFreeAction(),
    ],
    llm,
    logger,
  });
  const agent2 = new Agent({
    actingComponent: new BasicActingComponent(llm),
    contextComponents: [
      new IdentityContextComponent({
        name: "Bob",
        role: "Traveler",
        persona: "A curious but often delusional traveler. He confidently attempts to do impossible things because he thinks he is a wizard."

      }),
      new ObservationsComponent(),
      new DeceptionGameContextComponent(),
      // new InstructionsFreeAction()
    ],
    llm,
    logger,
  });
  const agent3 = new Agent({
    actingComponent: new BasicActingComponent(llm),
    contextComponents: [
      new IdentityContextComponent({
        name: "Carol",
        role: "Local",
        persona: "A quiet local, observant and occasionally offering advice."
      }),
      new ObservationsComponent(),
      new DeceptionGameContextComponent(),
      // new InstructionsFreeAction()
    ],
    llm,
    logger,
  });
  const game = new DeceptionGame({
    actors: [agent1, agent2, agent3],
    llm
  })
  // const inventory = new EnvironmentInventory([agent1.id, agent2.id, agent3.id]);
  // const apple = createItemType("apple");
  // const gold = createItemType("gold coin");
  // inventory.setCount(agent1.id, apple, 5);

  // inventory.setCount(agent1.id, gold, 2);
  // inventory.setCount(agent2.id, gold, 5)
  // inventory.setCount(agent3.id, gold, 2);


  const gmEntity = new GameMaster({
    environmentComponents: [game],
    // environmentComponents: [inventory],
    llm,
    logger,
  });
  const simulation = new Simulation({
    numTurns: 1,
    scenario: game,
    gameMaster: gmEntity,
    actors: [agent1, agent2, agent3],
    logger,
  });

  simulation.run()
}