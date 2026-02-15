import { NextResponse } from 'next/server'
import { count } from 'drizzle-orm'

import { db, webnovel } from '@/db'

export async function GET() {
  try {
    const result = await db.select({ count: count() }).from(webnovel)
    const totalCount = result[0]?.count ?? 0

    return NextResponse.json({ totalCount })
  } catch (error) {
    console.error('Webnovel count API error:', error)
    return NextResponse.json({ totalCount: 0 })
  }
}
