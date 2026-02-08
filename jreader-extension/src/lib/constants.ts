import { SW_EVENT_AUTH_IS_AUTHENTICATED } from '@jreader/shared-types-ts/extensionAvailability';

// Shared constants for service worker event names
export const SW_EVENT_SUPABASE_GET_CLIENT = 'supabase.getClient' as const;
export const SW_EVENT_SUPABASE_GET_USER = 'supabase.getUser' as const;
export const SW_EVENT_SUPABASE_GET_CARDS = 'supabase.getCards' as const;
export const SW_EVENT_SUPABASE_TEST_CONNECTION = 'supabase.testConnection' as const;

export const SW_EVENT_ANKI_OPEN_NOTE = 'anki.openNote' as const;
export const SW_EVENT_ANKI_CHECK_HEALTH = 'anki.checkHealth' as const;
export const SW_EVENT_ANKI_SYNC_CARDS = 'anki.syncCards' as const;
export const SW_EVENT_ANKI_UPDATE_NOTE_FIELDS = 'anki.updateNoteFields' as const;

export const SW_EVENT_AUTH_SIGN_IN_DISCORD = 'auth.signInDiscord' as const;
export const SW_EVENT_AUTH_SIGN_OUT = 'auth.signOut' as const;
export const SW_EVENT_AUTH_GET_CURRENT_SESSION = 'auth.getCurrentSession' as const;

// Default response for unknown messages
export const SW_EVENT_KNOWN_TYPES = [
    SW_EVENT_SUPABASE_GET_CLIENT,
    SW_EVENT_SUPABASE_GET_USER,
    SW_EVENT_SUPABASE_GET_CARDS,
    SW_EVENT_SUPABASE_TEST_CONNECTION,
    SW_EVENT_ANKI_SYNC_CARDS,
    SW_EVENT_ANKI_UPDATE_NOTE_FIELDS,
    SW_EVENT_ANKI_OPEN_NOTE,
    SW_EVENT_ANKI_CHECK_HEALTH,
    SW_EVENT_AUTH_SIGN_IN_DISCORD,
    SW_EVENT_AUTH_SIGN_OUT,
    SW_EVENT_AUTH_GET_CURRENT_SESSION,
    SW_EVENT_AUTH_IS_AUTHENTICATED
];

export const CONTENT_SCRIPT_EVENT_UPDATE_EXTENSION_STATUS = 'extension.updateStatus' as const;
export const CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH = 'extension.anki.checkHealth' as const;
export const CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH_RESPONSE = 'extension.anki.checkHealth.response' as const;
export const CONTENT_SCRIPT_EVENT_ANKI_SYNC_CARDS = 'extension.anki.syncCards' as const;
export const CONTENT_SCRIPT_EVENT_ANKI_SYNC_CARDS_RESPONSE = 'extension.anki.syncCards.response' as const;
export const CONTENT_SCRIPT_EVENT_ANKI_OPEN_NOTE = 'extension.anki.openNote' as const;
export const CONTENT_SCRIPT_EVENT_ANKI_OPEN_NOTE_RESPONSE = 'extension.anki.openNote.response' as const;
export const CONTENT_SCRIPT_EVENT_ANKI_UPDATE_NOTE_FIELDS = 'extension.anki.updateNoteFields' as const;
export const CONTENT_SCRIPT_EVENT_ANKI_UPDATE_NOTE_FIELDS_RESPONSE = 'extension.anki.updateNoteFields.response' as const;

export const POPUP_EVENT_AUTH_CHANGED = 'popup.auth.changed' as const;
