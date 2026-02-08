import type { KanjiState } from '@/utils/kanjiState';

export type KanjiStateChangeEvent = CustomEvent<{
  kanji: string;
  newState: KanjiState;
}>;

declare global {
  interface WindowEventMap {
    'kanjistatechange': KanjiStateChangeEvent;
  }
}

// These constants MUST match the corresponding values defined in the extension
// at `jreader-extension/src/lib/constants.ts` so cross-origin messaging stays in sync.
export const EXTENSION_CONTENT_SCRIPT_EVENT_UPDATE_EXTENSION_STATUS = 'extension.updateStatus' as const;

export const EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH = 'extension.anki.checkHealth' as const;
export const EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH_RESPONSE = 'extension.anki.checkHealth.response' as const;
export const EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_SYNC_CARDS = 'extension.anki.syncCards' as const;
export const EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_SYNC_CARDS_RESPONSE = 'extension.anki.syncCards.response' as const;
export const EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_OPEN_NOTE = 'extension.anki.openNote' as const;
export const EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_OPEN_NOTE_RESPONSE = 'extension.anki.openNote.response' as const;
export const EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_UPDATE_NOTE_FIELDS = 'extension.anki.updateNoteFields' as const;
export const EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_UPDATE_NOTE_FIELDS_RESPONSE = 'extension.anki.updateNoteFields.response' as const;
