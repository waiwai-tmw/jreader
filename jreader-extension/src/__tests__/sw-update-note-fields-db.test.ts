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
      session: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
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

  // Mock Supabase client with update tracking
  const mockSupabaseUpdate = vi.fn();
  const mockSupabaseIn = vi.fn();
  const mockSupabaseSelect = vi.fn();

  // Chain the methods properly
  mockSupabaseSelect.mockReturnValue(Promise.resolve({ error: null, count: 1 }));
  mockSupabaseIn.mockReturnValue({ select: mockSupabaseSelect });
  mockSupabaseUpdate.mockReturnValue({ in: mockSupabaseIn });

  const mockSupabaseClient = {
    from: vi.fn(() => ({
      update: mockSupabaseUpdate,
    })),
  };

  return {
    mockBrowser,
    mockSupabaseClient,
    mockSupabaseUpdate,
    mockSupabaseIn,
    mockSupabaseSelect,
  };
});

// Mock webextension-polyfill with the hoisted browser
vi.mock('webextension-polyfill', () => ({
  default: h.mockBrowser,
}));

// Mock extensionAuth with our Supabase client mock
vi.mock('@/lib/extensionAuth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'test-token' })),
  restoreSessionIfAny: vi.fn(async () => null),
  isAuthenticated: vi.fn(async () => true),
  getClient: vi.fn(() => h.mockSupabaseClient),
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

describe('Service Worker: anki.updateNoteFields Supabase updates', () => {
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
                  audioToUpload: [],
                  imagesToUpload: [],
                },
              },
              {
                request: {
                  action: 'updateNoteFields',
                  version: 6,
                  params: { note: { id: 9876543210, fields: { Word: '飲む' } } },
                },
                mediaPlan: {
                  cardId: 5,
                  audioToUpload: [],
                  imagesToUpload: [],
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

  it('should update both synced_at and updated_at in Supabase after successful Anki sync', async () => {
    const response: any = await triggerRuntimeMessage({
      type: SW_EVENT_ANKI_UPDATE_NOTE_FIELDS,
      cardIds: [2, 5],
    });

    expect(response.success).toBe(true);

    // Verify Supabase update was called
    expect(h.mockSupabaseClient.from).toHaveBeenCalledWith('cards');
    expect(h.mockSupabaseUpdate).toHaveBeenCalled();

    // Get the update call arguments
    const updateCall = h.mockSupabaseUpdate.mock.calls[0]?.[0];
    expect(updateCall).toBeDefined();

    // Verify both synced_at and updated_at are being set
    expect(updateCall).toHaveProperty('synced_at');
    expect(updateCall).toHaveProperty('updated_at');

    // Verify they have the same timestamp
    expect(updateCall.synced_at).toBe(updateCall.updated_at);

    // Verify timestamp is a valid ISO string
    expect(new Date(updateCall.synced_at).toISOString()).toBe(updateCall.synced_at);

    // Verify the correct card IDs were updated
    expect(h.mockSupabaseIn).toHaveBeenCalledWith('id', [2, 5]);
  });

  it('should only update cards that successfully synced to Anki', async () => {
    // Mock one successful and one failed AnkiConnect call
    let callCount = 0;
    (global.fetch as any) = vi.fn(async (input: any, _init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input?.toString?.() ?? '';

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
                  audioToUpload: [],
                  imagesToUpload: [],
                },
              },
              {
                request: {
                  action: 'updateNoteFields',
                  version: 6,
                  params: { note: { id: 9876543210, fields: { Word: '飲む' } } },
                },
                mediaPlan: {
                  cardId: 5,
                  audioToUpload: [],
                  imagesToUpload: [],
                },
              },
            ],
            skippedCards: [],
          }),
          text: async () => 'OK',
        } as any;
      }

      // First AnkiConnect call succeeds, second fails
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          json: async () => ({ result: null, error: null }),
        } as any;
      } else {
        return {
          ok: true,
          json: async () => ({ result: null, error: 'AnkiConnect error' }),
        } as any;
      }
    });

    const response: any = await triggerRuntimeMessage({
      type: SW_EVENT_ANKI_UPDATE_NOTE_FIELDS,
      cardIds: [2, 5],
    });

    expect(response.success).toBe(true);
    expect(response.results).toHaveLength(2);
    expect(response.results[0].success).toBe(true);
    expect(response.results[1].success).toBe(false);

    // Verify only the successful card (2) was updated in Supabase
    expect(h.mockSupabaseIn).toHaveBeenCalledWith('id', [2]);
  });

  it('should not update Supabase if no cards successfully synced', async () => {
    // Mock all AnkiConnect calls to fail
    (global.fetch as any) = vi.fn(async (input: any, _init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input?.toString?.() ?? '';

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
                  audioToUpload: [],
                  imagesToUpload: [],
                },
              },
            ],
            skippedCards: [],
          }),
          text: async () => 'OK',
        } as any;
      }

      // AnkiConnect call fails
      return {
        ok: true,
        json: async () => ({ result: null, error: 'AnkiConnect error' }),
      } as any;
    });

    const response: any = await triggerRuntimeMessage({
      type: SW_EVENT_ANKI_UPDATE_NOTE_FIELDS,
      cardIds: [2],
    });

    expect(response.success).toBe(true);
    expect(response.results[0].success).toBe(false);

    // Verify Supabase update was NOT called (no successful syncs)
    expect(h.mockSupabaseUpdate).not.toHaveBeenCalled();
  });
});
