import { AgentType } from "../ai/agents"
import { Simulation } from "./simulation"
import { AiModule } from "../ai/ai-module"
import { LLM, Agent } from "./agent"
import { GameMaster } from "./game-master"
import { exhaust } from "../ai/stream-utils"
import { BasicActingComponent } from "./components/basic-action-component"
import { IdentityContextComponent } from "./components/identity-context-component"
import { ObservationsComponent } from "./components/observations-component"
import { InstructionsFreeAction } from "./components/instructions-free-action"

export interface Logger {
  log: (m: string) => void;
}

export function runSim(ai: AiModule, logger: Logger) {

  const llm: LLM = {
    generate: async (prompt: string) => {
      console.log('===LLM PROMPT===')
      console.log(prompt)
      const s = await exhaust(ai.chat([{ role: 'system', content: prompt }], AgentType.EMPTY));
      console.log('===LLM RESPONSE===')
      console.log(s);
      return s;
    }
  }

  const agent1 = new Agent({
    actingComponent: new BasicActingComponent(llm),
    contextComponents: [
      new IdentityContextComponent({
        name: "Alice",
        role: "Shopkeeper",
        persona: "A friendly shopkeeper, always looking to make a sale.",
      }),
      new ObservationsComponent(),
      new InstructionsFreeAction(),
    ],
    llm,
    logger,
  });
  // const agent2 = new Agent({
  //   name: "Bob", role: "Traveler",
  //   persona: "A curious but often delusional traveler. He confidently attempts to do impossible things because he thinks he is a wizard.",
  //   environment, llm, logger
  // });
  // const agent3 = new Agent({ name: "Carol", role: "Local", persona: "A quiet local, observant and occasionally offering advice.", environment, llm, logger });


  const gmEntity = new GameMaster({
    contextComponents: [], llm, logger
  });
  const simulation = new Simulation({ numTurns: 1, logger , gameMaster: gmEntity, actors: [agent1]});

  simulation.run()
}