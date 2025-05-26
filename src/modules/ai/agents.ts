import fs from 'fs'
import YAML from 'yaml'
import nunjucks from 'nunjucks';
import { DiceTool, MyTool, NoActionTool } from './tools';

export enum ModelId {
  DEEP_SEEK = 'deepseek-r1:1.5b',

  LLAMA = 'llama3.2:3b',
  LLAMA_INSTRUCT = 'llama3.2:3b-instruct-q8_0',

  GEMMA = 'gemma3:4b',
  GEMMA_INSTRUCT = 'gemma3:4b-it-q8_0',

  GRANITE = 'granite3.3:8b',

  QWEN2_5_CODER = 'qwen2.5-coder:7b-instruct-q6_K'
}

const THINKING_MODELS = [ModelId.DEEP_SEEK];
const TOOLCALLING_MODELS = [ModelId.LLAMA, ModelId.LLAMA_INSTRUCT, ModelId.GRANITE];


export function isThinking(id: ModelId) {
  return THINKING_MODELS.includes(id);
}

export function useManualToolCalling(agent: Agent) {
  return agent.tools.length && !TOOLCALLING_MODELS.includes(agent.model_id);
}

export function useNativeToolCalling(agent: Agent) {
  return agent.tools.length && TOOLCALLING_MODELS.includes(agent.model_id);

}

export enum AgentType {
  REACT,
  CODING,
  ITALIA_BEGINNER,
  ITALIA_CONVERSATIONAL,
  ITALIA_TRANSLATE_PHRASES,
}

export class Agent {
  constructor(
    readonly type: AgentType,
    readonly temperature: number,
    readonly system_prompt: string,
    readonly model_id: ModelId,
    readonly tools: MyTool[] = [],
    readonly enable_code = false,
    readonly prefillText = '') { }

  public toString = (): string => {
    return `Agent (type: ${this.type}, model_id: ${this.model_id})`;
  }
}

interface Prompts {
  prompt_react: string,
  prompt_coding: string,
  prompt_italia_beginner: string,
  prompt_italia_conversational: string
  prompt_translate_phrases: string
}

export class AgentFactory {
  constructor(readonly prompts: Prompts) { }

  create(agentType: AgentType) {
    switch (agentType) {
      case AgentType.REACT:
        const prefillText = 'Question: ';
        return new Agent(agentType, 1.0, this.prompts.prompt_react, ModelId.GEMMA_INSTRUCT, /* tools= */[DiceTool, NoActionTool], /* enable_code= */ false, prefillText);
      case AgentType.CODING:
        const promptTemplate = this.prompts.prompt_coding;
        var res = nunjucks.renderString(promptTemplate, { tools: [], agents: [] });
        return new Agent(agentType, 1.0, res, ModelId.GEMMA_INSTRUCT, /* tools= */[], /* enable_code= */ true);
      case AgentType.ITALIA_BEGINNER:
        return new Agent(agentType, 1.0, this.prompts.prompt_italia_beginner, ModelId.GEMMA_INSTRUCT, /* tools= */[DiceTool, NoActionTool]);
      case AgentType.ITALIA_CONVERSATIONAL:
        return new Agent(agentType, 1.0, this.prompts.prompt_italia_conversational, ModelId.GEMMA_INSTRUCT);
      case AgentType.ITALIA_TRANSLATE_PHRASES:
        return new Agent(agentType, 1.0, this.prompts.prompt_translate_phrases, ModelId.GEMMA_INSTRUCT);
      default:
        throw new Error(`Unknown agent type: ${agentType}`);
    }
  }
}

export async function createAgentFactory() {
  const allFiles = await Promise.all([
    fs.promises.readFile('./modules/ai/prompts/react_agent.yml', 'utf8'),
    fs.promises.readFile('./modules/ai/prompts/smolagents_code_agent.yml', 'utf8'),
    fs.promises.readFile('./modules/ai/prompts/italia_beginner.yml', 'utf8'),
    fs.promises.readFile('./modules/ai/prompts/italia_agent.yml', 'utf8'),
  ]);
  const allYaml = allFiles.map((f) => YAML.parse(f));
  const [prompt_react, prompt_coding, prompt_italia_beginner, prompt_italia_conversational] = allYaml.map(y => y.system_prompt);
  const prompt_translate_phrases = allYaml[3].split_phrases;
  return new AgentFactory({
    prompt_coding, prompt_italia_beginner, prompt_italia_conversational, prompt_react,
    prompt_translate_phrases
  });
}
