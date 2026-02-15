import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getUserPreferences, upsertUserPreferences } from '@/lib/db-helpers'

export async function GET(request: NextRequest) {
  try {
    // Get username from cookie
    const username = request.cookies.get('jreader_username')?.value

    if (!username) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Fetch user preferences
    const preferences = await getUserPreferences(username)

    if (!preferences) {
      // Return null to indicate no preferences found (client will create defaults)
      return NextResponse.json({ preferences: null })
    }

    // Convert database format to client format
    const formattedPreferences = {
      dictionaryOrder: preferences.term_order ? preferences.term_order.split(',') : [],
      disabledDictionaries: preferences.term_disabled ? preferences.term_disabled.split(',') : [],
      spoilerDictionaries: preferences.term_spoiler ? preferences.term_spoiler.split(',') : [],
      freqDictionaryOrder: preferences.freq_order ? preferences.freq_order.split(',') : [],
      freqDisabledDictionaries: preferences.freq_disabled ? preferences.freq_disabled.split(',') : [],
      shouldHighlightKanjiInSearch: preferences.should_highlight_kanji_in_search ?? true,
      shouldHighlightKanjiInText: preferences.should_highlight_kanji_in_text ?? true
    }

    return NextResponse.json({ preferences: formattedPreferences })
  } catch (error: any) {
    console.error('Error fetching preferences:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get username from cookie
    const username = request.cookies.get('jreader_username')?.value

    if (!username) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { preferences } = body

    if (!preferences) {
      return NextResponse.json({ error: 'Preferences are required' }, { status: 400 })
    }

    // Convert client format to database format
    const dbPreferences = {
      term_order: preferences.dictionaryOrder.join(','),
      term_disabled: preferences.disabledDictionaries.join(','),
      term_spoiler: preferences.spoilerDictionaries.join(','),
      freq_order: preferences.freqDictionaryOrder.join(','),
      freq_disabled: preferences.freqDisabledDictionaries.join(','),
      should_highlight_kanji_in_search: preferences.shouldHighlightKanjiInSearch ?? true,
      should_highlight_kanji_in_text: preferences.shouldHighlightKanjiInText ?? true
    }

    // Upsert preferences
    await upsertUserPreferences(username, dbPreferences)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating preferences:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
