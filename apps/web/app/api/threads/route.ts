import { z } from 'zod';
import { getUserConversations, createConversation } from '@ai-life-os/supabase';
import type { Conversation } from '@ai-life-os/contracts';
import {
  createGetHandler,
  createApiHandler,
  requireParam,
} from '@/lib/api/route-handler';

const CreateThreadSchema = z.object({
  userId: z.string().uuid(),
  assistantId: z.string().uuid(),
});

export const GET = createGetHandler<{ conversations: Conversation[] }>({
  handler: async ({ client, searchParams }) => {
    const userId = requireParam(searchParams, 'userId');
    const conversations = await getUserConversations(client, userId);
    return { conversations };
  },
});

export const POST = createApiHandler({
  schema: CreateThreadSchema,
  handler: async ({ input, client }) => {
    const conversation = await createConversation(client, {
      userId: input.userId,
      assistantId: input.assistantId,
    });
    return { conversation };
  },
});
