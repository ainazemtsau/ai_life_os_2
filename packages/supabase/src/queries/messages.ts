import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';
import type { Message } from '@ai-life-os/contracts';
import { transformMetadata } from '../utils/row-transformer';

type DbMessage = Database['public']['Tables']['messages']['Row'];
type DbMessageInsert = Database['public']['Tables']['messages']['Insert'];
type DbMessageUpdate = Database['public']['Tables']['messages']['Update'];

function toMessage(row: DbMessage): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    parentId: row.parent_id,
    role: row.role as 'user' | 'assistant' | 'system',
    content: row.content,
    status: row.status as Message['status'],
    createdAt: row.created_at,
    metadata: transformMetadata(row.metadata),
  };
}

export async function createMessage(
  client: SupabaseClient<Database>,
  data: {
    conversationId: string;
    parentId?: string | null;
    role: 'user' | 'assistant' | 'system';
    content: string;
    status?: Message['status'];
    metadata?: Record<string, unknown>;
  }
): Promise<Message> {
  const insert: DbMessageInsert = {
    conversation_id: data.conversationId,
    parent_id: data.parentId ?? null,
    role: data.role,
    content: data.content,
    status: data.status ?? 'complete',
    metadata: data.metadata,
  };

  const { data: row, error } = await client
    .from('messages')
    .insert(insert)
    .select()
    .single();

  if (error) throw error;
  return toMessage(row);
}

const VALID_TRANSITIONS: Record<Message['status'], Message['status'][]> = {
  pending: ['streaming', 'error', 'stopped'],
  streaming: ['complete', 'error', 'stopped'],
  complete: [],
  error: [],
  stopped: [],
};

export async function updateMessage(
  client: SupabaseClient<Database>,
  id: string,
  data: {
    content?: string;
    status?: Message['status'];
    metadata?: Record<string, unknown>;
  }
): Promise<Message> {
  if (data.status) {
    const { data: current, error: fetchError } = await client
      .from('messages')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const currentStatus = current.status as Message['status'];
    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed.includes(data.status)) {
      throw new Error(
        `Invalid status transition: ${currentStatus} -> ${data.status}`
      );
    }
  }

  const update: DbMessageUpdate = {
    content: data.content,
    status: data.status,
    metadata: data.metadata,
  };

  const { data: row, error } = await client
    .from('messages')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return toMessage(row);
}

export async function getMessageTree(
  client: SupabaseClient<Database>,
  conversationId: string,
  leafMessageId?: string
): Promise<Message[]> {
  if (!leafMessageId) {
    const { data, error } = await client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data.map(toMessage);
  }

  const path: DbMessage[] = [];
  let currentId: string | null = leafMessageId;

  while (currentId) {
    const { data, error } = await client
      .from('messages')
      .select('*')
      .eq('id', currentId)
      .single();

    if (error) throw error;
    path.unshift(data);
    currentId = data.parent_id;
  }

  return path.map(toMessage);
}

export async function getConversationMessages(
  client: SupabaseClient<Database>,
  conversationId: string
): Promise<Message[]> {
  const { data, error } = await client
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data.map(toMessage);
}

export async function getSiblingMessages(
  client: SupabaseClient<Database>,
  messageId: string
): Promise<Message[]> {
  const { data: msg, error: msgError } = await client
    .from('messages')
    .select('parent_id')
    .eq('id', messageId)
    .single();

  if (msgError) throw msgError;

  const { data, error } = await client
    .from('messages')
    .select('*')
    .eq('parent_id', msg.parent_id ?? null)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data.map(toMessage);
}
