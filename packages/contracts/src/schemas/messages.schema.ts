import { z } from 'zod';
import { MessageSchema } from './chat.schema';

export const EditMessageRequestSchema = z.object({
  newContent: z.string().min(1),
});

export const SiblingsResponseSchema = z.object({
  messages: z.array(MessageSchema),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.record(z.unknown()).optional(),
});

export type EditMessageRequest = z.infer<typeof EditMessageRequestSchema>;
