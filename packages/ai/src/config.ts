import { Mastra } from '@mastra/core';
import { openai } from '@ai-sdk/openai';

export const models = {
  'gpt-4o': openai('gpt-4o'),
  'gpt-4o-mini': openai('gpt-4o-mini'),
} as const;

export type ModelId = keyof typeof models;

export function getModel(modelId: ModelId) {
  return models[modelId];
}

export const mastra = new Mastra({
  agents: {},
  workflows: {},
  tools: {},
  logs: {
    provider: 'CONSOLE',
    level: 'INFO',
  },
});
