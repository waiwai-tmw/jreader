/**
 * Helper functions for pagination assertions in e2e tests
 * These helpers encapsulate common patterns for verifying pagination state
 */

import { expect, Page } from '@playwright/test'

/**
 * Get the current visible pagination index (0-based)
 * Returns the index of the currently visible slide
 */
export async function getCurrentPaginationIndex(page: Page): Promise<number> {
  // Find all pagination dots
  const dots = page.locator('button[aria-label^="Go to slide"]')
  const count = await dots.count()

  // Find which dot is currently selected (has bg-foreground instead of bg-muted-foreground)
  for (let i = 0; i < count; i++) {
    const dot = dots.nth(i)
    const classes = await dot.getAttribute('class')
    if (classes?.includes('bg-foreground')) {
      return i
    }
  }

  return 0 // Default to 0 if no active dot found
}

/**
 * Click pagination next button
 */
export async function clickNextPaginationButton(page: Page) {
  const nextButton = page.locator('button[aria-label="Next slide"]')
  await expect(nextButton).toBeVisible({ timeout: 5000 })
  await nextButton.click()
  await page.waitForTimeout(300)
}

/**
 * Click pagination previous button
 */
export async function clickPreviousPaginationButton(page: Page) {
  const prevButton = page.locator('button[aria-label="Previous slide"]')
  await expect(prevButton).toBeVisible({ timeout: 5000 })
  await prevButton.click()
  await page.waitForTimeout(300)
}

/**
 * Click a specific pagination dot
 */
export async function clickPaginationDot(page: Page, index: number) {
  const dot = page.locator('button[aria-label="Go to slide"]').nth(index)
  await expect(dot).toBeVisible({ timeout: 5000 })
  await dot.click()
  await page.waitForTimeout(300)
}

/**
 * Verify that pagination index is at the expected value
 */
export async function expectPaginationIndex(page: Page, expectedIndex: number) {
  const currentIndex = await getCurrentPaginationIndex(page)
  await expect(currentIndex).toBe(expectedIndex)
}

/**
 * Get the total number of pagination dots (number of term groups)
 */
export async function getPaginationDotsCount(page: Page): Promise<number> {
  const dots = page.locator('button[aria-label^="Go to slide"]')
  return dots.count()
}

/**
 * Verify pagination is visible (footer with navigation controls)
 */
export async function expectPaginationVisible(page: Page) {
  const nextButton = page.locator('button[aria-label="Next slide"]')
  await expect(nextButton).toBeVisible({ timeout: 5000 })
}

/**
 * Verify pagination footer is NOT visible (only 1 result group)
 */
export async function expectPaginationNotVisible(page: Page) {
  const nextButton = page.locator('button[aria-label="Next slide"]')
  await expect(nextButton).not.toBeVisible({ timeout: 5000 })
}
