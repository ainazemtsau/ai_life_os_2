import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@ai-life-os/supabase';
import { chatWorkflow } from './chat.workflow';

export interface BranchWorkflowInput {
  client: SupabaseClient<Database>;
  originalMessageId: string;
  newContent: string;
  abortSignal?: AbortSignal;
}

export async function* branchWorkflow(input: BranchWorkflowInput) {
  const { client, originalMessageId, newContent, abortSignal } = input;

  const { data: original, error: fetchError } = await client
    .from('messages')
    .select('parent_id, conversation_id')
    .eq('id', originalMessageId)
    .single();

  if (fetchError) throw fetchError;

  yield* chatWorkflow({
    client,
    conversationId: original.conversation_id,
    content: newContent,
    parentMessageId: original.parent_id,
    abortSignal,
  });
}
