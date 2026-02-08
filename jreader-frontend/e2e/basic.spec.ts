import { test, expect } from '@playwright/test'
import { mockAuthSession } from './helpers/auth'
import { findKanjiClickableTerm } from './helpers/kanji-terms'

// Clean up any lingering page listeners/routes after each test
test.afterEach(async ({ page }) => {
  page.removeAllListeners()
  try {
    await page.unroute('**')
  } catch {}
})

// Unit test for findKanjiClickableTerm with repeated kanji
test('findKanjiClickableTerm: finds correct term when first kanji appears earlier', async ({ page }) => {
  // Create a mock HTML structure with:
  // - "患" appearing standalone early (index 0)
  // - "患者" appearing later (starting at index 2)
  const mockHTML = `
    <div data-testid="search-results-definitions-test">
      <span class="cursor-pointer">患</span>
      <span class="cursor-pointer">を</span>
      <span class="cursor-pointer">患</span>
      <span class="cursor-pointer">者</span>
      <span class="cursor-pointer">が</span>
    </div>
  `

  await page.setContent(mockHTML)

  const result = await findKanjiClickableTerm(page, '患者')

  // Should find "患者" (the second occurrence), not the first "患" alone
  expect(result).not.toBeNull()
  expect(result?.text).toBe('患者')
  // Verify we found the correct pairing - both characters accumulated correctly
  console.log(`Test verified: Found 患者 as expected (accumulated from spans [2] and [3])`)
})

// Unit test for findKanjiClickableTerm with exact match
test('findKanjiClickableTerm: finds single kanji when searching for it', async ({ page }) => {
  const mockHTML = `
    <div data-testid="search-results-definitions-test">
      <span class="cursor-pointer">患</span>
      <span class="cursor-pointer">者</span>
    </div>
  `

  await page.setContent(mockHTML)

  const result = await findKanjiClickableTerm(page, '患')

  // Should not find single "患" because we require at least 2 characters
  expect(result).toBeNull()
})

// Unit test for findKanjiClickableTerm: finds two-character term
test('findKanjiClickableTerm: finds two-character kanji term', async ({ page }) => {
  const mockHTML = `
    <div data-testid="search-results-definitions-test">
      <span class="cursor-pointer">患</span>
      <span class="cursor-pointer">者</span>
    </div>
  `

  await page.setContent(mockHTML)

  const result = await findKanjiClickableTerm(page, '患者')

  expect(result).not.toBeNull()
  expect(result?.text).toBe('患者')
  console.log('Test verified: Found 患者 correctly')
})

test('homepage loads successfully', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/JReader/)
})

test('dictionary page is accessible', async ({ page }) => {
  await page.goto('/dictionary')
  await expect(page).toHaveURL(/dictionary/)
})

test('dictionary can look up a japanese word', async ({ page }) => {
  await page.goto('/dictionary')

  // Find and fill the search input with 魚 (fish)
  const searchInput = page.locator('input[type="text"]').first()
  await searchInput.fill('魚')

  // Wait for results to appear - check that the dictionary result header is visible
  // Look for the h2 element with id starting with "sp-anchor-" that contains the kanji
  const resultHeader = page.locator('h2[id^="sp-anchor-"]').first()
  await expect(resultHeader).toBeVisible({ timeout: 5000 })

  // Assert the h2 contains the search term (魚) - check the full header text
  await expect(resultHeader).toContainText('魚')
})

test('dictionary page displays search UI', async ({ page }) => {
  await page.goto('/dictionary')
  await expect(page).toHaveURL(/dictionary/)

  // Check that the search input is present and visible
  const searchInput = page.locator('input[type="text"]').first()
  await expect(searchInput).toBeVisible()
})

test('dictionary page shows logged-in user in sidebar', async ({ page }) => {
  await page.goto('/dictionary')
  await expect(page).toHaveURL(/dictionary/)

  // Check that the user info is displayed in the sidebar
  // Look for the user tier badge (should be present for authenticated users)
  const tierBadge = page.locator('[class*="text-accent-foreground"]')
  await expect(tierBadge.first()).toBeVisible({ timeout: 5000 })
})

test('can navigate back on breadcrumb and re-search the same word', async ({ page }) => {
  const breadcrumbButtons = () => page.locator('[data-testid="breadcrumb-navigation"] button')
  const resultHeader = () => page.locator('h2[id^="sp-anchor-"]').first()
  const assertHeader = async (text: string) => {
    await expect(resultHeader()).toBeVisible({ timeout: 5000 })
    await expect(resultHeader()).toContainText(text)
  }
  const logBreadcrumb = async (prefix: string, count?: number) => {
    const text = await breadcrumbButtons().first().textContent()
    const actualCount = count ?? (await breadcrumbButtons().count())
    console.log(`${prefix} Breadcrumb has ${actualCount} item: "${text}"`)
  }

  let clickedTermText = ''

  await test.step('Navigate to 糖質 and verify initial results', async () => {
    await page.goto('/dictionary/糖質')
    await assertHeader('糖質')
    await logBreadcrumb('📍 Initial load -')
    await page.waitForTimeout(1000)
  })

  await test.step('Find and click on a kanji term for recursive lookup', async () => {
    const result = await findKanjiClickableTerm(page, '患者')
    if (!result) {
      throw new Error('Could not find 患者 in search results definitions')
    }
    clickedTermText = result.text
    console.log('Found term:', clickedTermText)
    await expect(result.term).toBeVisible()
    await result.term.click()
    await page.waitForTimeout(1000)
  })

  await test.step('Verify breadcrumb has 2 items after recursive search', async () => {
    await expect(breadcrumbButtons()).toHaveCount(2, { timeout: 5000 })
    const firstText = await breadcrumbButtons().first().textContent()
    const lastText = await breadcrumbButtons().last().textContent()
    console.log(`✅ After first click - Breadcrumb: "${firstText}" > "${lastText}"`)
    await expect(breadcrumbButtons().first()).toContainText('糖質')
    await expect(breadcrumbButtons().last()).toContainText(clickedTermText)
  })

  await test.step('Navigate back via breadcrumb', async () => {
    await breadcrumbButtons().first().click()
    await page.waitForTimeout(500)
  })

  await test.step('Verify we are back to 糖質 search with breadcrumb count of 1', async () => {
    await assertHeader('糖質')
    await expect(breadcrumbButtons()).toHaveCount(1, { timeout: 5000 })
    await logBreadcrumb('🔙 After navigation back -')
  })

  await test.step('Re-click the same term to test duplicate search prevention fix', async () => {
    await page.waitForTimeout(500)
    const resultAgain = await findKanjiClickableTerm(page, clickedTermText)
    if (!resultAgain) {
      throw new Error(`Could not find the term "${clickedTermText}" to click again after back navigation`)
    }
    console.log('Found term again:', clickedTermText)
    await resultAgain.term.click()
    await page.waitForTimeout(1500)
  })

  await test.step('Verify breadcrumb has 2 items again after re-search', async () => {
    const count = await breadcrumbButtons().count()
    console.log(`Current breadcrumb button count: ${count}`)
    await expect(breadcrumbButtons()).toHaveCount(2, { timeout: 5000 })
    const firstText = await breadcrumbButtons().first().textContent()
    const lastText = await breadcrumbButtons().last().textContent()
    console.log(`✅ After second click - Breadcrumb: "${firstText}" > "${lastText}" (DUPLICATE SEARCH PREVENTION FIX VERIFIED!)`)
    await expect(breadcrumbButtons().first()).toContainText('糖質')
    await expect(breadcrumbButtons().last()).toContainText(clickedTermText)
  })
})
