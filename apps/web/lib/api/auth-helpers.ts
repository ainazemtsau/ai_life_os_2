import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// Phase 1: No auth, just validate message exists
export async function validateMessageAccess(
  client: SupabaseClient,
  messageId: string
): Promise<{ valid: true } | { valid: false; response: Response }> {
  const { data: message, error: fetchError } = await client
    .from('messages')
    .select('id, conversation_id')
    .eq('id', messageId)
    .single();

  if (fetchError || !message) {
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'Message not found', code: 'NOT_FOUND' },
        { status: 404 }
      ),
    };
  }

  return { valid: true };
}
