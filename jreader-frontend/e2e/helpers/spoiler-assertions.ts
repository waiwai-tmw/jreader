/**
 * Helper functions for spoiler state assertions in e2e tests
 * These helpers encapsulate common patterns for verifying spoiler reveal/hide state
 */

import { expect, Page } from '@playwright/test'

/**
 * Verify that a search result header is visible and contains the expected term
 */
export async function expectSearchResultFor(page: Page, term: string) {
  const resultHeader = page.locator('h2[id^="sp-anchor-"]').first()
  await expect(resultHeader).toBeVisible({ timeout: 5000 })
  await expect(resultHeader).toContainText(term)
}

/**
 * Verify that a spoilered dictionary is currently hidden (showing reveal button)
 * Only checks visible buttons to avoid counting buttons from hidden layers
 */
export async function expectSpoileredDictHidden(page: Page, expectedCount: number = 1) {
  const revealButtons = page.locator('button:has-text("Click to reveal definition"):visible')
  await expect(revealButtons).toHaveCount(expectedCount, { timeout: 5000 })
}

/**
 * Verify that a spoilered dictionary is currently revealed (showing hide button)
 * Only checks visible buttons to avoid counting buttons from hidden layers
 */
export async function expectSpoileredDictRevealed(page: Page, expectedCount: number = 1) {
  const hideButtons = page.locator('button:has-text("Hide"):visible')
  await expect(hideButtons).toHaveCount(expectedCount, { timeout: 5000 })
}

/**
 * Reveal a spoilered dictionary by clicking the reveal button
 */
export async function revealSpoileredDict(page: Page) {
  const revealButtons = page.locator('button:has-text("Click to reveal definition")')
  await revealButtons.first().click()
  await page.waitForTimeout(300)
}

/**
 * Perform a new search by typing in the search input field
 */
export async function performSearchViaInput(page: Page, searchTerm: string) {
  const searchInput = page.locator('input[type="text"]').first()
  await searchInput.clear()
  await searchInput.fill(searchTerm)
  await page.waitForTimeout(500)

  // Verify the search loaded
  await expectSearchResultFor(page, searchTerm)

  // Wait for DOM to fully render after search results load
  await page.waitForTimeout(300)
}

/**
 * Verify that breadcrumb navigation shows the expected number of items
 * Useful for confirming recursive searches created a new layer
 */
export async function expectBreadcrumbCount(page: Page, expectedCount: number) {
  const breadcrumbs = page.locator('[data-testid="breadcrumb-navigation"] button')
  await expect(breadcrumbs).toHaveCount(expectedCount, { timeout: 5000 })
}

/**
 * Verify that only visible spoilered dicts are hidden (in current layer)
 * This is important for multi-layer tests where hidden layers have their own buttons
 */
export async function expectVisibleSpoileredDictHidden(page: Page, expectedCount: number = 1) {
  const revealButtons = page.locator('button:has-text("Click to reveal definition"):visible')
  await expect(revealButtons).toHaveCount(expectedCount, { timeout: 5000 })
}
