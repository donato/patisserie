import { AgentType } from "../ai/agents"
import { AiModule } from "../ai/ai-module"
import { LLM, Agent } from "./agent"
import { Environment } from "./environment"
import { Simulation } from "./game-master"
import { exhaust } from "../ai/stream-utils"

export interface Logger {
  log: (m: string) => void;
}

export function runSim(ai: AiModule, logger: Logger) {

  const llm: LLM = {
    generate: async (prompt: string) => {
      console.log('===LLM PROMPT===')
      console.log(prompt)
      const s = await exhaust(ai.chat([{role: 'system', content: prompt}], AgentType.EMPTY));
      console.log('===LLM RESPONSE===')
      console.log(s);
      return s;
    }
  }

  const environment = new Environment("A bustling town square with a few stalls and a well.", logger);
  const agent1 = new Agent({ name: "Alice", role: "Shopkeeper", persona: "A friendly shopkeeper, always looking to make a sale.", environment, llm, logger });
  const agent2 = new Agent({ name: "Bob", role: "Traveler", persona: "A curious traveler, always asking questions about new places.", environment, llm, logger });
  const agent3 = new Agent({ name: "Carol", role: "Local", persona: "A quiet local, observant and occasionally offering advice.", environment, llm, logger });


  const simulation = new Simulation({ llm, agents: [agent1, agent2, agent3], environment, numTurns: 3, logger });
  simulation.run()
}