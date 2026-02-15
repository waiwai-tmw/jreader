import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  tier: integer('tier').default(0).notNull(), // 0=free, 1=pro, 2=unlimited
  stripe_customer_id: text('stripe_customer_id'),
  stripe_subscription_id: text('stripe_subscription_id'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at'),
})

// User Uploads table (EPUB books)
export const userUploads = sqliteTable('user_uploads', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title'),
  author: text('author'),
  directory_name: text('directory_name').notNull(),
  total_pages: integer('total_pages').notNull(),
  cover_path: text('cover_path'),
  created_at: text('created_at').notNull(),
})

// User Preferences table
export const userPreferences = sqliteTable('user_preferences', {
  user_id: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  term_order: text('term_order').notNull().default(''), // Comma-separated list
  term_disabled: text('term_disabled').notNull().default(''), // Comma-separated list
  term_spoiler: text('term_spoiler').notNull().default(''), // Comma-separated list
  freq_order: text('freq_order').notNull().default(''), // Comma-separated list
  freq_disabled: text('freq_disabled').notNull().default(''), // Comma-separated list
  kanji_highlighting_enabled: integer('kanji_highlighting_enabled', { mode: 'boolean' }).default(true),
  show_known_kanji: integer('show_known_kanji', { mode: 'boolean' }).default(true),
  show_encountered_kanji: integer('show_encountered_kanji', { mode: 'boolean' }).default(true),
  show_unknown_kanji: integer('show_unknown_kanji', { mode: 'boolean' }).default(true),
})

// Cards table (Anki mining)
export const cards = sqliteTable('cards', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expression: text('expression').notNull(),
  reading: text('reading'),
  definitions: text('definitions').notNull(), // JSON string
  sentence: text('sentence'),
  pitch_accent: text('pitch_accent'),
  frequency: text('frequency'), // JSON string
  expression_audio: text('expression_audio'),
  document_title: text('document_title'),
  anki_note_id: text('anki_note_id'),
  anki_model: text('anki_model'),
  anki_deck: text('anki_deck'),
  sync_status: text('sync_status').notNull().default('local_only'), // local_only, pending, synced
  synced_at: text('synced_at'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

// Kanji State table
export const kanjiState = sqliteTable('kanji_state', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kanji: text('kanji').notNull(),
  state: text('state').notNull(), // 'known', 'encountered', 'unknown'
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

// Table of Contents
export const tableOfContents = sqliteTable('table_of_contents', {
  id: text('id').primaryKey(),
  upload_id: text('upload_id').notNull().references(() => userUploads.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  content_src: text('content_src').notNull(),
  play_order: integer('play_order').notNull(),
  page_number: integer('page_number').notNull(),
})

// Dictionary Index table
export const dictionaryIndex = sqliteTable('dictionary_index', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  revision: text('revision').notNull(),
  type: text('type').notNull(), // 'term' or 'frequency'
  has_images: integer('has_images', { mode: 'boolean' }).default(false),
  created_at: text('created_at').notNull(),
})

// Webnovel table
export const webnovel = sqliteTable('webnovel', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  author: text('author').notNull(),
  url: text('url').notNull().unique(),
  source: text('source').notNull(), // e.g., 'syosetu'
  directory_name: text('directory_name').notNull(),
  total_pages: integer('total_pages').notNull(),
  cover_path: text('cover_path'),
  syosetu_metadata: text('syosetu_metadata'), // JSON string
  created_at: text('created_at').notNull(),
})

// User Webnovel junction table
export const userWebnovel = sqliteTable('user_webnovel', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  webnovel_id: text('webnovel_id').notNull().references(() => webnovel.id, { onDelete: 'cascade' }),
  created_at: text('created_at').notNull(),
})
