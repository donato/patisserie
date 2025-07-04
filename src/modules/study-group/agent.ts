import { Logger } from "./run-sim";
import { LLM } from "./types";
import { ActingComponent, ContextComponent, EntityWithComponents, ActionSpec } from "./types";
import { collectContext } from "./components/utils";


interface AgentConstructorParams {
  actingComponent: ActingComponent;
  contextComponents: ContextComponent[];
  logger: Logger;
  llm: LLM;
}

export class Agent implements EntityWithComponents {
  actingComponent: ActingComponent;
  contextComponents: ContextComponent[];

  readonly logger: Logger;
  readonly llm: LLM;

  constructor({ actingComponent, contextComponents, logger, llm }: AgentConstructorParams, readonly id = Symbol()) {
    this.actingComponent = actingComponent;
    this.contextComponents = contextComponents;
    this.logger = logger;
    this.llm = llm;

    // Connect all components to self. 
    [actingComponent, ...contextComponents].forEach(c => c.setEntity(this));
  }

  getComponent<T>(componentType: any): T {
    for (const c of this.contextComponents) {
      if (c instanceof componentType) {
        return c as T;
      }
    }
    throw "Unexpected component type access"
  }

  async observe(observations: string[]) {
    this.contextComponents.forEach(component => {
      component.receiveObservations(observations);
    });
  }

  async act(actionSpec: ActionSpec): Promise<string> {
    const contextMap = await collectContext(this.contextComponents, actionSpec);
    return await this.actingComponent.getActionAttempt(contextMap, actionSpec);
  }
}