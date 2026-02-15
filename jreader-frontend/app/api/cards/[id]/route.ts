import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { updateCard } from '@/lib/db-helpers'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get username from cookie
    const username = request.cookies.get('jreader_username')?.value

    if (!username) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const cardId = parseInt(params.id)
    if (isNaN(cardId)) {
      return NextResponse.json({ error: 'Invalid card ID' }, { status: 400 })
    }

    // Parse request body
    const body = await request.json()
    const updates = body.updates

    if (!updates) {
      return NextResponse.json({ error: 'Updates are required' }, { status: 400 })
    }

    // Update the card
    const updatedCard = await updateCard(username, cardId, updates)

    if (!updatedCard) {
      return NextResponse.json({ error: 'Card not found or not authorized' }, { status: 404 })
    }

    return NextResponse.json({ card: updatedCard })
  } catch (error: any) {
    console.error('Error updating card:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
