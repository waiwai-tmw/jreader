import { db, users, userUploads, userPreferences, cards, kanjiState, tableOfContents, dictionaryIndex, webnovel, userWebnovel } from '@/db'
import { eq, and, desc, sql } from 'drizzle-orm'
import { getCurrentUser } from './auth'

/**
 * Get all books (uploads) for a user
 */
export async function getUserBooks(username: string) {
  const user = await getCurrentUser(username)
  if (!user) return []

  return db.select()
    .from(userUploads)
    .where(eq(userUploads.user_id, user.id))
    .orderBy(desc(userUploads.created_at))
}

/**
 * Get a specific book by ID for a user
 */
export async function getUserBook(username: string, uploadId: string) {
  const user = await getCurrentUser(username)
  if (!user) return null

  const result = await db.select()
    .from(userUploads)
    .where(and(
      eq(userUploads.id, uploadId),
      eq(userUploads.user_id, user.id)
    ))
    .limit(1)

  return result[0] || null
}

/**
 * Insert a new book upload for a user
 */
export async function insertUserBook(username: string, bookData: {
  id: string
  title?: string
  author?: string
  directory_name: string
  total_pages: number
  cover_path?: string
}) {
  const user = await getCurrentUser(username)
  if (!user) throw new Error('User not found')

  await db.insert(userUploads).values({
    ...bookData,
    user_id: user.id,
    created_at: new Date().toISOString(),
  })
}

/**
 * Delete a book upload
 */
export async function deleteUserBook(username: string, uploadId: string) {
  const user = await getCurrentUser(username)
  if (!user) throw new Error('User not found')

  await db.delete(userUploads)
    .where(and(
      eq(userUploads.id, uploadId),
      eq(userUploads.user_id, user.id)
    ))
}

/**
 * Get all cards for a user
 */
export async function getUserCards(username: string) {
  const user = await getCurrentUser(username)
  if (!user) return []

  return db.select()
    .from(cards)
    .where(eq(cards.user_id, user.id))
    .orderBy(desc(cards.created_at))
}

/**
 * Insert a new card for a user
 */
export async function insertCard(username: string, cardData: {
  expression: string
  reading?: string
  definitions: any // Will be JSON.stringify'd
  sentence?: string
  pitch_accent?: string
  frequency?: any
  expression_audio?: string
  document_title?: string
  anki_note_id?: string
  anki_model?: string
  anki_deck?: string
  sync_status?: string
}) {
  const user = await getCurrentUser(username)
  if (!user) throw new Error('User not found')

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await db.insert(cards).values({
    id,
    user_id: user.id,
    expression: cardData.expression,
    reading: cardData.reading || null,
    definitions: JSON.stringify(cardData.definitions),
    sentence: cardData.sentence || null,
    pitch_accent: cardData.pitch_accent || null,
    frequency: cardData.frequency ? JSON.stringify(cardData.frequency) : null,
    expression_audio: cardData.expression_audio || null,
    document_title: cardData.document_title || null,
    anki_note_id: cardData.anki_note_id || null,
    anki_model: cardData.anki_model || null,
    anki_deck: cardData.anki_deck || null,
    sync_status: cardData.sync_status || 'local_only',
    synced_at: null,
    created_at: now,
    updated_at: now,
  })

  return id
}

/**
 * Update a card
 */
export async function updateCard(username: string, cardId: string, updates: Partial<{
  expression: string
  reading: string | null
  definitions: any
  sentence: string | null
  sync_status: string
  anki_note_id: string | null
  synced_at: string | null
}>) {
  const user = await getCurrentUser(username)
  if (!user) throw new Error('User not found')

  const updateData: any = {
    ...updates,
    updated_at: new Date().toISOString(),
  }

  // Stringify JSON fields if present
  if (updates.definitions !== undefined) {
    updateData.definitions = JSON.stringify(updates.definitions)
  }

  await db.update(cards)
    .set(updateData)
    .where(and(
      eq(cards.id, cardId),
      eq(cards.user_id, user.id)
    ))
}

/**
 * Delete cards
 */
export async function deleteCards(username: string, cardIds: string[]) {
  const user = await getCurrentUser(username)
  if (!user) throw new Error('User not found')

  await db.delete(cards)
    .where(and(
      sql`${cards.id} IN ${cardIds}`,
      eq(cards.user_id, user.id)
    ))
}

/**
 * Get user preferences
 */
export async function getUserPreferences(username: string) {
  const user = await getCurrentUser(username)
  if (!user) return null

  const result = await db.select()
    .from(userPreferences)
    .where(eq(userPreferences.user_id, user.id))
    .limit(1)

  return result[0] || null
}

/**
 * Upsert user preferences
 */
export async function upsertUserPreferences(username: string, prefs: {
  term_order?: string
  term_disabled?: string
  term_spoiler?: string
  freq_order?: string
  freq_disabled?: string
  kanji_highlighting_enabled?: boolean
  show_known_kanji?: boolean
  show_encountered_kanji?: boolean
  show_unknown_kanji?: boolean
}) {
  const user = await getCurrentUser(username)
  if (!user) throw new Error('User not found')

  // Try to insert, if conflict then update
  await db.insert(userPreferences)
    .values({
      user_id: user.id,
      ...prefs,
    })
    .onConflictDoUpdate({
      target: userPreferences.user_id,
      set: prefs,
    })
}

/**
 * Get kanji states for a user
 */
export async function getUserKanjiStates(username: string) {
  const user = await getCurrentUser(username)
  if (!user) return []

  return db.select()
    .from(kanjiState)
    .where(eq(kanjiState.user_id, user.id))
}

/**
 * Upsert kanji state
 */
export async function upsertKanjiState(username: string, kanji: string, state: 'known' | 'encountered' | 'unknown') {
  const user = await getCurrentUser(username)
  if (!user) throw new Error('User not found')

  const now = new Date().toISOString()
  const id = `${user.id}-${kanji}`

  await db.insert(kanjiState)
    .values({
      id,
      user_id: user.id,
      kanji,
      state,
      created_at: now,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: kanjiState.id,
      set: {
        state,
        updated_at: now,
      },
    })
}

/**
 * Get table of contents for a book
 */
export async function getTableOfContents(uploadId: string) {
  return db.select()
    .from(tableOfContents)
    .where(eq(tableOfContents.upload_id, uploadId))
    .orderBy(tableOfContents.play_order)
}

/**
 * Insert table of contents entries
 */
export async function insertTableOfContents(uploadId: string, entries: Array<{
  label: string
  content_src: string
  play_order: number
  page_number: number
}>) {
  const values = entries.map(entry => ({
    id: crypto.randomUUID(),
    upload_id: uploadId,
    ...entry,
  }))

  await db.insert(tableOfContents).values(values)
}

/**
 * Get all dictionary index entries
 */
export async function getAllDictionaries() {
  return db.select().from(dictionaryIndex)
}

/**
 * Get all webnovels (for recent imports list)
 */
export async function getRecentWebnovels(limit: number = 100) {
  return db.select()
    .from(webnovel)
    .orderBy(desc(webnovel.created_at))
    .limit(limit)
}

/**
 * Get a webnovel by ID
 */
export async function getWebnovelById(webnovelId: string) {
  const result = await db.select()
    .from(webnovel)
    .where(eq(webnovel.id, webnovelId))
    .limit(1)

  return result[0] || null
}

/**
 * Get a webnovel by URL
 */
export async function getWebnovelByUrl(url: string) {
  const result = await db.select()
    .from(webnovel)
    .where(eq(webnovel.url, url))
    .limit(1)

  return result[0] || null
}

/**
 * Insert a webnovel
 */
export async function insertWebnovel(data: {
  id: string
  title: string
  author: string
  url: string
  source: string
  directory_name: string
  total_pages: number
  cover_path?: string
  syosetu_metadata?: any
}) {
  await db.insert(webnovel).values({
    ...data,
    syosetu_metadata: data.syosetu_metadata ? JSON.stringify(data.syosetu_metadata) : null,
    created_at: new Date().toISOString(),
  })
}

/**
 * Get user's webnovels
 */
export async function getUserWebnovels(username: string) {
  const user = await getCurrentUser(username)
  if (!user) return []

  // Join with webnovel table to get full details
  return db.select({
    id: userWebnovel.id,
    webnovel_id: userWebnovel.webnovel_id,
    created_at: userWebnovel.created_at,
    webnovel: webnovel,
  })
    .from(userWebnovel)
    .innerJoin(webnovel, eq(userWebnovel.webnovel_id, webnovel.id))
    .where(eq(userWebnovel.user_id, user.id))
    .orderBy(desc(userWebnovel.created_at))
}

/**
 * Add a webnovel to user's library
 */
export async function addUserWebnovel(username: string, webnovelId: string) {
  const user = await getCurrentUser(username)
  if (!user) throw new Error('User not found')

  const id = crypto.randomUUID()

  await db.insert(userWebnovel).values({
    id,
    user_id: user.id,
    webnovel_id: webnovelId,
    created_at: new Date().toISOString(),
  })
}

/**
 * Remove a webnovel from user's library
 */
export async function removeUserWebnovel(username: string, webnovelId: string) {
  const user = await getCurrentUser(username)
  if (!user) throw new Error('User not found')

  await db.delete(userWebnovel)
    .where(and(
      eq(userWebnovel.user_id, user.id),
      eq(userWebnovel.webnovel_id, webnovelId)
    ))
}

/**
 * Check if user has a specific webnovel
 */
export async function userHasWebnovel(username: string, webnovelId: string): Promise<boolean> {
  const user = await getCurrentUser(username)
  if (!user) return false

  const result = await db.select({ id: userWebnovel.id })
    .from(userWebnovel)
    .where(and(
      eq(userWebnovel.user_id, user.id),
      eq(userWebnovel.webnovel_id, webnovelId)
    ))
    .limit(1)

  return result.length > 0
}
