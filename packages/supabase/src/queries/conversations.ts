import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';
import type { Conversation } from '@ai-life-os/contracts';

type DbConversation = Database['public']['Tables']['conversations']['Row'];
type DbConversationInsert = Database['public']['Tables']['conversations']['Insert'];
type DbConversationUpdate = Database['public']['Tables']['conversations']['Update'];

function toConversation(row: DbConversation): Conversation {
  return {
    id: row.id,
    userId: row.user_id,
    assistantId: row.assistant_id,
    title: row.title ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: row.metadata as Record<string, unknown> | undefined,
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
