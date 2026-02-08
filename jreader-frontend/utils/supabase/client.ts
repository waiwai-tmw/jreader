import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function getMetadata() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    // Only log session in development and not too frequently
    if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) {
      console.log('Session:', session);
    }
    
    return {
      'accessToken': session?.access_token || ''
    }
}