import { z } from 'zod';

// Metadata event - first event in stream, contains IDs of created messages
export const SSEMetaEventSchema = z.object({
  type: z.literal('meta'),
  userMessageId: z.string().uuid(),
  assistantMessageId: z.string().uuid(),
});

// Text chunk event - streaming content
export const SSEChunkEventSchema = z.object({
  type: z.literal('chunk'),
  content: z.string(),
});

// Complete event - final event with full content
export const SSECompleteEventSchema = z.object({
  type: z.literal('complete'),
  content: z.string(),
});

// Union type for all SSE events
export const SSEEventSchema = z.discriminatedUnion('type', [
  SSEMetaEventSchema,
  SSEChunkEventSchema,
  SSECompleteEventSchema,
]);

export type SSEMetaEvent = z.infer<typeof SSEMetaEventSchema>;
export type SSEChunkEvent = z.infer<typeof SSEChunkEventSchema>;
export type SSECompleteEvent = z.infer<typeof SSECompleteEventSchema>;
export type SSEEvent = z.infer<typeof SSEEventSchema>;
