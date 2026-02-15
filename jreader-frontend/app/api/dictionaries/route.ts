import { NextResponse } from 'next/server'
import { getAllDictionaries } from '@/lib/db-helpers'

export async function GET() {
  try {
    // Fetch all dictionaries from the database
    const dictionaries = await getAllDictionaries()

    return NextResponse.json({ dictionaries })
  } catch (error: any) {
    console.error('Error fetching dictionaries:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
