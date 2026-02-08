import { NextResponse } from 'next/server'

import { getSiteUrl } from '@/utils/getSiteUrl'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Redirect to a page that will check sessionStorage and redirect accordingly
      return NextResponse.redirect(`${getSiteUrl()}/auth/redirect-after-login?next=${encodeURIComponent(next)}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${getSiteUrl()}/auth/auth-code-error`)
}