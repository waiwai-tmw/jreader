/**
 * Supabase compatibility shim.
 * Replaces the real Supabase client with one that calls our Next.js API routes
 * backed by SQLite instead of Supabase/Postgres.
 *
 * Implements only the subset of the Supabase client interface actually used
 * in this codebase. Returns empty data (never throws) for unimplemented tables
 * so the UI degrades gracefully while migration is in progress.
 */

import { getCurrentUsername } from '@/lib/client-auth'

// Table → API route mappings for SELECT queries
const TABLE_GET_ROUTES: Record<string, string> = {
  'cards': '/api/cards',
  'User Uploads': '/api/books',
  'users': '/api/subscription',
  'Users': '/api/subscription',
  'user_webnovel': '/api/webnovels/count',
}

// Table → API route mappings for mutations (POST body includes operation)
const TABLE_MUTATE_ROUTES: Record<string, string> = {
  'cards': '/api/cards',
  'User Kanji': '/api/kanji',
  'kanji_state': '/api/kanji',
  'user_webnovel': '/api/webnovels/import',
  'Bookmarks': '/api/bookmarks',
}

type Filter = { type: 'eq' | 'ilike' | 'is'; col: string; val: unknown }

class QueryBuilder {
  private _table: string
  private _selectCols = '*'
  private _filters: Filter[] = []
  private _orderBys: Array<{ col: string; asc: boolean }> = []
  private _limitVal?: number
  private _operation: 'select' | 'insert' | 'upsert' | 'delete' = 'select'
  private _mutateData?: unknown
  private _upsertOptions?: unknown

  constructor(table: string) {
    this._table = table
  }

  select(cols = '*') {
    this._selectCols = cols
    this._operation = 'select'
    return this
  }

  eq(col: string, val: unknown) {
    this._filters.push({ type: 'eq', col, val })
    return this
  }

  ilike(col: string, val: unknown) {
    this._filters.push({ type: 'ilike', col, val })
    return this
  }

  is(col: string, val: unknown) {
    this._filters.push({ type: 'is', col, val })
    return this
  }

  order(col: string, options?: { ascending?: boolean }) {
    this._orderBys.push({ col, asc: options?.ascending ?? true })
    return this
  }

  limit(n: number) {
    this._limitVal = n
    return this
  }

  insert(data: unknown) {
    this._operation = 'insert'
    this._mutateData = data
    return this
  }

  upsert(data: unknown, options?: unknown) {
    this._operation = 'upsert'
    this._mutateData = data
    this._upsertOptions = options
    return this
  }

  delete() {
    this._operation = 'delete'
    return this
  }

  // Terminal methods
  async single() {
    const { data, error } = await this._execute()
    const row = Array.isArray(data) ? (data[0] ?? null) : data
    if (row === null && !error) {
      return { data: null, error: { message: 'No rows found', code: 'PGRST116' } }
    }
    return { data: row, error }
  }

  async maybeSingle() {
    const { data, error } = await this._execute()
    const row = Array.isArray(data) ? (data[0] ?? null) : data
    return { data: row, error }
  }

  // Makes the builder directly awaitable: `await supabase.from(...).select(...)`
  then(
    resolve: (value: { data: unknown; error: unknown; count?: number }) => void,
    reject?: (reason: unknown) => void,
  ) {
    return this._execute().then(resolve, reject)
  }

  private async _execute(): Promise<{ data: unknown; error: unknown; count?: number }> {
    try {
      if (this._operation === 'select') {
        return await this._executeSelect()
      } else {
        return await this._executeMutate()
      }
    } catch (e) {
      console.warn(`[Supabase Shim] Error for table "${this._table}":`, e)
      return { data: this._operation === 'select' ? [] : null, error: { message: String(e) } }
    }
  }

  private async _executeSelect(): Promise<{ data: unknown; error: unknown; count?: number }> {
    const route = TABLE_GET_ROUTES[this._table]
    if (!route) {
      console.warn(`[Supabase Shim] No GET route for table "${this._table}", returning []`)
      return { data: [], error: null, count: 0 }
    }

    const url = new URL(route, window.location.origin)
    // Pass simple eq filters as query params for the route to use if it wants
    this._filters.forEach((f) => {
      if (f.type === 'eq') url.searchParams.set(f.col, String(f.val))
    })
    if (this._limitVal != null) url.searchParams.set('limit', String(this._limitVal))

    const res = await fetch(url.toString(), { credentials: 'include' })
    if (!res.ok) return { data: [], error: { message: `HTTP ${res.status}` }, count: 0 }

    const json = await res.json()
    // Normalise to { data, count } regardless of shape the route returns
    if (Array.isArray(json)) return { data: json, error: null, count: json.length }
    if (json.data !== undefined) return { data: json.data, error: null, count: json.count ?? json.data?.length }
    return { data: json, error: null }
  }

  private async _executeMutate(): Promise<{ data: unknown; error: unknown }> {
    const route = TABLE_MUTATE_ROUTES[this._table]
    if (!route) {
      console.warn(`[Supabase Shim] No mutate route for table "${this._table}", skipping`)
      return { data: null, error: null }
    }

    const res = await fetch(route, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: this._operation,
        data: this._mutateData,
        filters: this._filters,
        options: this._upsertOptions,
      }),
    })

    if (!res.ok) return { data: null, error: { message: `HTTP ${res.status}` } }
    const json = await res.json()
    return { data: json.data ?? json, error: null }
  }
}

// ─── Auth shim ───────────────────────────────────────────────────────────────

function buildFakeUser(username: string) {
  return {
    id: username,
    email: `${username}@local`,
    user_metadata: { full_name: username },
    app_metadata: {},
    aud: 'authenticated',
    created_at: '',
  }
}

const authShim = {
  getUser: async () => {
    const username = getCurrentUsername()
    if (!username) return { data: { user: null }, error: null }
    return { data: { user: buildFakeUser(username) }, error: null }
  },
  getSession: async () => {
    const username = getCurrentUsername()
    if (!username) return { data: { session: null }, error: null }
    return {
      data: {
        session: {
          user: buildFakeUser(username),
          access_token: '',
          refresh_token: '',
          expires_at: 0,
        },
      },
      error: null,
    }
  },
  onAuthStateChange: (_event: string, _callback: unknown) => {
    // No-op; return a fake subscription object
    return { data: { subscription: { unsubscribe: () => {} } } }
  },
}

// ─── Storage shim ─────────────────────────────────────────────────────────────

const storageShim = {
  from: (bucket: string) => ({
    createSignedUrl: async (path: string, _expiresIn: number) => {
      // Route to our local file-serving API
      return { data: { signedUrl: `/api/files/${bucket}/${path}` }, error: null }
    },
  }),
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function createShimClient() {
  return {
    from: (table: string) => new QueryBuilder(table),
    auth: authShim,
    storage: storageShim,
  }
}
