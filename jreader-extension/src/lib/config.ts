// Supabase configuration loaded from environment variables
export const SUPABASE_URL = process.env['SUPABASE_URL'];
export const SUPABASE_ANON_KEY = process.env['SUPABASE_ANON_KEY'];

// Validate that required environment variables are set
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Supabase configuration missing:');
  console.warn('SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.warn('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✓' : '✗');
  console.warn('Please check your .env.local file');
}

// Helper function to check if configuration is complete
export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

// Helper function to get configuration object
export function getSupabaseConfig(): SupabaseConfig {
  return {
    url: SUPABASE_URL!,
    anonKey: SUPABASE_ANON_KEY!
  };
}
