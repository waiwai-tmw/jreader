/**
 * Database abstraction layer for Supabase
 * This layer allows us to intercept and mock database calls in tests
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface CardInsertData {
  expression: string
  reading: string
  definitions: any[]
  sentence?: string | null
  pitch_accent?: string | null
  frequency?: any[]
  expression_audio?: string | null
  document_title?: string | null
  anki_note_id?: string | null
  anki_model?: string | null
  anki_deck?: string | null
  sync_status: string
  synced_at?: string | null
}

export interface CardRow extends CardInsertData {
  id: string
  user_id: string
  created_at: string
  updated_at: string
}

export interface CardQueryResult {
  data: CardRow[] | null
  error: { message: string; code: string } | null
}

export interface DatabaseClient {
  /**
   * Insert a card into the cards table
   */
  insertCard(cardData: CardInsertData): Promise<CardQueryResult>

  /**
   * Query a single card by expression
   */
  queryCardByExpression(expression: string): Promise<CardQueryResult>

  /**
   * Query cards by expression and reading
   */
  queryCardsByExpressionAndReading(expression: string, reading?: string): Promise<CardQueryResult>

  /**
   * Get the current authenticated user
   */
  getUser(): Promise<{ id: string } | null>
}

/**
 * Production Supabase client implementation
 */
export class SupabaseDatabaseClient implements DatabaseClient {
  constructor(private supabase: SupabaseClient) {}

  async insertCard(cardData: CardInsertData): Promise<CardQueryResult> {
    const { data, error } = await this.supabase
      .from('cards')
      .insert(cardData)
      .select()

    return { data: data as CardRow[] | null, error: error as any }
  }

  async queryCardByExpression(expression: string): Promise<CardQueryResult> {
    const { data, error } = await this.supabase
      .from('cards')
      .select('id, anki_note_id, user_id')
      .eq('expression', expression)
      .maybeSingle()

    // Convert single result to array for consistency
    const arrayData = data ? [data as any] : null
    return { data: arrayData as CardRow[] | null, error: error as any }
  }

  async queryCardsByExpressionAndReading(expression: string, reading?: string): Promise<CardQueryResult> {
    let query = this.supabase
      .from('cards')
      .select('*')
      .eq('expression', expression)

    if (reading) {
      query = query.eq('reading', reading)
    }

    const { data, error } = await query

    return { data: data as CardRow[] | null, error: error as any }
  }

  async getUser(): Promise<{ id: string } | null> {
    const { data: { user } } = await this.supabase.auth.getUser()
    return user ? { id: user.id } : null
  }
}

/**
 * Mock database client for tests
 * Stores mocked responses that can be configured via window.__E2E_DB_MOCKS
 */
export class MockDatabaseClient implements DatabaseClient {
  private mocks: Map<string, any> = new Map()

  constructor() {
    this.loadMocksFromWindow()
  }

  private loadMocksFromWindow() {
    if (typeof window !== 'undefined' && (window as any).__E2E_DB_MOCKS) {
      this.mocks = (window as any).__E2E_DB_MOCKS
    }
  }

  setMock(key: string, value: any) {
    this.mocks.set(key, value)
    // Also store in window for Playwright to access
    if (typeof window !== 'undefined') {
      if (!(window as any).__E2E_DB_MOCKS) {
        (window as any).__E2E_DB_MOCKS = this.mocks
      }
    }
  }

  getMock(key: string): any {
    return this.mocks.get(key)
  }

  clearMocks() {
    this.mocks.clear()
  }

  async insertCard(cardData: CardInsertData): Promise<CardQueryResult> {
    const mockResponse = this.getMock('insertCard')

    if (mockResponse?.error) {
      return { data: null, error: mockResponse.error }
    }

    if (mockResponse?.data) {
      return { data: mockResponse.data, error: null }
    }

    // Default: return inserted card with generated ID
    const insertedCard: CardRow = {
      ...cardData,
      id: 'mock-id-' + Math.random().toString(36).substr(2, 9),
      user_id: 'test-user-id',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    return { data: [insertedCard], error: null }
  }

  async queryCardByExpression(expression: string): Promise<CardQueryResult> {
    const mockKey = `queryCardByExpression:${expression}`
    const mockResponse = this.getMock(mockKey)

    if (mockResponse?.error) {
      return { data: null, error: mockResponse.error }
    }

    if (mockResponse?.data) {
      return { data: mockResponse.data, error: null }
    }

    // Default: card not found
    return { data: null, error: null }
  }

  async queryCardsByExpressionAndReading(expression: string, reading?: string): Promise<CardQueryResult> {
    const mockKey = `queryCardsByExpressionAndReading:${expression}:${reading || ''}`
    const mockResponse = this.getMock(mockKey)

    if (mockResponse?.error) {
      return { data: null, error: mockResponse.error }
    }

    if (mockResponse?.data) {
      return { data: mockResponse.data, error: null }
    }

    // Default: empty result
    return { data: null, error: null }
  }

  async getUser(): Promise<{ id: string } | null> {
    const mockUser = this.getMock('currentUser')
    return mockUser || { id: 'test-user-id' }
  }
}

/**
 * Factory function to get the appropriate database client
 * @param supabase Optional Supabase client. If not provided, will create one in production mode.
 */
export function createDatabaseClient(supabase?: SupabaseClient): DatabaseClient {
  // Check if we're in test mode
  if (typeof window !== 'undefined' && (window as any).__E2E_FAKE_AUTH === true) {
    return new MockDatabaseClient()
  }

  // If no supabase client provided, create one now
  if (!supabase) {
    // Dynamic import to avoid circular dependencies
    const { createClient } = require('./client')
    supabase = createClient()
  }

  return new SupabaseDatabaseClient(supabase)
}
