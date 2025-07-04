import OpenAI from "openai";
import { ActionSpec, GroundedEnvironment } from "../types";

export function createItemType(name: string) {
  return Symbol.for(name);
}

const InventoryAdjustTool: OpenAI.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'adjust_inventory_item',
    description: 'Adjusts the inventory for a character',
    parameters: {
      type: 'object',
      required: ['actor', 'operation', 'count'],
      properties: {
        'actor': {
          type: 'string',
          description: 'the actor whose inventory is changing',
        },
        'operation': {
          type: 'string',
          description: 'whether it is increasing or decreasing',
          enum: ['add', 'subtract']
        },
        'count': {
          type: 'number',
          description: 'how much to add or subtract from the value'
        }
      }
    }
  },
  // execute: (args: ToolCallArgs) => {
  //   const upperBound = args['upper_bound'];
  //   const number = Math.floor(Math.random() * parseInt(upperBound));
  //   return Promise.resolve(number.toString());
  // },
};

// async function inventoryAdjust(prompt: string) {
//   const A = new AgentModel(
//     AgentType.EMPTY,
//     1,
//     '',
//     ModelId.GEMMA_INSTRUCT,
//     []
//   )
//   return '';
// }

export class EnvironmentInventory implements GroundedEnvironment {
  private readonly count: Map<symbol, Map<symbol, number>> = new Map();

  constructor(readonly actors: symbol[]) {
    actors.forEach(a => this.count.set(a, new Map()));
  }

  async contextForActor(actor: symbol, actionSpec: ActionSpec) {
    const list = Array.from<[symbol, number]>(this.count.get(actor)!.entries())
      .map(([item, count]) => `${Symbol.keyFor(item)}: ${count}`);
    return list.join('\n');
  }

  setCount(agent: symbol, item: symbol, count: number) {
    this.count.get(agent)!.set(item, count);
  }

  async resolve(actor: symbol, actionSpec: ActionSpec, proposedAction: string) {
    // Adjust inventories as appropriate

    return {
      isChanged: false,
      description: 'tbd'
    }
  }
}