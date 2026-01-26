export function getSupabaseConfig() {
  // Server-side: prefer SUPABASE_URL (Docker internal network)
  // Client-side: use NEXT_PUBLIC_SUPABASE_URL (browser access)
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required');
  }

  if (!supabaseAnonKey) {
    throw new Error('SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
  }

  return { supabaseUrl, supabaseAnonKey };
}
