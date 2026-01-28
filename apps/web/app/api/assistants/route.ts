import { getUserAssistants, createAssistant } from '@ai-life-os/supabase';
import { AssistantSchema } from '@ai-life-os/contracts';
import type { Assistant } from '@ai-life-os/contracts';
import {
  createGetHandler,
  createApiHandler,
  requireParam,
} from '@/lib/api/route-handler';

const CreateAssistantSchema = AssistantSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  metadata: true,
});

export const GET = createGetHandler<{ assistants: Assistant[] }>({
  handler: async ({ client, searchParams }) => {
    const userId = requireParam(searchParams, 'userId');
    const assistants = await getUserAssistants(client, userId);
    return { assistants };
  },
});

export const POST = createApiHandler({
  schema: CreateAssistantSchema,
  handler: async ({ input, client }) => {
    const assistant = await createAssistant(client, input);
    return { assistant };
  },
});
