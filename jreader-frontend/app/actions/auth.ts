'use server'

import { redirect } from 'next/navigation'

import { getSiteUrl } from '@/utils/getSiteUrl'
import { createClient } from '@/utils/supabase/server'

export async function signInWithDiscord() {
  const supabase = await createClient()
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: `${getSiteUrl()}/auth/callback`
    }
  })

  if (error) {
    throw error
  }

  if (data.url) {
    redirect(data.url)
  }
} 