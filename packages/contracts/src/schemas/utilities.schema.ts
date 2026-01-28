import { z } from 'zod';

const MessageSchema = z.object({
  role: z.string(),
  content: z.string(),
});

export const TitleGeneratorInputSchema = z.object({
  conversationId: z.string().uuid(),
  messages: z.array(MessageSchema).min(1),
});

export const TitleGeneratorOutputSchema = z.object({
  title: z.string().max(60),
});

export type TitleGeneratorInput = z.infer<typeof TitleGeneratorInputSchema>;
export type TitleGeneratorOutput = z.infer<typeof TitleGeneratorOutputSchema>;
