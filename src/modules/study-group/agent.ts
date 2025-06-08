import { Logger } from "./run-sim";
import {ActingComponent, ContextComponent, EntityWithComponents, ActionSpec} from "./types";

// This ensures that any LLM you use with the Agent class will have a 'generate' method.
export interface LLM {
  generate(prompt: string): Promise<string>; // Assuming generate is async and returns a string
}


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

  constructor({actingComponent, contextComponents, logger , llm}: AgentConstructorParams) {
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

  async observe(observation: string) {
    this.contextComponents.forEach(component => {
      component.preObserve(observation);
      component.postObserve();
      component.update();
    })
  }

  async act(actionSpec: ActionSpec): Promise<string> {
    let sb = [];
    for (let c of this.contextComponents) {
      const context = await c.preAction(actionSpec);
      if (context) {
        sb.push(context);
      }
    }
    const result = await this.llm.generate(sb.join('\n\n\n'));
    this.contextComponents.forEach(component => {
      component.postAction(result);
    })
    return result;
  }
}