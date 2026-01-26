/**
 * Usage metrics tracking for LLM token consumption and cost analysis.
 *
 * Separate from message queries to enable independent retention policies
 * and clean aggregation without joining message content.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';

export interface UsageMetricInput {
  conversationId: string;
  messageId?: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ConversationUsage {
  conversationId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  messageCount: number;
}

/**
 * Records token usage for a single LLM interaction.
 *
 * Stores all three token values as-is. totalTokens may exceed
 * inputTokens + outputTokens when reasoning tokens are present
 * (Claude Opus extended thinking). Database constraints enforce
 * non-negative values; totalTokens >= inputTokens + outputTokens
 * is valid per LLM API contract.
 *
 * @param client - Supabase client
 * @param input - Usage data from LLM response
 * @returns Created usage metric row
 * @throws Supabase error if insert fails or constraints violated
 */
// Invariant: Stores all three token values as-is. totalTokens may exceed inputTokens + outputTokens (reasoning tokens valid).
export async function createUsageMetric(
  client: SupabaseClient<Database>,
  input: UsageMetricInput
) {
  const { data, error } = await client
    .from('usage_metrics')
    .insert({
      conversation_id: input.conversationId,
      message_id: input.messageId ?? null,
      model: input.model,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      total_tokens: input.totalTokens,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Aggregates all token usage for a conversation.
 *
 * Sums totalTokens (not inputTokens + outputTokens) for actual cost.
 * When reasoning tokens are present, totalTokens reflects true billing;
 * inputTokens + outputTokens shows non-reasoning cost for comparison.
 *
 * @param client - Supabase client
 * @param conversationId - Conversation UUID
 * @returns Summed token counts and message count
 * @throws Supabase error if query fails
 */
export async function getConversationUsage(
  client: SupabaseClient<Database>,
  conversationId: string
): Promise<ConversationUsage> {
  const { data, error } = await client
    .from('usage_metrics')
    .select('input_tokens, output_tokens, total_tokens')
    .eq('conversation_id', conversationId);

  if (error) throw error;

  const totals = data.reduce((acc, row) => ({
    totalInputTokens: acc.totalInputTokens + row.input_tokens,
    totalOutputTokens: acc.totalOutputTokens + row.output_tokens,
    totalTokens: acc.totalTokens + row.total_tokens,
  }), { totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0 });

  return { conversationId, ...totals, messageCount: data.length };
}
