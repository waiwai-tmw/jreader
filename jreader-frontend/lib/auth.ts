import { db, users } from '@/db'
import { eq } from 'drizzle-orm'

export type User = {
  id: string
  username: string
  tier: number
  created_at: string
}

/**
 * Get current user by username
 * Server-side only - use in API routes and server components
 */
export async function getCurrentUser(username: string | null | undefined): Promise<User | null> {
  if (!username) return null

  try {
    const result = await db.select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1)

    return result[0] || null
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

/**
 * Create a new user with the given username
 * Server-side only
 */
export async function createUser(username: string): Promise<User> {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await db.insert(users).values({
    id,
    username,
    tier: 0, // Free tier by default
    created_at: now,
    updated_at: now,
  })

  return {
    id,
    username,
    tier: 0,
    created_at: now,
  }
}

/**
 * Get or create a user by username
 * Server-side only
 */
export async function getOrCreateUser(username: string): Promise<User> {
  const existing = await getCurrentUser(username)
  if (existing) return existing

  return createUser(username)
}
