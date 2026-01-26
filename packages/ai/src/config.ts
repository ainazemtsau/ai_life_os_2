import { Mastra } from '@mastra/core';
import { openai } from '@ai-sdk/openai';

export const models = {
  'gpt-5-mini': openai('gpt-5-mini'),
} as const;

export type ModelId = keyof typeof models;

export function getModel(modelId: string) {
  if (!(modelId in models)) {
    throw new Error(`Invalid model: ${modelId}`);
  }
  return models[modelId as ModelId];
}

export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'gpt-5-mini': 128000,
};

export function getContextWindow(modelId: string): number {
  return MODEL_CONTEXT_WINDOWS[modelId] ?? 128000;
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
