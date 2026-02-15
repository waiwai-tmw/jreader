import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

// Get database path from environment or use default
const dbPath = process.env.SQLITE_DB_PATH || './data/jreader.db'

// Create SQLite database instance
const sqlite = new Database(dbPath)

// Enable WAL mode for better concurrency
sqlite.pragma('journal_mode = WAL')

// Create and export Drizzle instance
export const db = drizzle(sqlite, { schema })

// Export schema for convenience
export * from './schema'
