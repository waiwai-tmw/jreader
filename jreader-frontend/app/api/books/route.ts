import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getUserBooks, getUserWebnovels } from '@/lib/db-helpers'
import { getBookCoverUrl, getWebnovelCoverUrl } from '@/lib/storage'
import { encodeFilename } from '@/utils/filename'

export async function GET(request: NextRequest) {
  try {
    // Get username from cookie
    const username = request.cookies.get('jreader_username')?.value

    if (!username) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Fetch regular uploaded books
    const books = await getUserBooks(username)

    // Fetch user's webnovels
    const webnovels = await getUserWebnovels(username)

    // Combine regular books and webnovels
    const allBooks = []

    // Add regular uploaded books
    const regularBooks = books.map(book => ({
      supabase_upload_id: book.id,
      filename: book.directory_name,
      title: book.title,
      author: book.author,
      totalPages: book.total_pages,
      coverPath: book.cover_path
        ? getBookCoverUrl(book.user_id, book.id, book.cover_path)
        : null,
      isWebnovel: false,
      webnovelUrl: null
    }))
    allBooks.push(...regularBooks)

    // Add webnovels
    const webnovelBooks = webnovels.map(uw => ({
      supabase_upload_id: uw.id,
      filename: uw.directory_name,
      title: uw.title,
      author: uw.author,
      totalPages: uw.total_pages,
      coverPath: uw.cover_path
        ? getWebnovelCoverUrl(uw.id, uw.cover_path)
        : null,
      isWebnovel: true,
      webnovelUrl: uw.url
    }))
    allBooks.push(...webnovelBooks)

    // Sort all books by creation date (most recent first)
    // For now, webnovels first, then regular books
    allBooks.sort((a, b) => {
      if (a.isWebnovel && !b.isWebnovel) return -1
      if (!a.isWebnovel && b.isWebnovel) return 1
      return 0
    })

    return NextResponse.json({ books: allBooks })
  } catch (error: any) {
    console.error('Error fetching books:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
