import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getModel, models } from '../src/config';
import { buildSystemPrompt } from '../src/prompts';

describe('AI Configuration', () => {
  describe('getModel', () => {
    it('property: returns correct model for all ModelIds', () => {
      const modelIds = Object.keys(models) as Array<keyof typeof models>;
      fc.assert(
        fc.property(fc.constantFrom(...modelIds), (modelId) => {
          const model = getModel(modelId);
          expect(model).toBeDefined();
          expect(model).toBe(models[modelId]);
        })
      );
    });
  });

  describe('buildSystemPrompt', () => {
    it('returns base prompt when context is undefined', () => {
      const base = 'Base prompt';
      expect(buildSystemPrompt(base, undefined)).toBe(base);
    });

    it('returns base prompt when context is empty string', () => {
      const base = 'Base prompt';
      expect(buildSystemPrompt(base, '')).toBe(base);
      expect(buildSystemPrompt(base, '   ')).toBe(base);
    });
  });
});
