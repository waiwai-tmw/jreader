import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getUserCards } from '@/lib/db-helpers'

export async function GET(request: NextRequest) {
  try {
    // Get username from cookie
    const username = request.cookies.get('jreader_username')?.value

    if (!username) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get query parameters for sorting and filtering
    const { searchParams } = new URL(request.url)
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortDirection = searchParams.get('sortDirection') || 'desc'
    const showOnlyNeedingUpdate = searchParams.get('showOnlyNeedingUpdate') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Fetch all user cards
    let cards = await getUserCards(username)

    // Filter if needed
    if (showOnlyNeedingUpdate) {
      cards = cards.filter(card =>
        card.synced_at && new Date(card.updated_at) > new Date(card.synced_at)
      )
    }

    // Sort
    const orderColumn = sortBy === 'sync_status' ? 'synced_at' : sortBy
    cards.sort((a: any, b: any) => {
      const aVal = a[orderColumn]
      const bVal = b[orderColumn]

      if (aVal === null && bVal === null) return 0
      if (aVal === null) return sortDirection === 'asc' ? -1 : 1
      if (bVal === null) return sortDirection === 'asc' ? 1 : -1

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
      }
    })

    // Get total count
    const totalCount = cards.length

    // Paginate
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedCards = cards.slice(startIndex, endIndex)

    return NextResponse.json({
      cards: paginatedCards,
      totalCount,
      totalPages: Math.ceil(totalCount / limit)
    })
  } catch (error: any) {
    console.error('Error fetching cards:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
