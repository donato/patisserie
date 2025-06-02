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
    generate:(prompt: string) => {
      return exhaust(ai.generate(prompt, AgentType.EMPTY));
    }
  }

  const agent1 = new Agent("Alice (Shopkeeper)", "A friendly shopkeeper, always looking to make a sale.", llm, logger);
  const agent2 = new Agent("Bob (Traveler)", "A curious traveler, always asking questions about new places.", llm, logger);
  const agent3 = new Agent("Carol (Local)", "A quiet local, observant and occasionally offering advice.", llm, logger);

  const town_square = new Environment("A bustling town square with a few stalls and a well.", logger);

  const simulation = new Simulation({agents:[agent1, agent2, agent3], environment:town_square, numTurns:1, logger});
  simulation.run()
}