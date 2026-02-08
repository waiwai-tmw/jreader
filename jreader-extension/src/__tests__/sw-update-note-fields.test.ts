import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { SW_EVENT_ANKI_UPDATE_NOTE_FIELDS } from '@/lib/constants';

// Hoist the browser mock so vi.mock can reference it safely
const h = vi.hoisted(() => {
  const mockBrowser = {
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
      },
    },
    runtime: {
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      onConnect: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      onInstalled: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      onStartup: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      getManifest: vi.fn(() => ({ version: '1.0.0' })),
      id: 'test-extension-id',
    },
  } as any;
  return { mockBrowser };
});

// Mock webextension-polyfill with the hoisted browser
vi.mock('webextension-polyfill', () => ({
  default: h.mockBrowser,
}));

// Mock extensionAuth used for access token (hoisted)
vi.mock('@/lib/extensionAuth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'test-token' })),
  restoreSessionIfAny: vi.fn(async () => null),
  isAuthenticated: vi.fn(async () => true),
}));

// Mock anki-comm uploadMediaPlansToAnki used inside handler (hoisted)
vi.mock('../anki-comm', () => ({
  uploadMediaPlansToAnki: vi.fn(async () => ({ uploaded: 1 })),
  checkAnkiConnectHealth: vi.fn(),
  openAnkiNote: vi.fn(),
}));

// Helper to simulate sending a message into the registered onMessage listener
async function triggerRuntimeMessage(message: any) {
  const addListener = h.mockBrowser.runtime.onMessage.addListener;
  expect(addListener).toHaveBeenCalled();
  const listener = addListener.mock.calls[0][0];
  return await new Promise((resolve) => {
    const sendResponse = (resp: any) => resolve(resp);
    const result = listener(message, { tab: undefined }, sendResponse);
    expect(result).toBe(true);
  });
}

describe('Service Worker: anki.updateNoteFields handler', () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Default fetch mock - success path for both API and AnkiConnect
    (global.fetch as any) = vi.fn(async (input: any, _init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input?.toString?.() ?? '';
      // API call to our Next.js endpoint returns an update plan
      if (url.includes('/api/ankiconnect')) {
        return {
          ok: true,
          json: async () => ({
            requests: [
              {
                request: {
                  action: 'updateNoteFields',
                  version: 6,
                  params: { note: { id: 1234567890, fields: { Word: '食べる' } } },
                },
                mediaPlan: {
                  cardId: 2,
                  audioToUpload: [
                    { fieldName: 'ExpressionAudio', sourceUrl: 'https://example.com/a.mp3', ankiFilename: 'jreader_id_2.mp3' },
                  ],
                  imagesToUpload: [
                    { fieldName: 'main_definition_image_hash_0', dictionary: 'Daijirin', sourcePath: 'Daijirin/images/food.png', ankiFilename: 'jreader_Daijirin_images_food.png' },
                  ],
                },
              },
            ],
            skippedCards: [],
          }),
          text: async () => 'OK',
        } as any;
      }

      // AnkiConnect call returns success
      return {
        ok: true,
        json: async () => ({ result: null, error: null }),
        text: async () => 'OK',
      } as any;
    });

    // Provide storage.local values used by handler
    h.mockBrowser.storage.local.get.mockImplementation(async (keys: string[] | any) => {
      const wanted = Array.isArray(keys) ? keys : [keys];
      const map: Record<string, any> = {};
      for (const k of wanted) {
        if (k === 'anki_connect_url') map[k] = 'http://127.0.0.1:8765';
        if (k === 'anki_deck') map[k] = 'Japanese::Mining';
        if (k === 'anki_note_type') map[k] = 'Mining';
        if (k === 'fieldMappings') map[k] = { Word: '{expression}' };
        if (k === 'api_base_url') map[k] = 'https://example.local';
        if (k === 'extension_version') map[k] = '1.0.0';
      }
      return map;
    });

    // Import the service worker after mocks are set
    await import('../sw-main');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should execute update flow successfully', async () => {
    const response: any = await triggerRuntimeMessage({
      type: SW_EVENT_ANKI_UPDATE_NOTE_FIELDS,
      cardIds: [1, 2, 3],
    });

    expect(response.success).toBe(true);
    expect(Array.isArray(response.results)).toBe(true);
    expect(response.results[0]).toMatchObject({ cardId: 2, success: true });
  });

  it('should fail when Anki settings are not configured', async () => {
    // Make storage return missing settings once (for the settings get([...]) call)
    h.mockBrowser.storage.local.get.mockResolvedValueOnce({});

    const response: any = await triggerRuntimeMessage({
      type: SW_EVENT_ANKI_UPDATE_NOTE_FIELDS,
      cardIds: [1],
    });

    expect(response.success).toBe(false);
    expect(response.error).toBe('Anki settings not configured');
  });

  it('should surface API error when planning endpoint fails', async () => {
    // Reset fetch to emulate failed planning API response (first fetch call)
    (global.fetch as any).mockImplementationOnce(async (_url: string) => ({
      ok: false,
      text: async () => 'Server error',
    }));

    const response: any = await triggerRuntimeMessage({
      type: SW_EVENT_ANKI_UPDATE_NOTE_FIELDS,
      cardIds: [2],
    });

    expect(response.success).toBe(false);
    expect(response.error).toBe('Server error');
  });
});
