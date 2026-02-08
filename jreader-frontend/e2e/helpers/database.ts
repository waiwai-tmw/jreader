/**
 * E2E test helpers for mocking Supabase database calls
 */

import { Page } from '@playwright/test'
import type { CardRow, CardInsertData } from '@/utils/supabase/database'

/**
 * Initialize database mocking for a test page
 * Must be called before the page navigates to the app
 */
export async function initializeDatabaseMocks(page: Page) {
  await page.addInitScript(() => {
    // Initialize the mocks map on the window object
    ;(window as any).__E2E_DB_MOCKS = new Map()
  })
}

/**
 * Set a mock response for a database operation
 * @param page The Playwright page
 * @param operationKey The key identifying the operation (e.g., 'insertCard', 'queryCardByExpression:魚')
 * @param response The mock response object with optional 'data' or 'error' properties
 */
export async function setDatabaseMock(
  page: Page,
  operationKey: string,
  response: { data?: any; error?: null } | { data?: null; error: { message: string; code: string } }
) {
  await page.evaluateHandle((args) => {
    const { operationKey, response } = args
    if (!(window as any).__E2E_DB_MOCKS) {
      (window as any).__E2E_DB_MOCKS = new Map()
    }
    ;(window as any).__E2E_DB_MOCKS.set(operationKey, response)
  }, { operationKey, response })
}

/**
 * Clear all database mocks
 */
export async function clearDatabaseMocks(page: Page) {
  await page.evaluateHandle(() => {
    if ((window as any).__E2E_DB_MOCKS) {
      ;(window as any).__E2E_DB_MOCKS.clear()
    }
  })
}

/**
 * Mock a successful card insertion
 */
export async function mockCardInsertSuccess(
  page: Page,
  cardData: Partial<CardRow> = {}
) {
  const mockCard: CardRow = {
    id: 'test-card-' + Math.random().toString(36).substr(2, 9),
    user_id: 'test-user-id',
    expression: cardData.expression || '魚',
    reading: cardData.reading || 'さかな',
    definitions: cardData.definitions || [{ type: 'simple', content: 'fish' }],
    sentence: cardData.sentence || null,
    pitch_accent: cardData.pitch_accent || null,
    frequency: cardData.frequency || [],
    expression_audio: cardData.expression_audio || null,
    document_title: cardData.document_title || null,
    anki_note_id: cardData.anki_note_id || null,
    anki_model: cardData.anki_model || null,
    anki_deck: cardData.anki_deck || null,
    sync_status: cardData.sync_status || 'local_only',
    synced_at: cardData.synced_at || null,
    created_at: cardData.created_at || new Date().toISOString(),
    updated_at: cardData.updated_at || new Date().toISOString(),
  }

  await setDatabaseMock(page, 'insertCard', { data: [mockCard] })
}

/**
 * Mock a card insertion error
 */
export async function mockCardInsertError(
  page: Page,
  errorMessage = 'Failed to insert card'
) {
  await setDatabaseMock(page, 'insertCard', {
    error: { message: errorMessage, code: 'PGRST301' }
  })
}

/**
 * Mock a successful card query by expression
 */
export async function mockCardQuerySuccess(
  page: Page,
  expression: string,
  cardData: Partial<CardRow> = {}
) {
  const mockCard: CardRow = {
    id: 'test-card-' + Math.random().toString(36).substr(2, 9),
    user_id: 'test-user-id',
    expression: cardData.expression || expression,
    reading: cardData.reading || '',
    definitions: cardData.definitions || [],
    sentence: cardData.sentence || null,
    pitch_accent: cardData.pitch_accent || null,
    frequency: cardData.frequency || [],
    expression_audio: cardData.expression_audio || null,
    document_title: cardData.document_title || null,
    anki_note_id: cardData.anki_note_id || null,
    anki_model: cardData.anki_model || null,
    anki_deck: cardData.anki_deck || null,
    sync_status: cardData.sync_status || 'local_only',
    synced_at: cardData.synced_at || null,
    created_at: cardData.created_at || new Date().toISOString(),
    updated_at: cardData.updated_at || new Date().toISOString(),
  }

  await setDatabaseMock(page, `queryCardByExpression:${expression}`, { data: [mockCard] })
}

/**
 * Mock a card not found scenario
 */
export async function mockCardQueryNotFound(page: Page, expression: string) {
  await setDatabaseMock(page, `queryCardByExpression:${expression}`, { data: null })
}

/**
 * Mock a card query error
 */
export async function mockCardQueryError(
  page: Page,
  expression: string,
  errorMessage = 'Failed to query card'
) {
  await setDatabaseMock(page, `queryCardByExpression:${expression}`, {
    error: { message: errorMessage, code: 'PGRST301' }
  })
}

/**
 * Set the current authenticated user
 */
export async function setMockCurrentUser(
  page: Page,
  userId: string = 'test-user-id'
) {
  await setDatabaseMock(page, 'currentUser', { data: { id: userId } })
}
