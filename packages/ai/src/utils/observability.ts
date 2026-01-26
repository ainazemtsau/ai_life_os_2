/**
 * Observability utilities for LLM workflows.
 *
 * Modular approach: callbacks are created per-request, enabling
 * persistence and extensibility.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@ai-life-os/supabase';
import { createUsageMetric } from '@ai-life-os/supabase';

export interface TokenTrackerOptions {
  client: SupabaseClient<Database>;
  conversationId: string;
  messageId?: string | null;
  model: string;
}

/**
 * Creates onFinish callback for Vercel AI SDK streamText.
 *
 * Automatically persists token usage when LLM stream completes successfully.
 * Does NOT fire on abort or error (Invariant #1).
 *
 * @param options - Database client, conversation/message IDs, model name
 * @returns onFinish callback compatible with streamText({ onFinish })
 *
 * SDK auto-aggregates usage, reducing tracking code.
 */
// Invariant: onFinish fires ONLY on successful completion. Does NOT fire on abort or error.
export function createTokenTracker(options: TokenTrackerOptions) {
  const { client, conversationId, messageId, model } = options;

  return async (result: { usage?: { promptTokens: number; completionTokens: number; totalTokens: number } }) => {
    if (!result.usage) {
      console.warn('[Observability] onFinish called without usage data');
      return;
    }

    const { promptTokens, completionTokens, totalTokens } = result.usage;

    try {
      await createUsageMetric(client, {
        conversationId,
        messageId: messageId ?? null,
        model,
        inputTokens: promptTokens,
        outputTokens: completionTokens,
        totalTokens,
      });
    } catch (error) {
      console.error('[Observability] Failed to save usage metric:', error);
    }
  };
}

/**
 * Creates onError callback for Vercel AI SDK streamText.
 *
 * Logs LLM-level errors (rate limits, model unavailable).
 * Workflow errors (DB, abort) are handled by catch blocks in calling workflows.
 *
 * Structured format (timestamp, level, context, message, stack, metadata)
 * enables monitoring tool integration (CloudWatch, Sentry). Consistent
 * format across all LLM error paths (Decision Log: Error log structure).
 *
 * @param context - Optional context label for error logs
 * @returns onError callback compatible with streamText({ onError })
 */
export function createErrorLogger(context?: string) {
  return (error: unknown) => {
    const errorObj = error instanceof Error ? error : new Error(String(error));

    console.error('[AI Error]', {
      context: context ?? 'unknown',
      message: errorObj.message,
      stack: errorObj.stack,
      timestamp: new Date().toISOString(),
    });
  };
}

export type { UsageMetricInput, ConversationUsage } from '@ai-life-os/supabase';
export { createUsageMetric, getConversationUsage } from '@ai-life-os/supabase';
