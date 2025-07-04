// This ensures that any LLM you use with the Agent class will have a 'generate' method.
export interface LLM {
  freeText(prompt: string): Promise<string>;
  json(prompt: string): Promise<string>;
  choose(prompt: string, options:string[]): Promise<string>;
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

  observe(observations: string[]): Promise<void>;
}

export interface EntityWithComponents extends Entity {
  id: symbol;

  getComponent<T>(componentType: any): T;
}

export class BaseComponent {
  constructor(readonly id = Symbol()) {}

  private entity: EntityWithComponents | undefined;

  // TODO() - this entity pattern is used in Concordia to allow components
  // to cross-communicate by looking at their owner through getEntity().getComponent<T>(...).
  // For example this allows memory to be a component shared with an observations
  // component. Ideally we can solve this type of problem in a more constrained way.
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
  receiveObservations(attempt: string[]): Promise<void>;
}

export interface ActingComponent extends BaseComponent{
  getActionAttempt(contextMap: Map<Symbol, string>,
                   actionSpec: ActionSpec): Promise<string>;
}

export interface GroundedEnvironmentUpdate {
  isChanged: boolean;
  description: string,
}

export interface GroundedEnvironment {
  /* Resolves an agents proposed action by:
   *   - Updating its internal state
   *   - Returning an event to be logged by the GM about changes in state.
   */
  resolve(actor: symbol, actionSpec: ActionSpec, proposedAction: string): Promise<GroundedEnvironmentUpdate>;
}

export interface Scenario {
  /**
   * Any information the gamemaster needs in order to set up the scenario.
   * This information will be filtered through partialObservations to the
   * agents.
   */
  getPremise(): string;

  /**
   * Return the actors who should be included in the next scene.
   */
  getNextActorsToSimulate(actors: EntityWithComponents[]): Promise<{actors: EntityWithComponents[], actionSpec: ActionSpec}>;
}