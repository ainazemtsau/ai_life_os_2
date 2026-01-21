import { z } from 'zod';

// Zod provides runtime validation + TypeScript inference
// Single source of truth for chat message structure across packages
export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  chatId: z.string().uuid(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  // z.string().datetime() validates strict ISO 8601 format for API string serialization
  createdAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export const ChatSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  assistantId: z.string().uuid(),
  title: z.string().optional(),
  // z.string().datetime() validates strict ISO 8601 format for API string serialization
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type Chat = z.infer<typeof ChatSchema>;
