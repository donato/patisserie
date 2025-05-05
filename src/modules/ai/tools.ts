import { Tool, ToolCall } from 'ollama';
import { tavily } from "@tavily/core";


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
      description: 'Generates a random number between 0 and an upper bound',
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

// Step 1. Instantiating your TavilyClient
const tvly = tavily({ apiKey: "tvly-YOUR_API_KEY" });
export const InternetSearch : MyTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'internet_search',
      description: 'Used to search the internet for more information',
      parameters: {
        type: 'string',
        required: ['search_query'],
        properties: {
          'search_query': {
            type: 'string',
            description: 'The search query',
            // enum: ['s']
          }
        }
      }
    }
  },
  execute: async (args: ToolCallArgs) => {
    const query = args['search_query'];

    console.log('tv search: '+ query);
    const options =  {};
    const response = await tvly.search(query, options);

    let sb = '';
    for (let result of response.results) {
        sb += `URL: ${result.url}`;
        sb += `\n`;
        sb += `Raw Content: ${result.rawContent}\n`;
        sb += `\n\n`;
    }
    console.log (sb);
    return Promise.resolve(sb);
  },
}

const ALL_TOOLS = [DiceTool];

export function getToolDefinitions() {
  return ALL_TOOLS.map(t => t.toolDefinition);
}

export function triggerToolCall(call: ToolCall) {
  for (const t of ALL_TOOLS) {
    if (t.toolDefinition.function.name == call.function.name) {
      return t.execute(call.function.arguments);
    }
  }
  return Promise.resolve("No matching tool found");
}

export function executeToolCalls(toolCalls: ToolCall[]) {
  const toolResults: Array<Array<string>> = [];
  const promises = toolCalls.map(triggerToolCall);
  return Promise.all(promises);
}

export function createToolPrompt(tools:Tool[]) {
  return 'Available Tools:\n' + tools.map(t => {
    const {parameters, name, description} = t.function;
    const args = JSON.stringify(parameters); 
    return `  ${name}: ${description}. Args: ${args}`;
  }).join('\n') + `\n\n\n`;
}