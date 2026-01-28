import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';
import type { Conversation } from '@ai-life-os/contracts';
import { nullToUndefined, transformMetadata } from '../utils/row-transformer';

type DbConversation = Database['public']['Tables']['conversations']['Row'];
type DbConversationInsert = Database['public']['Tables']['conversations']['Insert'];
type DbConversationUpdate = Database['public']['Tables']['conversations']['Update'];

function toConversation(row: DbConversation): Conversation {
  return {
    id: row.id,
    userId: row.user_id,
    assistantId: row.assistant_id,
    title: nullToUndefined(row.title),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: transformMetadata(row.metadata),
  };
}

export async function createConversation(
  client: SupabaseClient<Database>,
  data: {
    userId: string;
    assistantId: string;
    title?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<Conversation> {
  const insert: DbConversationInsert = {
    user_id: data.userId,
    assistant_id: data.assistantId,
    title: data.title,
    metadata: data.metadata,
  };

  const { data: row, error } = await client
    .from('conversations')
    .insert(insert)
    .select()
    .single();

  if (error) throw error;
  return toConversation(row);
}

export async function updateConversation(
  client: SupabaseClient<Database>,
  id: string,
  data: {
    title?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<Conversation> {
  const update: DbConversationUpdate = {
    title: data.title,
    metadata: data.metadata,
    updated_at: new Date().toISOString(),
  };

  const { data: row, error } = await client
    .from('conversations')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return toConversation(row);
}

export async function getUserConversations(
  client: SupabaseClient<Database>,
  userId: string
): Promise<Conversation[]> {
  const { data, error } = await client
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data.map(toConversation);
}

export async function deleteConversation(
  client: SupabaseClient<Database>,
  id: string
): Promise<void> {
  const { error } = await client.from('conversations').delete().eq('id', id);
  if (error) throw error;
}

export async function updateConversationTitle(
  client: SupabaseClient<Database>,
  id: string,
  title: string
): Promise<boolean> {
  // Atomic update: only update if title_edited_at IS NULL (no race condition)
  const { data, error } = await client
    .from('conversations')
    .update({
      title,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .is('title_edited_at', null)
    .select('id')
    .single();

  if (error && error.code !== 'PGRST116') throw error;

  // PGRST116 = no rows returned (title was manually edited)
  return data !== null;
}

export async function setTitleManuallyEdited(
  client: SupabaseClient<Database>,
  id: string
): Promise<void> {
  const { error } = await client
    .from('conversations')
    .update({ title_edited_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}
