import { Page } from '@playwright/test'

/**
 * Ensure fake auth is enabled for this page
 * The app checks for window.__E2E_FAKE_AUTH to enable fake auth mode
 */
export async function ensureFakeAuthEnabled(page: Page) {
  await page.addInitScript(() => {
    // Signal to the app that fake auth should be enabled
    ;(window as any).__E2E_FAKE_AUTH = true
  })
}
