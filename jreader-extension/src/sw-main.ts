// Main service worker module with Supabase configured for service workers
import 'webextension-polyfill';
import { ServiceWorkerEventAuthIsAuthenticatedResponse, SW_EVENT_AUTH_IS_AUTHENTICATED } from '@jreader/shared-types-ts/extensionAvailability';
import type { Runtime } from 'webextension-polyfill';

import { checkAnkiConnectHealth, openAnkiNote } from './anki-comm';
import { AuthErrorHandler, withAuthErrorHandling } from './lib/authErrorHandler';
import { AuthNotificationHandler } from './lib/authNotificationHandler';

import { browser, getBrowserInfo } from '@/lib/browser';
import { SW_EVENT_SUPABASE_GET_CLIENT, SW_EVENT_SUPABASE_GET_USER, SW_EVENT_SUPABASE_GET_CARDS, SW_EVENT_SUPABASE_TEST_CONNECTION, SW_EVENT_ANKI_SYNC_CARDS, SW_EVENT_ANKI_OPEN_NOTE, SW_EVENT_ANKI_CHECK_HEALTH, SW_EVENT_ANKI_UPDATE_NOTE_FIELDS, SW_EVENT_AUTH_SIGN_IN_DISCORD, SW_EVENT_AUTH_SIGN_OUT, SW_EVENT_AUTH_GET_CURRENT_SESSION, SW_EVENT_KNOWN_TYPES } from '@/lib/constants';


console.log('Main service worker module loaded');
console.log('Browser:', getBrowserInfo());

// Port keep-alive mechanism to prevent SW from dying during OAuth
let keepAlivePort: Runtime.Port | null = null;

browser.runtime.onConnect.addListener((port) => {
  if (port.name === 'auth-keepalive') {
    console.log('🔐 [SW] Keep-alive port connected');
    keepAlivePort = port;

    port.onDisconnect.addListener(() => {
      console.log('🔐 [SW] Keep-alive port disconnected');
      if (keepAlivePort === port) {
        keepAlivePort = null;
      }
    });
  }
});

// Helper to send status updates to UI via Port
function sendAuthStatus(stage: string) {
  try {
    if (keepAlivePort) {
      keepAlivePort.postMessage({ type: 'auth:status', stage });
      console.log('🔐 [SW] Auth status sent:', stage);
    }
  } catch (error) {
    console.log('🔐 [SW] Could not send auth status:', error);
  }
}

// Chrome storage adapter (MV3 SW-safe)
const storage = {
  async getItem(key: string) {
    const v = await browser.storage.session.get([key]);
    return (v as any)[key] ?? null;
  },
  async setItem(key: string, value: string) {
    await browser.storage.session.set({ [key]: value });
  },
  async removeItem(key: string) {
    if (browser.storage?.session?.remove) {
      await browser.storage.session.remove([key]);
    }
  },
};

// Initialize Supabase with service worker-safe configuration
let supabase: any = null;

// Lazy hydration function to ensure auth is ready on any request
async function ensureAuthHydrated(): Promise<void> {
  // If our local sw-main.ts client isn't set, rehydrate from extensionAuth singleton
  const { getCurrentSession, restoreSessionIfAny } = await import('@/lib/extensionAuth');
  const session = await getCurrentSession();
  if (!session) {
    await restoreSessionIfAny(); // this will call supabase.auth.setSession() inside extensionAuth's client
  }
  console.log('🔍 Extension service worker: Auth hydrated:', session)
}

async function initializeSupabase() {
  try {
    console.log('Initializing Supabase for service worker...');

    // Dynamic import to avoid top-level issues
    const { createClient } = await import('@supabase/supabase-js');

    // Get Supabase config from storage or environment
    const config = await browser.storage.local.get(['supabase_url', 'supabase_anon_key']) as { supabase_url?: string; supabase_anon_key?: string };

    if (!config.supabase_url || !config.supabase_anon_key) {
      console.log('No Supabase config found, skipping initialization');
      return null;
    }

    supabase = createClient(config.supabase_url as string, config.supabase_anon_key as string, {
      auth: {
        storage,
        storageKey: 'jreader_sw_auth',
        autoRefreshToken: false,     // SW sleeps; don't rely on timers
        persistSession: true,
        detectSessionInUrl: false,   // no window.location in SW
        flowType: 'pkce',            // typical for browser envs
      },
      global: {
        fetch: fetch.bind(globalThis), // explicit in worker env
      },
    });

    console.log('Supabase initialized in service worker');
    return supabase;
  } catch (error) {
    console.error('Failed to initialize Supabase:', error);
    return null;
  }
}

// Note: getMainDefinition, extractTextFromDefinition, and objectToStyleString
// are now imported from './lib/definitionProcessing'

// Note: getGlossary is now imported from './lib/definitionProcessing'

// Message listener for communication with content scripts and popup
browser.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any): true => {
  // Legacy auth bridge removed: no special handling for content-bridge messages
  console.log('Message received:', {
    type: request?.type,
    sender: {
      tab: sender?.tab?.id,
      frameId: sender?.frameId,
      url: sender?.url,
      origin: sender?.origin
    },
    request: request,
    timestamp: new Date().toISOString()
  });

  // Debug: Log all message types to see what's coming through
  console.log('🔍 Message type received:', request?.type);

  if (!SW_EVENT_KNOWN_TYPES.includes(request?.type)) {
    console.error('❌ Message of unknown type received by service worker', {
      sender,
      request,
      timestamp: new Date().toISOString()
    });
    sendResponse({
      ok: false,
      error: 'Unknown message type',
      type: request?.type
    });
    return true;
  }

  if (request?.type === SW_EVENT_SUPABASE_GET_CLIENT) {
    void (async () => {
      try {
        await ensureAuthHydrated();

        // Instead of looking at sw-main's own `supabase`, ask extensionAuth for truth:
        const { getCurrentSession } = await import('@/lib/extensionAuth');
        const session = await getCurrentSession();

        const hasClient = !!session;               // true if extensionAuth client is alive
        const isSessionValid = !!session?.access_token;

        sendResponse({
          hasClient,
          isSessionValid
        });
      } catch (error: any) {
        console.error(`Error in ${SW_EVENT_SUPABASE_GET_CLIENT}:`, error);
        sendResponse({
          hasClient: false,
          isSessionValid: false,
          error: error?.message
        });
      }
    })();
    return true;
  }

  if (request?.type === SW_EVENT_SUPABASE_GET_USER) {
    void (async () => {
      try {
        await ensureAuthHydrated();

        // Use extensionAuth client as source of truth
        const { getCurrentSession } = await import('@/lib/extensionAuth');
        const session = await getCurrentSession();

        if (!session?.user) {
          sendResponse({ user: null, error: 'No user in session' });
          return;
        }

        sendResponse({ user: session.user });
      } catch (error: any) {
        console.error(`Error in ${SW_EVENT_SUPABASE_GET_USER}:`, error);
        sendResponse({ user: null, error: 'Unexpected error occurred' });
      }
    })();
    return true;
  }

  if (request?.type === SW_EVENT_SUPABASE_GET_CARDS) {
    void (async () => {
      try {
        await ensureAuthHydrated();

        // Use extensionAuth client as source of truth
        const { getClient } = await import('@/lib/extensionAuth');
        const client = getClient();

        console.log('🔐 Getting cards from extensionAuth client...');

        const { data: cards, error } = await client
          .from('cards')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching cards:', error);
          sendResponse({ success: false, cards: [], error: error.message });
          return;
        }

        console.log('🔐 Retrieved cards:', cards?.length || 0, 'cards');
        sendResponse({ success: true, cards: cards || [] });

      } catch (error: any) {
        console.error(`Error in ${SW_EVENT_SUPABASE_GET_CARDS}:`, error);
        sendResponse({ success: false, cards: [], error: error?.message || 'Unexpected error occurred' });
      }
    })();
    return true;
  }

  // Unified API: sync a provided list of card IDs (or raw cards) in one go using addNotes
  if (request?.type === SW_EVENT_ANKI_SYNC_CARDS) {
    void (async () => {
      try {
        // Use extensionAuth client as source of truth
        const { getClient } = await import('@/lib/extensionAuth');
        const client = getClient();

        // Let the API determine which cards to sync; optionally pass through provided cardIds

        // Settings and mappings
        const { fieldMappings, anki_connect_url, anki_deck, anki_note_type } = await browser.storage.local.get([
          'fieldMappings', 'anki_connect_url', 'anki_deck', 'anki_note_type'
        ]) as { fieldMappings?: Record<string, any>; anki_connect_url?: string; anki_deck?: string; anki_note_type?: string };
        if (!anki_connect_url || !anki_deck || !anki_note_type) {
          sendResponse({ success: false, error: 'Anki settings not configured' });
          return;
        }
        const ankiSettings = { anki_connect_url: anki_connect_url as string, anki_deck: anki_deck as string, anki_note_type: anki_note_type as string };

        // Resolve API base URL from extension storage
        const apiConfig = await browser.storage.local.get(['api_base_url']);
        const apiBaseUrl = (apiConfig['api_base_url'] as string | undefined) || 'https://waiwais-macbook-pro-2.unicorn-lime.ts.net';

        // Get access token for auth header (if available)
        const { data: sessionData } = await client.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        // Ask server to build the plan (notes + media)
        // Build request payload clearly
        const requestPayload: any = {
          ankiSettings,
          fieldMappings: fieldMappings || {}
        };

        let payloadCardIds: string[] | undefined;
        if (Array.isArray(request.cardIds) && request.cardIds.length > 0) {
          payloadCardIds = request.cardIds as string[];
        } else if (Array.isArray(request.cards) && request.cards.length > 0) {
          payloadCardIds = (request.cards as any[]).map((c: any) => c.id);
        }

        if (payloadCardIds && payloadCardIds.length > 0) {
          requestPayload.cardIds = payloadCardIds;
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const planResponse = await fetch(`${apiBaseUrl}/api/ankiconnect`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(requestPayload)
        });

        if (!planResponse.ok) {
          const errorText = await planResponse.text();
          sendResponse({ success: false, error: errorText || 'Failed to build Anki plan' });
          return;
        }

        const { addNotesRequest, mediaPlans } = await planResponse.json();
        console.log('🧩 Received Anki plan:', {
          notesCount: addNotesRequest?.params?.notes?.length || 0,
          mediaPlansCount: Array.isArray(mediaPlans) ? mediaPlans.length : 0
        });

        // Upload audio and images to Anki media per plan via helper
        const { uploadMediaPlansToAnki } = await import('./anki-comm');
        const mediaStats = await uploadMediaPlansToAnki(ankiSettings.anki_connect_url, mediaPlans);

        // Finally send addNotes to AnkiConnect
        const ankiResp = await fetch(ankiSettings.anki_connect_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(addNotesRequest)
        });

        const ankiResult = await ankiResp.json();
        if (ankiResult.error) {
          sendResponse({ success: false, error: ankiResult.error });
          return;
        }

        // Map results back to cards and update Supabase
        const resultArray: Array<number | null> | null = ankiResult.result ?? null;
        if (!Array.isArray(resultArray)) {
          sendResponse({ success: false, error: 'Unexpected addNotes response' });
          return;
        }

        const updates: Array<{ id: number; sync_status: string; synced_at: string; anki_note_id: string; anki_model: string; anki_deck: string }> = [];
        resultArray.forEach((noteId, idx) => {
          const cardId = mediaPlans[idx]?.cardId;
          if (!cardId) return;
          if (noteId && typeof noteId === 'number') {
            updates.push({
              id: cardId, // Already a number from the server
              sync_status: 'pushed',
              synced_at: new Date().toISOString(),
              anki_note_id: noteId.toString(),
              anki_model: ankiSettings.anki_note_type,
              anki_deck: ankiSettings.anki_deck
            });
          }
        });

        if (updates.length > 0) {
          // Use update() for partial updates of existing cards
          // upsert() would try to set unprovided columns to null
          for (const update of updates) {
            const { error: updateError } = await client
              .from('cards')
              .update({
                sync_status: update.sync_status,
                synced_at: update.synced_at,
                anki_note_id: update.anki_note_id,
                anki_model: update.anki_model,
                anki_deck: update.anki_deck
              })
              .eq('id', update.id);

            if (updateError) {
              console.error(`❌ Failed to update card ${update.id}:`, updateError);
            }
          }
          console.log('✅ Batch updated cards in Supabase:', updates.length);
        } else {
          console.log('ℹ️ No successful notes to update in Supabase');
        }

        console.log('✅ Anki sync complete. Media stats:', mediaStats);
        sendResponse({ success: true, results: resultArray, mediaStats });
      } catch (error: any) {
        console.error('Error in SYNC_CARDS:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request?.type === SW_EVENT_SUPABASE_TEST_CONNECTION) {
    void (async () => {
      try {
        if (!supabase) {
          sendResponse({ success: false, error: 'Supabase not initialized' });
          return;
        }

        const { error } = await supabase.auth.getSession();
        sendResponse({
          success: !error,
          message: error ? error.message : 'Connected successfully'
        });
      } catch (error: any) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request?.type === SW_EVENT_ANKI_UPDATE_NOTE_FIELDS) {
    void (async () => {
      try {
        console.log('🔄 Processing updateNoteFields request:', {
          cardIds: request.cardIds?.length || 0,
          request
        });

        // Get Anki settings from storage
        const { anki_connect_url, anki_deck, anki_note_type, fieldMappings } = await browser.storage.local.get([
          'anki_connect_url', 'anki_deck', 'anki_note_type', 'fieldMappings'
        ]);

        if (!anki_connect_url || !anki_deck || !anki_note_type) {
          sendResponse({ success: false, error: 'Anki settings not configured' });
          return;
        }

        // Resolve API base URL from extension storage
        const apiConfig = await browser.storage.local.get(['api_base_url']);
        const apiBaseUrl = (apiConfig['api_base_url'] as string | undefined) || 'https://waiwais-macbook-pro-2.unicorn-lime.ts.net';

        // Get access token for auth header (if available)
        const { getCurrentSession } = await import('@/lib/extensionAuth');
        const session = await getCurrentSession();
        const accessToken = session?.access_token;

        // Build request payload
        const requestPayload = {
          cardIds: request.cardIds,
          fieldMappings: fieldMappings || {}
        };

        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }

        // Call the API endpoint (PUT /api/ankiconnect)
        const response = await fetch(`${apiBaseUrl}/api/ankiconnect`, {
          method: 'PUT',
          headers,
          credentials: 'include',
          body: JSON.stringify(requestPayload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          sendResponse({ success: false, error: errorText || 'Failed to update cards' });
          return;
        }

        const { requests, skippedCards } = await response.json();
        console.log('🧩 Received update plan:', {
          requestsCount: requests?.length || 0,
          skippedCount: skippedCards?.length || 0
        });

        console.log('🎯 Executing update requests:', {
          requestCount: requests?.length || 0,
          skippedCount: skippedCards?.length || 0
        });

        // Execute each update request
        const results = [];
        for (const { request: updateRequest, mediaPlan } of requests) {
          console.log('📝 Processing update request:', {
            cardId: mediaPlan.cardId,
            updateRequest: updateRequest,
            hasAudio: mediaPlan.audioToUpload.length > 0,
            hasImages: mediaPlan.imagesToUpload.length > 0
          });
          // Upload media first
          const { uploadMediaPlansToAnki } = await import('./anki-comm');
          const mediaStats = await uploadMediaPlansToAnki(anki_connect_url as string, [mediaPlan]);

          // Send updateNoteFields request
          const ankiResp = await fetch(anki_connect_url as string, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateRequest)
          });

          const ankiResult = await ankiResp.json();
          const success = !ankiResult.error;

          console.log(`${success ? '✅' : '❌'} Update result for card ${mediaPlan.cardId}:`, {
            success,
            error: ankiResult.error,
            mediaStats
          });

          results.push({
            cardId: mediaPlan.cardId,
            success,
            error: ankiResult.error,
            mediaStats
          });
        }

        // After successful updates, update synced_at for those cards in Supabase (best-effort)
        try {
          const extAuthModule: any = await import('@/lib/extensionAuth');
          const getClient = typeof extAuthModule.getClient === 'function' ? extAuthModule.getClient : null;
          if (getClient) {
            const client = getClient();
            const successfulIds = (results as any[])
              .filter((r: any) => r?.success)
              .map((r: any) => r?.cardId)
              .filter((id: any) => typeof id === 'number');

            if (successfulIds.length > 0) {
              const timestamp = new Date().toISOString();
              const { error: updateError, count } = await client
                .from('cards')
                .update({ synced_at: timestamp, updated_at: timestamp })
                .in('id', successfulIds)
                .select('id', { count: 'exact', head: true });
              if (updateError) {
                console.error('❌ Failed to bulk update synced_at and updated_at:', updateError);
              } else {
                console.log(`✅ Updated synced_at and updated_at for ${count ?? successfulIds.length} cards:`, successfulIds);
              }
            } else {
              console.log('ℹ️ No successful card updates to persist to Supabase');
            }
          } else {
            console.log('ℹ️ Supabase client not available; skipping synced_at updates');
          }
        } catch (e) {
          console.warn('⚠️ Error while updating synced_at for updated cards:', e);
        }

        console.log('✅ Anki updates complete. Results:', results);
        sendResponse({
          success: true,
          results,
          skippedCards
        });
      } catch (error: any) {
        console.error('Error in UPDATE_NOTE_FIELDS:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request?.type === SW_EVENT_ANKI_OPEN_NOTE) {
    void (async () => {
      try {
        console.log('Opening Anki note:', request.noteId);

        // Get Anki settings from storage
        const { anki_connect_url } = await browser.storage.local.get(['anki_connect_url']) as { anki_connect_url?: string };

        if (!anki_connect_url) {
          sendResponse({ success: false, error: 'Anki settings not configured' });
          return;
        }

        const ankiResponse = await openAnkiNote(request.noteId, anki_connect_url);

        const ankiResult = await ankiResponse.json();
        if (ankiResult.error) {
          console.error('Anki error opening note:', ankiResult.error);
          sendResponse({ success: false, error: ankiResult.error });
        } else {
          console.log('Successfully opened Anki note:', request.noteId);
          sendResponse({ success: true, message: 'Note opened in Anki' });
        }
      } catch (error: any) {
        console.error('Error opening Anki note:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request?.type === SW_EVENT_ANKI_CHECK_HEALTH) {
    console.log('✅ CHECK_ANKI_HEALTH handler triggered!');
    void (async () => {
      try {
        console.log('🔍 Processing AnkiConnect health check request');

        // Get Anki settings from storage
        const { anki_connect_url } = await browser.storage.local.get(['anki_connect_url']);

        if (!anki_connect_url) {
          sendResponse({
            available: false,
            error: 'AnkiConnect URL not configured',
            configured: false
          });
          return;
        }

        const healthResult = await checkAnkiConnectHealth(anki_connect_url as string);
        sendResponse({
          available: healthResult.available,
          error: healthResult.error,
          configured: true
        });

      } catch (error: any) {
        console.error('Error checking AnkiConnect health:', error);
        sendResponse({
          available: false,
          error: error.message,
          configured: true
        });
      }
    })();
    return true;
  }

  // New Discord OAuth auth handlers
  if (request?.type === SW_EVENT_AUTH_SIGN_IN_DISCORD) {
    void (async () => {
      try {
        console.log('🔐 [SW] Starting Discord OAuth sign-in...');
        sendAuthStatus('starting');

        const { signInWithDiscord } = await import('@/lib/extensionAuth');
        const session = await signInWithDiscord();

        console.log('🔐 [SW] Discord OAuth sign-in successful:', {
          userId: session.user?.id,
          email: session.user?.email
        });

        sendAuthStatus('completed');
        sendResponse({ ok: true, user: session.user });
      } catch (error: any) {
        console.error('🔐 [SW] Discord OAuth sign-in failed:', error);
        sendAuthStatus('error');
        sendResponse({ ok: false, error: error?.message ?? String(error) });
      }
    })();
    return true;
  }

  if (request?.type === SW_EVENT_AUTH_SIGN_OUT) {
    void (async () => {
      try {
        console.log('🔐 Starting sign-out...');
        const { signOut } = await import('@/lib/extensionAuth');
        await signOut();

        console.log('🔐 Sign-out successful');
        sendResponse({ ok: true });
      } catch (error: any) {
        console.error('🔐 Sign-out failed:', error);
        sendResponse({ ok: false, error: error?.message ?? String(error) });
      }
    })();
    return true;
  }

  if (request?.type === SW_EVENT_AUTH_GET_CURRENT_SESSION) {
    void (async () => {
      try {
        const { getCurrentSession } = await import('@/lib/extensionAuth');
        const session = await getCurrentSession();

        sendResponse({ ok: true, session });
      } catch (error: any) {
        console.error('Error getting current session:', error);
        sendResponse({ ok: false, error: error?.message ?? String(error) });
      }
    })();
    return true;
  }

  if (request?.type === SW_EVENT_AUTH_IS_AUTHENTICATED) {
    console.log('[ServiceWorker] SW_EVENT_AUTH_IS_AUTHENTICATED - started');
    void (async () => {
      let resp: ServiceWorkerEventAuthIsAuthenticatedResponse;
      try {
        // Ensure any persisted session is restored before answering
        await ensureAuthHydrated();
        const { isAuthenticated } = await import('@/lib/extensionAuth');
        if (await isAuthenticated()) {
          resp = ServiceWorkerEventAuthIsAuthenticatedResponse.makeAuthenticated();
        } else {
          resp = ServiceWorkerEventAuthIsAuthenticatedResponse.makeUnauthenticated();
        }
        sendResponse(resp);
      } catch (error: any) {
        console.error('Error checking authentication status:', error);
        resp = ServiceWorkerEventAuthIsAuthenticatedResponse.makeUnavailable(error as string);
      }
      console.log(`[ServiceWorker] SW_EVENT_AUTH_IS_AUTHENTICATED - resp=${JSON.stringify(resp)}`);
      sendResponse(resp);
    })();
    return true;
  }

  // Should never be reached because we already rejected unknown message types
  console.warn('Unhandled message type received by service worker:', request?.type);
  sendResponse({
    ok: false,
    error: 'Unhandled message type',
    type: request?.type
  });
  return true;
});

// Extension lifecycle events
browser.runtime.onInstalled.addListener((details: any) => {
  void (async () => {
    console.log('JReader Extension installed/updated:', {
      reason: details.reason,
      previousVersion: details.previousVersion,
      timestamp: new Date().toISOString()
    });

    // Clear all extension data on fresh install or reload
    if (browser.storage && browser.storage.local) {
      try {
        if (details.reason === 'install') {
          // Fresh install - clear everything
          await browser.storage.local.clear();
          console.log('Fresh install detected - cleared all storage');
        } else if (details.reason === 'update') {
          // Extension update - clear legacy keys but keep current session
          await browser.storage.local.remove([
            'device_token',
            'pairing_in_progress',
            'navigateToSection'
            // Note: DO NOT remove supabaseSession, supabase_url, supabase_anon_key
            // to preserve authentication across extension updates
          ]);
          console.log('Extension update detected - cleared legacy data, preserved session');
        } else {
          // Other reasons (like reload) - clear session data
          await browser.storage.local.remove([
            'device_token',
            'supabaseSession',
            'supabase_url',
            'supabase_anon_key',
            'pairing_in_progress',
            'navigateToSection'
          ]);
          console.log('Extension reload detected - cleared session data');
        }
      } catch (error) {
        console.error('Error clearing storage on install/update:', error);
      }
    }
  })();
});

browser.runtime.onStartup.addListener(() => {
  void (async () => {
    console.log('Extension startup - checking for existing session');

    try {
      // Try to restore session using the new auth module first
      const { restoreSessionIfAny } = await import('@/lib/extensionAuth');
      const session = await restoreSessionIfAny();

      if (session) {
        console.log('✅ Session restored using new auth module:', {
          userId: session.user?.id,
          email: session.user?.email
        });
      } else {
        // Fallback to old method for backward compatibility
        const result = await browser.storage.local.get(['supabaseSession']) as { supabaseSession?: any };
        console.log('Storage check result:', {
          hasSession: !!result.supabaseSession,
          sessionKeys: Object.keys(result),
          timestamp: new Date().toISOString()
        });

        if (result.supabaseSession) {
          console.log('Found existing Supabase session, initializing...');
          await initializeSupabase();
        } else {
          console.log('No existing Supabase session found');
        }
      }
    } catch (error) {
      console.error('Error checking storage on startup:', error);
    }
  })();
});

// Session validation utility
async function validateStoredSession(session: any): Promise<{ isValid: boolean; reason?: string }> {
  try {
    // Check if session has required fields
    if (!session.access_token || !session.refresh_token) {
      return { isValid: false, reason: 'Missing access_token or refresh_token' };
    }

    // Check if tokens are not empty strings
    if (session.access_token.trim() === '' || session.refresh_token.trim() === '') {
      return { isValid: false, reason: 'Empty access_token or refresh_token' };
    }

    // Check if session has expired (basic JWT expiration check)
    if (session.expires_at) {
      const expirationTime = new Date(session.expires_at).getTime();
      const currentTime = Date.now();

      // If expired more than 24 hours ago, consider it invalid
      if (currentTime > expirationTime + (24 * 60 * 60 * 1000)) {
        return { isValid: false, reason: 'Session expired more than 24 hours ago' };
      }
    }

    // Check if session was created too long ago (more than 30 days)
    if (session.created_at) {
      const creationTime = new Date(session.created_at).getTime();
      const currentTime = Date.now();
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

      if (currentTime > creationTime + thirtyDaysInMs) {
        return { isValid: false, reason: 'Session is older than 30 days' };
      }
    }

    return { isValid: true };
  } catch (error) {
    console.error('Error validating stored session:', error);
    return { isValid: false, reason: 'Session validation error' };
  }
}

// Main startup function
export async function start(): Promise<void> {
  console.log('Starting main service worker...');

  // Check for version changes to detect reloads
  const currentVersion = browser.runtime.getManifest().version;
  const storedVersion = await browser.storage.local.get(['extension_version']);

  if (storedVersion['extension_version'] !== currentVersion) {
    console.log('Extension version changed, clearing session data:', {
      previous: storedVersion['extension_version'],
      current: currentVersion
    });

    // Clear session data on version change (reload/update)
    await browser.storage.local.remove([
      'device_token',
      'supabaseSession',
      'supabase_url',
      'supabase_anon_key',
      'pairing_in_progress',
      'navigateToSection'
    ]);

    // Store new version
    await browser.storage.local.set({ extension_version: currentVersion });
  }

  // Check for existing session on startup with enhanced validation
  try {
    // Try to restore session using the new auth module first
    const { restoreSessionIfAny } = await import('@/lib/extensionAuth');
    const session = await restoreSessionIfAny();

    if (session) {
      console.log('✅ Session restored using new auth module on startup:', {
        userId: session.user?.id,
        email: session.user?.email
      });
    } else {
      // Fallback to old method for backward compatibility
      const result = await browser.storage.local.get(['supabaseSession']);
      console.log('Service worker startup - checking for session:', {
        hasSession: !!result['supabaseSession'],
        sessionKeys: Object.keys(result),
        timestamp: new Date().toISOString()
      });

      if (result['supabaseSession']) {
        // Validate session data before attempting restoration
        const sessionValidation = await validateStoredSession(result['supabaseSession']);

        if (!sessionValidation.isValid) {
          console.log('⚠️ Stored session is invalid, clearing auth data:', sessionValidation.reason);
          await AuthErrorHandler.clearAuthData();
          await AuthNotificationHandler.showSessionExpiredNotification();
          return;
        }

        console.log('Found valid Supabase session on startup, initializing...');
        await initializeSupabase();

        // Restore the session in the Supabase client with error handling
        if (supabase && (result['supabaseSession'] as any).access_token && (result['supabaseSession'] as any).refresh_token) {
          const sessionResult = await withAuthErrorHandling(
            async () => {
              const { error } = await supabase.auth.setSession({
                access_token: (result['supabaseSession'] as any).access_token,
                refresh_token: (result['supabaseSession'] as any).refresh_token
              });

              if (error) {
                throw error;
              }

              return { success: true };
            },
            'session_restoration_startup',
            { maxRetries: 2, clearSessionOnError: true }
          );

          if (sessionResult.success) {
            console.log('✅ Session restored successfully on startup');
            // Show success notification
            await AuthErrorHandler.showAuthSuccessNotification('startup_session_restoration');
          } else {
            console.log('⚠️ Session restoration failed on startup:', sessionResult.error);
            // Auth data will be automatically cleared by the error handler
          }
        }
      } else {
        console.log('No existing Supabase session found on startup');
      }
    }
  } catch (error) {
    console.error('Error checking storage on startup:', error);
  }

  console.log('Service worker startup complete');
}
