import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { upsertKanjiState } from '@/lib/db-helpers'

export async function POST(request: NextRequest) {
  try {
    // Get username from cookie
    const username = request.cookies.get('jreader_username')?.value

    if (!username) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { kanjiList } = body

    if (!Array.isArray(kanjiList)) {
      return NextResponse.json({ error: 'kanjiList must be an array' }, { status: 400 })
    }

    // Upsert each kanji as known (state = 1)
    for (const kanji of kanjiList) {
      await upsertKanjiState(username, kanji, 1, true) // state 1 = KNOWN, is_import = true
    }

    return NextResponse.json({ success: true, imported: kanjiList.length })
  } catch (error: any) {
    console.error('Error importing kanji:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
