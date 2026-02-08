/**
 * Helper functions for setting up user preferences in e2e tests
 */

import { Page } from '@playwright/test'

/**
 * Mock user preferences with Jitendex marked as a spoilered dictionary
 * This is useful for testing spoiler state behavior
 */
export async function mockUserPreferencesWithSpoileredDict(page: Page) {
  console.log('[E2E] Setting up mock user preferences with spoilered dict')

  // Set up localStorage cache with mock preferences
  await page.addInitScript(() => {
    // The fake auth creates a user with this ID (from lib/auth/fake-adapter.ts)
    const FAKE_USER_ID = '00000000-0000-0000-0000-000000000001'

    const mockPreferences = {
      dictionaryOrder: ['Jitendex.org [2024-11-24]#2024.11.24.0', 'Daijisen#1'],
      disabledDictionaries: [],
      spoilerDictionaries: ['Jitendex.org [2024-11-24]#2024.11.24.0'], // Mark Jitendex as spoilered using the proper format
      freqDictionaryOrder: [],
      shouldHighlightKanjiInSearch: false
    }

    // Store in localStorage with the expected key format from dictionary page
    // The key format is: user-preferences-{user.id}
    console.log('[Browser] Setting localStorage with user preferences')
    localStorage.setItem(
      `user-preferences-${FAKE_USER_ID}`,
      JSON.stringify(mockPreferences)
    )
    console.log('[Browser] User preferences set in localStorage:', localStorage.getItem(`user-preferences-${FAKE_USER_ID}`))
  })
}
