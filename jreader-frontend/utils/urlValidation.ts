/**
 * Validate that URL is internal (same origin)
 * Used for security validation to prevent open redirect attacks
 */
export function isValidInternalUrl(url: string): boolean {
  try {
    const urlObj = new URL(url, window.location.origin)
    return urlObj.origin === window.location.origin
  } catch {
    // Validation failed; return false
    return false
  }
}
