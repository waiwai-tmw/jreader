import { readFile } from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'

// MIME type mapping
const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.epub': 'application/epub+zip',
  '.pdf': 'application/pdf',
}

function getMimeType(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase()
  return MIME_TYPES[ext] || 'application/octet-stream'
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/')

    // Determine base directory based on first segment
    let baseDir: string
    let relativePath: string

    if (path.startsWith('uploads/')) {
      // Files uploaded by users
      baseDir = process.env.UPLOADS_DIR || './uploads'
      relativePath = path.substring('uploads/'.length)
    } else if (path.startsWith('webnovel/')) {
      // Webnovel files
      baseDir = process.env.WEBNOVEL_DIR || './webnovel'
      relativePath = path.substring('webnovel/'.length)
    } else {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    // Security: prevent directory traversal
    if (relativePath.includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    // Read the file
    const filePath = join(baseDir, relativePath)
    const file = await readFile(filePath)

    // Determine content type
    const contentType = getMimeType(filePath)

    // Return the file with appropriate headers
    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year (immutable files)
      },
    })
  } catch (error) {
    console.error('Error serving file:', error)

    // Check if file not found
    if ((error as any).code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
