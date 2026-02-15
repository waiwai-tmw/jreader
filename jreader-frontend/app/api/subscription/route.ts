import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'

import { db, users } from '@/db'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const username = cookieStore.get('jreader_username')?.value

    if (!username) {
      return NextResponse.json({ tier: 0, isSubscribed: false })
    }

    const user = await db
      .select({ tier: users.tier })
      .from(users)
      .where(eq(users.username, username))
      .limit(1)

    const tier = user[0]?.tier ?? 0
    const isSubscribed = tier >= 1

    return NextResponse.json({ tier, isSubscribed })
  } catch (error) {
    console.error('Subscription check error:', error)
    return NextResponse.json({ tier: 0, isSubscribed: false })
  }
}
