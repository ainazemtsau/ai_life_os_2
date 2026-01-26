import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@ai-life-os/supabase';
import { chatWorkflow } from './chat.workflow';

export interface RegenerateWorkflowInput {
  client: SupabaseClient<Database>;
  assistantMessageId: string;
  abortSignal?: AbortSignal;
}

export async function* regenerateWorkflow(input: RegenerateWorkflowInput) {
  const { client, assistantMessageId, abortSignal } = input;

  const { data: assistantMsg, error: fetchError } = await client
    .from('messages')
    .select('parent_id, conversation_id')
    .eq('id', assistantMessageId)
    .single();

  if (fetchError) throw fetchError;

  if (!assistantMsg.parent_id) {
    throw new Error('Cannot regenerate: assistant message has no parent');
  }

  const { data: userMsg, error: userError } = await client
    .from('messages')
    .select('content')
    .eq('id', assistantMsg.parent_id)
    .single();

  if (userError) throw userError;

  yield* chatWorkflow({
    client,
    conversationId: assistantMsg.conversation_id,
    content: userMsg.content,
    parentMessageId: assistantMsg.parent_id,
    skipUserMessage: true,
    abortSignal,
  });
}
