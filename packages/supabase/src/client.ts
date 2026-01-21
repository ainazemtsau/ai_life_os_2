import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import type { Database } from './types';
import { getSupabaseConfig } from './env';

export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  return createSupabaseBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
