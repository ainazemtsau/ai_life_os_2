import { z } from 'zod';
import { createUtility } from './base';
import {
  TitleGeneratorOutputSchema,
} from '@ai-life-os/contracts';
import type { TitleGeneratorOutput } from '@ai-life-os/contracts';

const MessageSchema = z.object({
  role: z.string(),
  content: z.string(),
});

const InternalTitleGeneratorInputSchema = z.object({
  messages: z.array(MessageSchema).min(1),
});

type InternalTitleGeneratorInput = z.infer<typeof InternalTitleGeneratorInputSchema>;

const titleGeneratorUtility = createUtility<
  InternalTitleGeneratorInput,
  TitleGeneratorOutput
>({
  name: 'title-generator',
  tier: 2,
  prompt: (input) => {
    const firstMessage = input.messages[0];
    const context = input.messages
      .slice(0, 2)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    return `Generate a concise, descriptive title (max 60 characters) for this conversation based on the content:\n\n${context}\n\nRespond with JSON: {"title": "your title here"}`;
  },
  inputSchema: InternalTitleGeneratorInputSchema,
  outputSchema: TitleGeneratorOutputSchema,
});

export async function generateAITitle(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const result = await titleGeneratorUtility.execute({ messages });
  if (result.success) {
    return result.data.title;
  }
  throw new Error(result.error);
}
