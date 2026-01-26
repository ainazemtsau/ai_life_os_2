import { z } from 'zod';

// Domain model: assistants with name, model, systemPrompt
// Fields are additive - new fields can be added without breaking existing code
export const AssistantSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  systemPrompt: z.string().optional(),
  provider: z.enum(['openai']).default('openai'),
  model: z.string().default('gpt-5-mini'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().positive().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  // z.string().datetime() validates strict ISO 8601 format for API string serialization
  createdAt: z.string().datetime(),
  // z.string().datetime() validates strict ISO 8601 format for API string serialization
  updatedAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export type Assistant = z.infer<typeof AssistantSchema>;
