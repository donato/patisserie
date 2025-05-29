import { Tool, ToolCall } from 'ollama';
import { tavily } from "@tavily/core";


// TODO - add a tool for 'ask user to confirm, or for more info'

type ToolCallArgs = { [key: string]: any };
export interface MyTool extends Tool {
  execute: (args: ToolCallArgs) => Promise<string>;
}

export const DiceTool: MyTool = {
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
  },
  execute: (args: ToolCallArgs) => {
    const upperBound = args['upper_bound'];
    const number = Math.floor(Math.random() * parseInt(upperBound));
    return Promise.resolve(number.toString());
  },
};

export const NoActionTool: MyTool = {
  type: 'function',
  function: {
    name: 'no_information_needed',
    description: 'No more observations are needed to answer the Question',
    parameters: {
      type: 'string',
      required: [],
      properties: {
        'secret': {
          type: 'string',
          // This is semi-teasing, because the secret will be included in context
          // of the next text completion.
          description: 'secret information to include in your thought process',
        }
      }
    }
  },
  execute: (args: ToolCallArgs) => {
    return Promise.resolve('I will give the final answer now.');
  },
};

// Step 1. Instantiating your TavilyClient
const tvly = tavily({ apiKey: "tvly-YOUR_API_KEY" });
export const InternetSearch: MyTool = {
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
  },
  execute: async (args: ToolCallArgs) => {
    const query = args['search_query'];

    console.log('tv search: ' + query);
    const options = {};
    const response = await tvly.search(query, options);

    let sb = '';
    for (let result of response.results) {
      sb += `URL: ${result.url}`;
      sb += `\n`;
      sb += `Raw Content: ${result.rawContent}\n`;
      sb += `\n\n`;
    }
    console.log(sb);
    return Promise.resolve(sb);
  },
}

const ALL_TOOLS = [DiceTool, NoActionTool];

export function triggerToolCall(call: ToolCall) {
  for (const t of ALL_TOOLS) {
    if (t.function.name == call.function.name) {
      return t.execute(call.function.arguments);
    }
  }
  return Promise.resolve("No matching tool found");
}


export function executeToolCalls(toolCalls: ToolCall[]) {
  const promises = toolCalls.map(triggerToolCall);
  return Promise.all(promises);
}

export function createToolPrompt(tools: Tool[]) {
  return `To use a tool, you must write:
  
Action: {"function_name": "...", "arguments": "..."}\nObservation: <results of the function call>\n\n` +
    `Available Tools:\n` + tools.map(t => {
      const { parameters, name, description } = t.function;
      const simpleDict: { [k: string]: string } = {};
      for (const p in parameters.properties) {
        simpleDict[p] = parameters.properties[p].type;
      }
      const args = JSON.stringify(simpleDict);
      return `  ${name}: ${description}. Required parameters: ${args}`;
    }).join('\n') + `\n\n\n`;
}