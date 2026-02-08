import { test } from '@playwright/test'
import { ensureFakeAuthEnabled } from './helpers/auth'
import { findKanjiClickableTerm } from './helpers/kanji-terms'
import { mockUserPreferencesWithSpoileredDict } from './helpers/preferences'
import {
  expectSearchResultFor,
  expectSpoileredDictHidden,
  expectSpoileredDictRevealed,
  revealSpoileredDict,
  performSearchViaInput,
  expectBreadcrumbCount,
  expectVisibleSpoileredDictHidden
} from './helpers/spoiler-assertions'

test.beforeEach(async ({ page }) => {
  // Enable fake auth and mock user preferences for all tests
  await ensureFakeAuthEnabled(page)
  await mockUserPreferencesWithSpoileredDict(page)
})

test('Can unspoiler dictionary', async ({ page }) => {
  await test.step('Navigate directly to search for 漢字', async () => {
    await page.goto('/dictionary/漢字')
    await expectSearchResultFor(page, '漢字')
  })

  await test.step('Verify Jitendex is hidden (spoilered)', async () => {
    await expectSpoileredDictHidden(page)
  })

  await test.step('Reveal Jitendex definition', async () => {
    await revealSpoileredDict(page)
  })

  await test.step('Verify Jitendex is now revealed', async () => {
    await expectSpoileredDictRevealed(page)
  })
})

test('Can unspoiler dictionary; recursive searches remain spoilered', async ({ page }) => {
  await test.step('Navigate directly to search for 漢字', async () => {
    await page.goto('/dictionary/漢字')
    await expectSearchResultFor(page, '漢字')
  })

  await test.step('Verify spoiler state: Jitendex hidden', async () => {
    await expectSpoileredDictHidden(page)
  })

  await test.step('Reveal Jitendex definition', async () => {
    await revealSpoileredDict(page)
    await expectSpoileredDictRevealed(page)
  })

  await test.step('Perform recursive search by clicking on 表語文字', async () => {
    const result = await findKanjiClickableTerm(page, '表語文字')
    if (result) {
      const { expect } = await import('@playwright/test')
      await expect(result.term).toBeVisible()
      await result.term.click()
      await page.waitForTimeout(500)
      await expectBreadcrumbCount(page, 2)
    }
  })

  await test.step('Verify spoiler state was reset for new layer', async () => {
    await expectVisibleSpoileredDictHidden(page)
  })
})

test('Can unspoiler dictionary; new searches remain spoilered', async ({ page }) => {
  await test.step('Navigate directly to search for first term: 漢字', async () => {
    await page.goto('/dictionary/漢字')
    await expectSearchResultFor(page, '漢字')
  })

  await test.step('Verify spoiler state: Jitendex hidden', async () => {
    await expectSpoileredDictHidden(page)
  })

  await test.step('Reveal Jitendex definition', async () => {
    await revealSpoileredDict(page)
    await expectSpoileredDictRevealed(page)
  })

  await test.step('Perform a new search by typing in the search input: 患者', async () => {
    await performSearchViaInput(page, '患者')
  })

  await test.step('Verify spoiler state was reset: Jitendex hidden again', async () => {
    await expectSpoileredDictHidden(page)
  })
})
