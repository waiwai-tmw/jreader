import type { SyncContextData } from './syncHooks'

export interface CanSyncToAnkiResult {
  canSync: boolean
  reasons: string[]
}

/**
 * Checks if manual bulk sync to Anki is possible (doesn't require auto-sync to be enabled)
 *
 * @param syncContext - Combined context data from extension and health contexts
 * @returns Object containing canSync boolean and array of reasons if sync is not possible
 */
export function canManualSyncToAnki(
  syncContext: SyncContextData
): CanSyncToAnkiResult {
  const { extensionStatus, healthStatus } = syncContext
  const reasons: string[] = []

  if (!extensionStatus.available) {
    reasons.push('extension not available')
  }

  if (!healthStatus.available) {
    reasons.push('AnkiConnect not available')
  }

  if (!healthStatus.configured) {
    reasons.push('AnkiConnect not configured')
  }

  const canSync = extensionStatus.available === true &&
                  healthStatus.available &&
                  healthStatus.configured

  return {
    canSync,
    reasons
  }
}
