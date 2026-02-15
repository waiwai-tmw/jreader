/**
 * Client-side auth utilities
 * For use in React components (browser only)
 */

/**
 * Get the current username from localStorage
 * Returns null if not logged in
 */
export function getCurrentUsername(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('jreader_username')
}

/**
 * Check if user is currently authenticated
 */
export function isAuthenticated(): boolean {
  return getCurrentUsername() !== null
}

/**
 * Set the current username (and cookie)
 * Used during login
 */
export function setCurrentUsername(username: string): void {
  localStorage.setItem('jreader_username', username)
  // Also set cookie for server-side middleware
  document.cookie = `jreader_username=${encodeURIComponent(username)}; path=/; max-age=${60 * 60 * 24 * 365}`
}

/**
 * Clear the current username (and cookie)
 * Used during logout
 */
export function clearCurrentUsername(): void {
  localStorage.removeItem('jreader_username')
  document.cookie = 'jreader_username=; path=/; max-age=0'
}

/**
 * Check if a username is valid (simple validation)
 */
export function isValidUsername(username: string): boolean {
  // Must be 1-50 characters, alphanumeric plus underscore/hyphen
  const trimmed = username.trim()
  if (trimmed.length < 1 || trimmed.length > 50) return false

  const validPattern = /^[a-zA-Z0-9_-]+$/
  return validPattern.test(trimmed)
}
