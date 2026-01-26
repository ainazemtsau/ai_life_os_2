/**
 * Property-based tests for observability utilities.
 *
 * Property tests via fast-check follow config.test.ts pattern.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { createTokenTracker, createErrorLogger } from '../src/utils/observability';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@ai-life-os/supabase';

describe('Observability', () => {
  describe('createTokenTracker', () => {
    const mockClient = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
          })),
        })),
      })),
    } as unknown as SupabaseClient<Database>;

    beforeEach(() => {
      vi.clearAllMocks();
    });

    /**
     * Property: For any valid token counts (0-100000), tracker should persist metric.
     * Range rationale: max context ~200k tokens, split input/output.
     */
    it('property: creates metric for any valid usage', () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            promptTokens: fc.integer({ min: 0, max: 100000 }),
            completionTokens: fc.integer({ min: 0, max: 100000 }),
            totalTokens: fc.integer({ min: 0, max: 200000 }),
          }),
          async (usage) => {
            const tracker = createTokenTracker({
              client: mockClient,
              conversationId: '00000000-0000-0000-0000-000000000001',
              messageId: '00000000-0000-0000-0000-000000000002',
              model: 'gpt-5-mini',
            });

            await tracker({ usage });

            expect(mockClient.from).toHaveBeenCalledWith('usage_metrics');
          }
        )
      );
    });

    /**
     * Edge case: SDK contract guarantees usage, but defensive handling needed.
     * Should warn (not throw) and skip metric creation.
     */
    it('handles missing usage gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const tracker = createTokenTracker({
        client: mockClient,
        conversationId: '00000000-0000-0000-0000-000000000001',
        model: 'gpt-5-mini',
      });

      await tracker({});

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Observability] onFinish called without usage data'
      );
      expect(mockClient.from).not.toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    /**
     * Error handling: observability failure should not break user flow.
     */
    it('handles database errors gracefully', async () => {
      const errorClient = {
        from: vi.fn(() => ({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({ data: null, error: new Error('DB error') })
              ),
            })),
          })),
        })),
      } as unknown as SupabaseClient<Database>;

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const tracker = createTokenTracker({
        client: errorClient,
        conversationId: '00000000-0000-0000-0000-000000000001',
        model: 'gpt-5-mini',
      });

      await tracker({
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Observability] Failed to save usage metric:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('createErrorLogger', () => {
    /**
     * Property: For any error message, logger should capture without throwing.
     * Non-throwing critical: LLM errors must not crash workflow.
     */
    it('property: logs any error without throwing', () => {
      fc.assert(
        fc.property(fc.string(), (message) => {
          const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
          const logger = createErrorLogger('test-context');

          const error = new Error(message);
          expect(() => logger(error)).not.toThrow();

          expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[AI Error]',
            expect.objectContaining({
              context: 'test-context',
              message,
            })
          );
          consoleErrorSpy.mockRestore();
        })
      );
    });
  });
});
