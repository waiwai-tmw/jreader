import { test } from '@playwright/test'
import { ensureFakeAuthEnabled } from './helpers/auth'
import { findKanjiClickableTerm } from './helpers/kanji-terms'
import {
  expectSearchResultFor,
  performSearchViaInput,
  expectBreadcrumbCount
} from './helpers/spoiler-assertions'
import {
  getCurrentPaginationIndex,
  clickNextPaginationButton,
  expectPaginationIndex,
  getPaginationDotsCount
} from './helpers/pagination-assertions'

test.beforeEach(async ({ page }) => {
  // Enable fake auth for all tests
  await ensureFakeAuthEnabled(page)
})

test('Pagination resets to index 0 when performing a new search', async ({ page }) => {
  await test.step('Navigate to search for 行く (has multiple readings)', async () => {
    // 行く has multiple term groups (different readings)
    await page.goto('/dictionary/行く')
    await expectSearchResultFor(page, '行く')
  })

  await test.step('Verify pagination is visible with multiple pages', async () => {
    const dotsCount = await getPaginationDotsCount(page)
    if (dotsCount > 2) {
      await clickNextPaginationButton(page)
      await clickNextPaginationButton(page)
      const currentIndex = await getCurrentPaginationIndex(page)
      console.log(`Current pagination index after next click: ${currentIndex}`)
      await expectPaginationIndex(page, 2)
    }
  })

  await test.step('Perform a new search and verify pagination resets to 0', async () => {
    await performSearchViaInput(page, '患者')

    // Verify we're now viewing a different term
    await expectSearchResultFor(page, '患者')

    // Verify pagination is back at index 0
    const currentIndex = await getCurrentPaginationIndex(page)
    console.log(`Pagination index after new search: ${currentIndex}`)
    await expectPaginationIndex(page, 0)
  })
})

test('Pagination is maintained when going do lower layer on the recursive search stack', async ({ page }) => {
  await test.step('Navigate to search for 日本', async () => {
    await page.goto('/dictionary/日本')
    await expectSearchResultFor(page, '日本')
    await expectPaginationIndex(page, 0)
  })

  await test.step('Navigate to second pagination page if available', async () => {
    const dotsCount = await getPaginationDotsCount(page)
    if (dotsCount > 1) {
      await clickNextPaginationButton(page)
      const pageIndex = await getCurrentPaginationIndex(page)
      console.log(`Currently on pagination page ${pageIndex}`)
    }
    await expectPaginationIndex(page, 1)
  })

  await test.step('Perform recursive search by clicking on a kanji term', async () => {
    const result = await findKanjiClickableTerm(page, '大陸')
    if (result) {
      const { expect } = await import('@playwright/test')
      await expect(result.term).toBeVisible()
      await result.term.click()
      await page.waitForTimeout(500)
      await expectBreadcrumbCount(page, 2)
    }
  })

  await test.step('Verify pagination reset on new layer', async () => {
    // After recursive search, pagination should be at index 0
    const currentIndex = await getCurrentPaginationIndex(page)
    console.log(`Pagination index after recursive search: ${currentIndex}`)
    await expectPaginationIndex(page, 0)
  })

  await test.step('Go back to first layer and verify pagination maintained', async () => {
    // Click on the first breadcrumb to go back to layer 1
    const breadcrumbs = page.locator('[data-testid="breadcrumb-navigation"] button')
    const firstBreadcrumb = breadcrumbs.first()
    await firstBreadcrumb.click()
    await page.waitForTimeout(500)

    // Verify we're back at breadcrumb count 1, and still at pagination 2 in original search
    await expectBreadcrumbCount(page, 1)
    await expectPaginationIndex(page, 1)
  })
})
