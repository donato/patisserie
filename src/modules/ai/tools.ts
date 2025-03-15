import { Tool, ToolCall } from 'ollama';


type ToolCallArgs = { [key: string]: any };
interface MyTool {
  toolDefinition: Tool;
  execute: (args: ToolCallArgs) => Promise<string>;
}

export const DiceTool: MyTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'generate_random_number',
      description: 'Used to generate a random number',
      parameters: {
        type: 'number',
        required: ['upper_bound'],
        properties: {
          'upper_bound': {
            type: 'number',
            description: 'the max random number to generate',
            // enum: ['s']
          }
        }
      }
    }
  },
  execute: (args: ToolCallArgs) => {
    const upperBound = args['upper_bound'];
    const number = Math.floor(Math.random() * parseInt(upperBound));
    return Promise.resolve(number.toString());
  },
};

const ALL_TOOLS = [DiceTool];

export function getToolDefinitions() {
  return ALL_TOOLS.map(t => t.toolDefinition);
}

function triggerToolCall(call: ToolCall) {
  for (const t of ALL_TOOLS) {
    console.log(t.toolDefinition.function.name, call.function.name )
    if (t.toolDefinition.function.name == call.function.name) {
      return t.execute(call.function.arguments);
    }
  }
  return Promise.resolve("No matching tool found");
}

export function executeToolCalls(toolCalls: ToolCall[]) {
  const toolResults: Array<Array<string>> = [];
  console.log(JSON.stringify(toolCalls));
  const promises = toolCalls.map(triggerToolCall);
  return Promise.all(promises);
}