import * as fs from 'fs';

// Only read files once and story the result in-memory
const groundingPromptPromise = fs.promises.readFile('./modules/study-group/prompts/gm_grounding.txt', 'utf8');

function injectVariables(template: string, variables: GroundingPromptVariables) {
    Object.entries(variables).forEach(([key, value]) => {
      template = template.replaceAll('${' + key + '}', value);
    });
  return template;
}

export interface GroundingPromptVariables {
  world: string;
  agentName: string;
  agentRole: string;
  proposedAction: string;
}

export async function createGroundingPrompt(variables: GroundingPromptVariables) {
   return injectVariables(await groundingPromptPromise, variables);
}
