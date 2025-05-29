export const INFO_PREFIX = '[info]';

// Somewhat arbitrary, but the default value was insanely low
export const CONTEXT_LENGTH = 16000;
export const MAX_ITERATIONS = 10;

export interface AgentResponse {
  type: 'info' | 'text';
  content: string;
}

export function info(content: string): AgentResponse {
  const f = content.split('\n').map(line =>  `${INFO_PREFIX} ${line}`);
  return {
    type: 'info',
    content: f.join('\n')
  }
}

export function text(content: string) : AgentResponse {
  return {
    type: 'text',
    content
  }
}