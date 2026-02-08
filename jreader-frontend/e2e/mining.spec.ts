import { test, expect } from '@playwright/test'
import { ensureFakeAuthEnabled } from './helpers/auth'
import { initializeDatabaseMocks, mockCardInsertSuccess } from './helpers/database'

test('mining card creation requires definition selection', async ({ page }) => {
  // Enable fake auth mode before navigating
  await ensureFakeAuthEnabled(page)

  // Initialize and mock database calls
  await initializeDatabaseMocks(page)

  await page.goto('/dictionary')
  await expect(page).toHaveURL(/dictionary/)

  // Search for the term 魚 (fish)
  const searchInput = page.locator('input[type="text"]').first()
  await searchInput.fill('魚')

  // Wait for results to appear
  await expect(page.locator('button:has-text("魚")')).toBeVisible({ timeout: 5000 })

  // Click on the first term to view its definitions
  await page.locator('button:has-text("魚")').first().click()

  // Wait for the definitions to load
  await page.waitForTimeout(500)

  // Click the circle-plus button to mine a card WITHOUT checking any definitions
  // This should show an error about needing to select at least one definition
  const mineButton = page.locator('button[title="Create Anki card"]').first()
  await mineButton.click()

  // Wait for the Sonner error toast to appear
  await page.waitForTimeout(500)

  // Find the Sonner toast
  const toast = page.locator('li[data-sonner-toast]').first()
  await expect(toast).toBeVisible({ timeout: 3000 })

  // Extract and assert the error message
  const titleElement = toast.locator('[data-title]')
  await expect(titleElement).toContainText('No definitions selected')
})

test('mining card creation succeeds with definition selection', async ({ page }) => {
  // Enable fake auth mode before navigating
  await ensureFakeAuthEnabled(page)

  // Initialize and mock database calls
  await initializeDatabaseMocks(page)
  await mockCardInsertSuccess(page, {
    expression: '魚',
    reading: 'さかな'
  })

  await page.goto('/dictionary')
  await expect(page).toHaveURL(/dictionary/)

  // Search for the term 魚 (fish)
  const searchInput = page.locator('input[type="text"]').first()
  await searchInput.fill('魚')

  // Wait for results to appear
  await expect(page.locator('button:has-text("魚")')).toBeVisible({ timeout: 5000 })

  // Click on the first term to view its definitions
  await page.locator('button:has-text("魚")').first().click()

  // Wait for the definitions to load
  await page.waitForTimeout(500)

  // Click the checkbox to select a definition
  const checkbox = page.locator('button[role="checkbox"]').first()
  await checkbox.click()

  // Wait for the checkbox state to update
  await page.waitForTimeout(300)

  // Click the circle-plus button to mine a card
  const mineButton = page.locator('button[title="Create Anki card"]').first()
  await mineButton.click()

  // Wait for the success toast to appear
  await page.waitForTimeout(500)

  // Find the Sonner toast
  const toast = page.locator('li[data-sonner-toast]').first()
  await expect(toast).toBeVisible({ timeout: 3000 })

  // Extract and assert the success message
  const titleElement = toast.locator('[data-title]')
  await expect(titleElement).toContainText('Card created')
})
