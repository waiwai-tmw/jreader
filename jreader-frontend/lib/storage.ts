/**
 * Storage helpers for file URLs
 * For self-hosted deployment, we don't need signed URLs - just regular paths
 * Files are served via Next.js API routes from the local filesystem
 */

/**
 * Get URL for a book cover image
 * @param userId User ID
 * @param bookId Book/upload ID
 * @param coverPath Relative path to cover image (e.g., "cover.jpg")
 */
export function getBookCoverUrl(userId: string, bookId: string, coverPath: string): string {
  return `/api/files/uploads/${userId}/${bookId}/${coverPath}`
}

/**
 * Get URL for a webnovel cover image
 * @param webnovelId Webnovel ID
 * @param coverPath Relative path to cover image
 */
export function getWebnovelCoverUrl(webnovelId: string, coverPath: string): string {
  return `/api/files/webnovel/${webnovelId}/${coverPath}`
}

/**
 * Get URL for any file in the uploads directory
 * @param path Full path relative to uploads root
 */
export function getUploadFileUrl(path: string): string {
  return `/api/files/uploads/${path}`
}

/**
 * Get URL for any file in the webnovel directory
 * @param path Full path relative to webnovel root
 */
export function getWebnovelFileUrl(path: string): string {
  return `/api/files/webnovel/${path}`
}
