'use client'

import { useAnkiHealth } from '@/contexts/AnkiHealthContext'
import { useAutoSync } from '@/contexts/AutoSyncContext'
import { useExtension } from '@/contexts/ExtensionContext'

export interface SyncContextData {
  extensionStatus: {
    available: boolean | null
    paired: boolean | null
  }
  healthStatus: {
    available: boolean
    configured: boolean
    checking: boolean
    error?: string
    lastChecked?: Date
  }
  autoSyncEnabled: boolean
}

/**
 * Combined hook that gathers all sync-related context data from extension,
 * auto-sync, and AnkiConnect health contexts.
 * 
 * This provides a single source for all the data needed by sync helper functions,
 * making the calling code cleaner while keeping helpers as pure functions.
 * 
 * @returns Object containing all sync-related context data
 */
export function useSyncContext(): SyncContextData {
  const { extensionStatus } = useExtension()
  const { autoSyncEnabled } = useAutoSync()
  const { healthStatus } = useAnkiHealth()

  return {
    extensionStatus,
    healthStatus,
    autoSyncEnabled
  }
}