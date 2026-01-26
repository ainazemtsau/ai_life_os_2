import { z } from 'zod';

export const UsageMetricSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  messageId: z.string().uuid().nullable(),
  model: z.string().min(1),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  totalTokens: z.number().int().min(0),
  createdAt: z.date(),
});

export type UsageMetric = z.infer<typeof UsageMetricSchema>;

export const ConversationUsageSchema = UsageMetricSchema.pick({
  conversationId: true,
}).extend({
  totalInputTokens: z.number().int().min(0),
  totalOutputTokens: z.number().int().min(0),
  totalTokens: z.number().int().min(0),
  messageCount: z.number().int().min(0),
});

export type ConversationUsage = z.infer<typeof ConversationUsageSchema>;
