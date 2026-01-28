import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@ai-life-os/supabase';

export interface MessageOperationInput {
  client: SupabaseClient<Database>;
  messageId: string;
  abortSignal?: AbortSignal;
}

export interface EditMessageInput extends MessageOperationInput {
  newContent: string;
}
