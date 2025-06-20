// This ensures that any LLM you use with the Agent class will have a 'generate' method.
export interface LLM {
  generate(prompt: string): Promise<string>; // Assuming generate is async and returns a string
}

export enum OutputType {
  FREE_TEXT,
  NUMERIC_VALUE,
  MULTIPLE_CHOICE,
}

export interface ActionSpecSimple {
  callToAction: string;
  outputType: OutputType.FREE_TEXT | OutputType.NUMERIC_VALUE;
}

export interface ActionSpecWithMultipleChoices {
  callToAction: string;
  outputType: OutputType.MULTIPLE_CHOICE;
  multipleChoiceOptions: string[];
}
export type ActionSpec = ActionSpecWithMultipleChoices | ActionSpecSimple;

export interface Entity {
  act(actionSpec: ActionSpec): Promise<string>;

  observe(observation: string): Promise<void>;
}

export interface EntityWithComponents extends Entity {
  getComponent<T>(componentType: any): T;
}

//
export class BaseComponent {
  private entity: EntityWithComponents | undefined;

  setEntity(e: EntityWithComponents) {
    if (this.entity) { throw "setEntity should only be called once";}
    this.entity = e;
  }

  getEntity() {
    // type-cast to simplify code elsewhere
    return this.entity!;
  }
}

/** A component that generates prompt context, both for agents and GM. */
export interface ContextComponent extends BaseComponent {
  actionContext(actionSpec: ActionSpec): Promise<string>;
  receiveObservation(attempt: string): Promise<void>;
}

export interface ActingComponent extends BaseComponent{
  getActionAttempt(contextMap: {[componentName: string]: string},
                   actionSpec: ActionSpec): Promise<string>;
}
