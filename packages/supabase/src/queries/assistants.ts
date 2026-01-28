import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';
import type { Assistant } from '@ai-life-os/contracts';
import { nullToUndefined, transformMetadata } from '../utils/row-transformer';

type DbAssistant = Database['public']['Tables']['assistants']['Row'];
type DbAssistantInsert = Database['public']['Tables']['assistants']['Insert'];
type DbAssistantUpdate = Database['public']['Tables']['assistants']['Update'];

function toAssistant(row: DbAssistant): Assistant {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: nullToUndefined(row.description),
    systemPrompt: nullToUndefined(row.system_prompt),
    provider: row.provider as 'openai',
    model: row.model,
    temperature: Number(row.temperature),
    maxTokens: nullToUndefined(row.max_tokens),
    status: row.status as 'active' | 'inactive',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: transformMetadata(row.metadata),
  };
}

export async function createAssistant(
  client: SupabaseClient<Database>,
  data: Omit<Assistant, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Assistant> {
  const insert: DbAssistantInsert = {
    user_id: data.userId,
    name: data.name,
    description: data.description,
    system_prompt: data.systemPrompt,
    provider: data.provider,
    model: data.model,
    temperature: data.temperature,
    max_tokens: data.maxTokens,
    status: data.status,
    metadata: data.metadata,
  };

  const { data: row, error } = await client
    .from('assistants')
    .insert(insert)
    .select()
    .single();

  if (error) throw error;
  return toAssistant(row);
}

export async function updateAssistant(
  client: SupabaseClient<Database>,
  id: string,
  data: Partial<Omit<Assistant, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<Assistant> {
  const update: DbAssistantUpdate = {
    name: data.name,
    description: data.description,
    system_prompt: data.systemPrompt,
    model: data.model,
    temperature: data.temperature,
    max_tokens: data.maxTokens,
    status: data.status,
    metadata: data.metadata,
    updated_at: new Date().toISOString(),
  };

  const { data: row, error } = await client
    .from('assistants')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return toAssistant(row);
}

export async function getUserAssistants(
  client: SupabaseClient<Database>,
  userId: string
): Promise<Assistant[]> {
  const { data, error } = await client
    .from('assistants')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(toAssistant);
}

export async function deleteAssistant(
  client: SupabaseClient<Database>,
  id: string
): Promise<void> {
  const { error } = await client.from('assistants').delete().eq('id', id);
  if (error) throw error;
}
