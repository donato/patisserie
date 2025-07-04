//835
import { ConstantComponent } from "../components/constant-component";
import { IdentityContextComponent } from "../components/identity-context-component";
import { ActionSpec, ActionSpecSimple, BaseComponent, ContextComponent, EntityWithComponents, GroundedEnvironment, LLM, OutputType, Scenario } from "../types";

const RULES_FOR_EVERYONE = `
  You are playing a social deception game with {playerCount} players.
  Each player is randomly assigned a role, and through the course of the game
  they will try to guess each-others roles.

  KILLER: (1 player) - Wins the game by being the last one standing
  DETECTIVE: (1 player) - Wins the game if the KILLER is defeated
  CITIZEN: ({citizenCount} players) - Wins the game if the KILLER is defeated.

  The game is turn-based, with each round consisting of these phases:
  1. The player with the KILLER role secretly chooses a player to eliminate
  2. The DETECTIVE may choose a single player and receive a YES/NO answer for whether that player is the KILLER
  3. The entire group wakes up in the morning and learns which player had been killed.
  4. The entire group has an open discussion to try to discover who the KILLER is, by analyzing what eachother says
      + Note that players may lie about anything
  5. When the discussion dies down, the group votes, one at a time for who should be executed for the accusation of being the killer
      + Note that voting starts with the player to the left of the newly deceased. Whomever receives the most votes is executed (removed from the game)
  6. If the KILLER is removed, then the CITIZENS and DETECTIVES win. If there are only 2 players remaining, the KILLER wins. Otherwise, return to step 1.
`;
const RULES_FOR_KILLER = 'You have been assigned the KILLER role.';
const RULES_FOR_DETECTIVE = 'You have been assigned the DETECTIVE role.';
const RULES_FOR_MISA = 'You have been assigned the MISA role.';
const RULES_FOR_CITIZEN = 'You have been assigned the CITIZEN role.';

export interface GameParameters {
  actors: EntityWithComponents[]
}

export enum PlayerRole {
  DETECTIVE = "Detective",
  KILLER = "Killer",
  CITIZEN = "Citizen",
  MISA = "Accomplice",
}

function shuffleArray<T>(array: T[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function dealCards(playerCount: number) {
  const deck = []
  deck.length = 0;
  deck.push(PlayerRole.KILLER);
  if (playerCount > 3) {
    deck.push(PlayerRole.DETECTIVE);
  }
  if (playerCount > 6) {
    deck.push(PlayerRole.MISA);
  }
  while (deck.length < playerCount) {
    deck.push(PlayerRole.CITIZEN);
  }
  shuffleArray(deck);
  return deck;
}

enum Phase {
  DRAW_CARDS,
  KILLER,
  DETECTIVE,
  MISA,
  REVEAL_DEATH,
  DISCUSSION,
  VOTING,
  VOTE_RESOLUTION,
};

function entityToName(e: PlayerWrapper) {
    return e.actor.getComponent<IdentityContextComponent>(IdentityContextComponent).name;
}

interface PlayerWrapper { actor: EntityWithComponents, role: PlayerRole }


export class DeceptionGame implements Scenario, GroundedEnvironment {
  private phase: Phase;
  // private actors: EntityWithComponents[];
  private livingActors: Array<PlayerWrapper> = [];
  // private readonly deck: PlayerRole[];
  private readonly llm: LLM;

  constructor({ actors, llm }: { actors: EntityWithComponents[], llm: LLM }) {
    this.phase = Phase.DRAW_CARDS;
    this.llm = llm;
    const deck = dealCards(actors.length);
    actors = actors.slice();
    while (deck.length) {
      this.livingActors.push({
        actor: actors.shift()!,
        role: deck.shift()!
      })
    }
  }

  private nextPhase() {
    switch (this.phase) {
      case Phase.DRAW_CARDS:
        this.phase = Phase.KILLER;
        return;
      case Phase.KILLER:
        this.phase = Phase.DETECTIVE;
        return;
      case Phase.DETECTIVE:
        this.phase = Phase.REVEAL_DEATH; // update for MISA
        return;
      case Phase.REVEAL_DEATH:
        this.phase = Phase.DISCUSSION;
        return;
      case Phase.DISCUSSION:
        if (Math.random() > 0.5) {
          this.phase = Phase.VOTING; // decide whether to continue, or move-on
        }
        return;
      case Phase.VOTING:
        this.phase = Phase.VOTE_RESOLUTION
        return;
      case Phase.VOTE_RESOLUTION:
        this.phase = Phase.KILLER; // decide whether game is won
        return;
    }
  }

  private getActor(role: PlayerRole) {
    const o = this.livingActors.find(c => c.role == role);
    return o?.actor!;
  }

  private getOptionsForKillerToTarget() {
    const killerActor = this.getActor(PlayerRole.KILLER);
    const options = this.livingActors!.filter(a => a.actor != killerActor);
    return options.map(entityToName);
  }

  // Scenario API
  getPremise() {
    const allNames = this.livingActors.map(o => `${entityToName(o)}: ${o.role}`);
    return `The premise is a town square where merchants sell their goods. The active players and their roles in the game are:\n${allNames.join('\n')}`;
  }

  // Scenario API
  async getNextActorsToSimulate(allActors: EntityWithComponents[]): Promise<{ actors: EntityWithComponents[], actionSpec: ActionSpec }> {
    this.nextPhase();

    switch (this.phase) {
      case Phase.KILLER:
        const killerActor = this.getActor(PlayerRole.KILLER);
        const optionNames = this.getOptionsForKillerToTarget();
        return {
          actors: [killerActor],
          actionSpec: {
            callToAction: `It is the Phase 1. Choose which player to eliminate, their names are: ${optionNames}`,
            outputType: OutputType.FREE_TEXT,
          }
        }
      case Phase.DETECTIVE:
        this.phase = Phase.REVEAL_DEATH; // update for MISA
        break;
      case Phase.REVEAL_DEATH:
        this.phase = Phase.DISCUSSION;
        break;
      case Phase.DISCUSSION:
        if (Math.random() > 0.5) {
          this.phase = Phase.VOTING; // decide whether to continue, or move-on
        }
        break;
      case Phase.VOTING:
        this.phase = Phase.VOTE_RESOLUTION
        break;
      case Phase.VOTE_RESOLUTION:
        this.phase = Phase.KILLER; // decide whether game is won
        break;
    }
    // TODO(): Can filter out actors who are not relevant to the scene.
    const action = 'What do you say or do next as ${name} (${role})? Be concise and stay in character.';
    return {
      actors: this.livingActors.map(o => o.actor),
      actionSpec: {
        callToAction: action,
        outputType: OutputType.FREE_TEXT
      } as ActionSpecSimple
    };
  }


  // GroundedEnvironment API
  async resolve(actor: symbol, actionSpec: ActionSpec, proposedAction: string) {
    if (this.phase == Phase.KILLER) {
      const optionNames = this.getOptionsForKillerToTarget();
      const p = `The killer recorded these thoughts:\n${proposedAction}\n\n\nWhich person was chose to be executed by kira?`;
      const result = await this.llm.choose(p, optionNames)
      // todo - remove player from game 

      // todo - provide an observation for the GM to log
      const description = `${result} was eliminated!`;
      return {
        isChanged: true,
        description
      }
    }
    return {
      isChanged: false,
      description: ''
    };
  }
}

export class DeceptionGameContextComponent extends ConstantComponent {
  constructor() {
    super(RULES_FOR_EVERYONE);
  }
}