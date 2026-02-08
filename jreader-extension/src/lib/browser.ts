// Unified browser API wrapper
// Always import from here instead of directly from webextension-polyfill
import type { SW_EVENT_AUTH_IS_AUTHENTICATED } from '@jreader/shared-types-ts/extensionAvailability';
import browser from 'webextension-polyfill';

import type { SW_EVENT_SUPABASE_GET_CLIENT, SW_EVENT_SUPABASE_GET_USER, SW_EVENT_SUPABASE_GET_CARDS, SW_EVENT_SUPABASE_TEST_CONNECTION, SW_EVENT_ANKI_SYNC_CARDS, SW_EVENT_ANKI_OPEN_NOTE, SW_EVENT_AUTH_SIGN_IN_DISCORD, SW_EVENT_AUTH_SIGN_OUT, SW_EVENT_AUTH_GET_CURRENT_SESSION, CONTENT_SCRIPT_EVENT_UPDATE_EXTENSION_STATUS, POPUP_EVENT_AUTH_CHANGED } from './constants';

// Log browser API initialization
console.log('🔧 Browser API initialized:', {
  hasBrowser: typeof browser !== 'undefined',
  hasRuntime: !!(browser as any)?.runtime,
  hasStorage: !!(browser as any)?.storage,
  hasTabs: !!(browser as any)?.tabs,
  userAgent: navigator.userAgent,
  timestamp: new Date().toISOString()
});

export { browser };

// Re-export commonly used APIs for convenience
export const {
  runtime,
  storage,
  tabs,
  scripting,
  permissions
} = browser;

// Type-safe messaging helper
export type Message =
  | { type: typeof SW_EVENT_SUPABASE_GET_CLIENT }
  | { type: typeof SW_EVENT_SUPABASE_GET_USER }
  | { type: typeof SW_EVENT_SUPABASE_TEST_CONNECTION }
  | { type: typeof SW_EVENT_SUPABASE_GET_CARDS }
  | { type: typeof SW_EVENT_ANKI_SYNC_CARDS; cardIds?: string[]; cards?: any[]; syncUnsyncedForUser?: boolean }
  | { type: typeof SW_EVENT_ANKI_OPEN_NOTE; noteId: string }
  | { type: typeof SW_EVENT_AUTH_SIGN_IN_DISCORD }
  | { type: typeof SW_EVENT_AUTH_SIGN_OUT }
  | { type: typeof SW_EVENT_AUTH_GET_CURRENT_SESSION }
  | { type: typeof SW_EVENT_AUTH_IS_AUTHENTICATED }
  | { type: typeof POPUP_EVENT_AUTH_CHANGED; session: any; event?: string }
  | { type: typeof CONTENT_SCRIPT_EVENT_UPDATE_EXTENSION_STATUS; isAuthenticated: boolean };

export const sendMessage = <T = unknown>(msg: Message): Promise<T> =>
  browser.runtime.sendMessage(msg) as Promise<T>;

// Storage helper
export const storageHelper = {
  get: async <T>(key: string): Promise<T | undefined> => (await browser.storage.local.get(key))[key] as T | undefined,
  set: async (key: string, value: unknown): Promise<void> => browser.storage.local.set({ [key]: value }),
  remove: async (key: string): Promise<void> => browser.storage.local.remove(key),
  clear: async (): Promise<void> => browser.storage.local.clear()
};

// Feature detection helpers
export const hasScriptingAPI = (): boolean => !!(browser as any).scripting?.executeScript;
export const hasDeclarativeNetRequest = (): boolean => !!(browser as any).declarativeNetRequest;
export const hasSyncStorage = (): boolean => !!(browser as any).storage?.sync;

// Browser detection
export const getBrowserInfo = (): 'firefox' | 'edge' | 'chrome' | 'safari' | 'unknown' => {
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Firefox')) {
    return 'firefox';
  } else if (userAgent.includes('Edg')) {
    return 'edge';
  } else if (userAgent.includes('Chrome')) {
    return 'chrome';
  } else if (userAgent.includes('Safari')) {
    return 'safari';
  }
  return 'unknown';
};
