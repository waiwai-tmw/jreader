/**
 * Fake auth adapter for E2E tests
 * Returns a mock authenticated user without touching Supabase
 */

export const FAKE_TEST_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'e2e-test@jreader.local',
  global_name: 'E2E Test User',
  avatar_url: 'https://example.com/avatar.jpg',
}

export function isFakeAuthEnabled(): boolean {
  // Check for the environment variable set by Playwright
  if (typeof process !== 'undefined') {
    if (process.env.E2E_FAKE_AUTH === 'true') {
      return true
    }
  }

  // Client-side check: look for a marker set by a meta tag or window variable
  if (typeof window !== 'undefined') {
    const meta = document.querySelector('meta[name="e2e-fake-auth"]')
    if (meta?.getAttribute('content') === 'true') {
      return true
    }
    if ((window as any).__E2E_FAKE_AUTH === true) {
      return true
    }
  }

  return false
}
