import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 API: Checking admin status...')

    // Get username from cookie
    const username = request.cookies.get('jreader_username')?.value

    if (!username) {
      console.log('❌ API: No username found in cookie')
      return NextResponse.json({ isAdmin: false }, { status: 401 })
    }

    console.log('👤 API: Username:', username)

    // Check if username matches admin username from environment
    const adminUsername = process.env.ADMIN_USERNAME
    console.log('🔑 API: Admin username from env:', adminUsername)

    if (!adminUsername) {
      console.log('⚠️ API: ADMIN_USERNAME environment variable not set, admin features disabled')
      return NextResponse.json({ isAdmin: false })
    }

    const isAdmin = username === adminUsername
    console.log('👑 API: Is admin:', isAdmin)

    return NextResponse.json({ isAdmin })
  } catch (error) {
    console.error('❌ API: Error checking admin status:', error)
    return NextResponse.json({ isAdmin: false }, { status: 500 })
  }
}
