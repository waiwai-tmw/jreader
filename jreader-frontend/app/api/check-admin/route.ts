import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 API: Checking admin status...')
    
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.error('❌ API: Supabase auth error:', error)
      return NextResponse.json({ isAdmin: false }, { status: 401 })
    }
    
    if (!user) {
      console.log('❌ API: No user found')
      return NextResponse.json({ isAdmin: false }, { status: 401 })
    }
    
    console.log('👤 API: User ID:', user.id)
    
    const adminUserId = process.env.ADMIN_SUPABASE_UID
    console.log('🔑 API: Admin UID from env:', adminUserId)
    
    if (!adminUserId) {
      console.error('❌ API: ADMIN_SUPABASE_UID environment variable not set')
      return NextResponse.json({ isAdmin: false }, { status: 500 })
    }
    
    const isAdmin = user.id === adminUserId
    console.log('👑 API: Is admin:', isAdmin)
    
    return NextResponse.json({ isAdmin })
  } catch (error) {
    console.error('❌ API: Error checking admin status:', error)
    return NextResponse.json({ isAdmin: false }, { status: 500 })
  }
}
