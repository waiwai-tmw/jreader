import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // For self-hosted setup, we're using a simple approach:
  // - Check if username exists in cookie
  // - Protected routes redirect to /login if no username

  const username = request.cookies.get('jreader_username')?.value

  // List of protected routes that require authentication
  const protectedRoutes = [
    '/settings',
    '/stats',
    '/admin'
  ]

  const isProtectedRoute = protectedRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )

  // If accessing a protected route without auth, redirect to login
  if (isProtectedRoute && !username) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', request.nextUrl.pathname + request.nextUrl.search)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/files (file serving routes)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/files|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}