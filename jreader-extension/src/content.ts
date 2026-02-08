// Content script - bridge between web app and extension
import 'webextension-polyfill';
import type { ServiceWorkerEventAuthIsAuthenticatedResponse} from '@jreader/shared-types-ts/extensionAvailability';
import { SW_EVENT_AUTH_IS_AUTHENTICATED, CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK, CONTENT_SCRIPT_EVENT_EXTENSION_STATUS_CHANGED, ContentScriptEventExtensionAvailabilityCheckResponse, ExtensionAuthStatusKind } from '@jreader/shared-types-ts/extensionAvailability';
import { match, P } from "ts-pattern";

import { browser, getBrowserInfo } from '@/lib/browser';
import { SW_EVENT_ANKI_CHECK_HEALTH, SW_EVENT_ANKI_SYNC_CARDS, SW_EVENT_ANKI_OPEN_NOTE, SW_EVENT_ANKI_UPDATE_NOTE_FIELDS, CONTENT_SCRIPT_EVENT_UPDATE_EXTENSION_STATUS,  CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH, CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH_RESPONSE, CONTENT_SCRIPT_EVENT_ANKI_SYNC_CARDS, CONTENT_SCRIPT_EVENT_ANKI_SYNC_CARDS_RESPONSE, CONTENT_SCRIPT_EVENT_ANKI_OPEN_NOTE, CONTENT_SCRIPT_EVENT_ANKI_OPEN_NOTE_RESPONSE, CONTENT_SCRIPT_EVENT_ANKI_UPDATE_NOTE_FIELDS, CONTENT_SCRIPT_EVENT_ANKI_UPDATE_NOTE_FIELDS_RESPONSE,  } from '@/lib/constants';

console.log('🌐 JReader Extension content script loaded');
console.log('🔍 Browser info:', getBrowserInfo());
console.log('📊 Content script environment:', {
  hasBrowser: typeof browser !== 'undefined',
  hasRuntime: !!(browser as any)?.runtime,
  extensionId: (browser as any)?.runtime?.id || 'unknown',
  pageUrl: window.location.href,
  pageOrigin: window.location.origin,
  timestamp: new Date().toISOString()
});

// Check runtime availability on load
const checkRuntimeAvailability = () => {
  const isAvailable = !!browser.runtime;

  console.log('JReader Extension runtime check:', {
    browserAvailable: isAvailable,
    browserType: getBrowserInfo(),
    extensionId: browser.runtime?.id || 'N/A',
    pageUrl: window.location.href
  });

  if (!isAvailable) {
    console.warn('⚠️ Browser extension runtime not available! Extension may not work properly.');
    console.warn('Troubleshooting: 1) Refresh page, 2) Check extension is enabled, 3) Open extension popup');
  }
};

// Check immediately and after a short delay
checkRuntimeAvailability();
setTimeout(checkRuntimeAvailability, 1000);

// Periodic check for extension context invalidation
let contextCheckInterval: number | null = null;

const startContextMonitoring = () => {
  if (contextCheckInterval) return; // Already monitoring

  contextCheckInterval = window.setInterval(() => {
    try {
      // Try to access runtime to detect invalidation
      const hasRuntime = !!browser.runtime;
      const hasRuntimeId = !!browser.runtime?.id;
      console.log('🔍 [ContextMonitor] Periodic check:', { hasRuntime, hasRuntimeId });

      if (!browser.runtime || !browser.runtime.id) {
        console.log('🔄 [ContextMonitor] Extension context invalidated detected - stopping monitoring');
        if (contextCheckInterval) {
          clearInterval(contextCheckInterval);
          contextCheckInterval = null;
        }

        // Clear any stored extension status so the web app re-checks
        clearExtensionStatus();
      }
    } catch (error) {
      // Context is invalidated
      console.log('🔄 [ContextMonitor] Extension context invalidated detected via error - stopping monitoring', error);
      if (contextCheckInterval) {
        clearInterval(contextCheckInterval);
        contextCheckInterval = null;
      }

      // Clear extension status so the web app re-checks
      clearExtensionStatus();
    }
  }, 5000); // Check every 5 seconds
};

// Start monitoring after a short delay
setTimeout(startContextMonitoring, 2000);

// Secure origin validation with exact domain matching
// Note: External domains are intentionally excluded for security reasons
// - Third-party services (Stripe, etc.) may send messages but we don't process them
// - Only messages from trusted JReader domains are allowed
const isAllowedOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();

    // Define allowed origins with exact matching
    const allowedOrigins = new Set([
      // Production domains (exact matches only)
      'jreader.moe',
      'www.jreader.moe',

      // Development domains (exact matches only)
      'localhost',
      '127.0.0.1',
      'waiwais-macbook-pro-2.unicorn-lime.ts.net',
      'unicorn-lime.ts.net',
    ]);

    // Check for exact matches first
    if (allowedOrigins.has(hostname)) {
      return true;
    }

    // For development: allow localhost with any port
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }

    // Allow specific subdomain patterns for preview deployments
    // Only allow if it's a subdomain of a known good domain
    const allowedSubdomainPatterns = [
      /^[a-z0-9-]+\.jreader\.moe$/,  // Allow subdomains of jreader.moe
      /^[a-z0-9-]+\.vercel\.app$/,    // Allow Vercel preview deployments
      /^[a-z0-9-]+\.netlify\.app$/,   // Allow Netlify preview deployments
      /^[a-z0-9-]+\.unicorn-lime\.ts\.net$/,  // Allow subdomains of your dev domain
    ];

    for (const pattern of allowedSubdomainPatterns) {
      if (pattern.test(hostname)) {
        return true;
      }
    }

    return false;
  } catch(error) {
    console.error(`Invalid origin format, origin=${origin}, error=${JSON.stringify(error)}`);
    return false;
  }
};

// Helper function to handle extension context invalidation and other runtime errors
function handleRuntimeError(error: any, responseType: string, defaultError: string = 'Failed to send message to background script') {
  // Handle extension context invalidation
  if (error.message && error.message.includes('Extension context invalidated')) {
    console.log('🔄 Extension context invalidated - extension was reloaded. This is normal during development.');
    return {
      type: responseType,
      success: false,
      available: false,
      configured: false,
      error: 'Extension was reloaded. Please refresh the page and try again.'
    };
  } else {
    console.error(`❌ Error in ${responseType}:`, error);
    return {
      type: responseType,
      success: false,
      available: false,
      configured: false,
      error: error.message || defaultError
    };
  }
}

// Helpers to update/clear extension status via localStorage (source of truth)
function setExtensionStatus(isAuthenticated: boolean) {
  try {
    const previous = localStorage.getItem('extensionStatus');
    const extensionStatus = { isAuthenticated };
    localStorage.setItem('extensionStatus', JSON.stringify(extensionStatus));
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'extensionStatus',
      newValue: JSON.stringify(extensionStatus),
      oldValue: previous,
      storageArea: localStorage
    }));
    console.log('💾 [ExtensionStatus] setExtensionStatus:', extensionStatus);
  } catch (error) {
    console.error('[ExtensionStatus] Failed to set extension status in localStorage:', error);
  }
}

function clearExtensionStatus() {
  try {
    const previous = localStorage.getItem('extensionStatus');
    localStorage.removeItem('extensionStatus');
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'extensionStatus',
      newValue: null,
      oldValue: previous,
      storageArea: localStorage
    }));
    console.log('🧹 [ExtensionStatus] Cleared extension status from localStorage');
  } catch (error) {
    console.error('[ExtensionStatus] Failed to clear extension status:', error);
  }
}

// Extension is active - no need for intrusive notification
// The web app will show a subtle indicator in the header when needed

// Listen for messages from the background script
browser.runtime.onMessage.addListener((message: any, sendResponse: any) => {
  if (message.type === CONTENT_SCRIPT_EVENT_UPDATE_EXTENSION_STATUS) {
    console.log('📤 [ExtensionStatus] Received UPDATE_EXTENSION_STATUS:', message);

    // Notify the web app that extension status changed (web app will re-check)
    try {
      window.postMessage({
        type: CONTENT_SCRIPT_EVENT_EXTENSION_STATUS_CHANGED
      }, window.location.origin);

      console.log('📤 [ExtensionStatus] Sent statusChanged notification to web app');
    } catch (error) {
      console.error('[ExtensionStatus] Failed to send statusChanged notification:', error);
    }

    sendResponse({ success: true });
  }

  return true; // Keep the message channel open for async response
});

// Listen for messages from the web app
window.addEventListener("message", (event) => {
  console.log(`[ContentScipt] Got message: ${JSON.stringify(event)}`);

  if (!isAllowedOrigin(event.origin)) {
    // All messages that reach here are from unauthorized origins
    // Log at debug level since rejections from external domains are expected
    console.debug('🔒 Security rejection for external domain:', event.origin);
    return;
  }

  const msg = event.data;

  // Handle extension availability check
  if (msg?.type === CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK) {
    console.log(`[ExtensionAvailability] started`);

    // Check if runtime is available first
    if (!browser.runtime) {
      // Runtime not available - send unavailable response immediately
      const message = ContentScriptEventExtensionAvailabilityCheckResponse.makeUnavailable('browser runtime is not available');
      window.postMessage(message, window.location.origin);
      return;
    }

    // Runtime is available - check auth status asynchronously
    void (async () => {
      let message: ContentScriptEventExtensionAvailabilityCheckResponse;
      try {
        const authResponse: ServiceWorkerEventAuthIsAuthenticatedResponse = await browser.runtime.sendMessage({ type: SW_EVENT_AUTH_IS_AUTHENTICATED });

        console.log(`[ExtensionAvailability] authResponse=${JSON.stringify(authResponse)}`);

        message = match(authResponse)
            .with({ type: SW_EVENT_AUTH_IS_AUTHENTICATED }, ({ extensionAuthStatus }) =>
              match(extensionAuthStatus)
                .with({ kind: ExtensionAuthStatusKind.UNAVAILABLE, error: P.string }, ({ error }) =>
                  (ContentScriptEventExtensionAvailabilityCheckResponse.makeUnavailable(`got error ${JSON.stringify(error)}`)))
                .with({ kind: ExtensionAuthStatusKind.UNAUTHENTICATED }, () =>
                  (ContentScriptEventExtensionAvailabilityCheckResponse.makeAvailableUnauth()))
                .with({ kind: ExtensionAuthStatusKind.AUTHENTICATED }, () =>
                  (ContentScriptEventExtensionAvailabilityCheckResponse.makeAvailableAuth()))
                .exhaustive()
            )
            .exhaustive();
      } catch (error) {
        console.error('[ExtensionAvailability] Error checking auth status:', error);
        message = ContentScriptEventExtensionAvailabilityCheckResponse.makeAvailableUnauth(error as string);
      }

      // Send response after async work completes
      window.postMessage(message, window.location.origin);
    })();
  }

  // Handle AnkiConnect health check request
  if (msg?.type === CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH) {
    console.log('🔍 Processing AnkiConnect health check request');

    // Check if browser runtime is available
    if (!browser.runtime) {
      const errorResponse = {
        type: CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH_RESPONSE,
        available: false,
        configured: false,
        error: 'Browser runtime not available. Please refresh the page or check if the extension is enabled.'
      };
      console.log('📤 Sending error response:', errorResponse);
      window.postMessage(errorResponse, window.location.origin);
      return;
    }

    // Forward to background script
    console.log('📤 Sending CHECK_ANKI_HEALTH message to background script');
    console.log('🔍 Browser runtime available:', !!browser.runtime);
    console.log('🔍 Browser runtime sendMessage available:', !!browser.runtime?.sendMessage);

    browser.runtime.sendMessage({
      type: SW_EVENT_ANKI_CHECK_HEALTH
    }).then((response: any) => {
      console.log('📤 Sending AnkiConnect health response:', response);
      window.postMessage({
        type: CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH_RESPONSE,
        ...response
      }, window.location.origin);
    }).catch((error: any) => {
      const errorResponse = handleRuntimeError(error, CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH_RESPONSE);
      console.log('📤 Sending error response to web app:', errorResponse);
      window.postMessage(errorResponse, window.location.origin);

      // If extension context is invalidated, also update status
      if (error.message && error.message.includes('Extension context invalidated')) {
        setExtensionStatus(false);
      }
    });
  }

  // Handle batch card sync request (content-script facing event)
  if (msg?.type === CONTENT_SCRIPT_EVENT_ANKI_SYNC_CARDS) {
    console.log('🔄 Processing batch sync cards request:', {
      hasCardIds: Array.isArray(msg.cardIds),
      cardIdsCount: Array.isArray(msg.cardIds) ? msg.cardIds.length : 0,
      hasCardsArray: Array.isArray(msg.cards),
      cardsCount: Array.isArray(msg.cards) ? msg.cards.length : 0,
      syncUnsyncedForUser: !!msg.syncUnsyncedForUser,
      timestamp: new Date().toISOString()
    });

    if (!browser.runtime) {
      const errorResponse = {
        type: CONTENT_SCRIPT_EVENT_ANKI_SYNC_CARDS_RESPONSE,
        success: false,
        error: 'Browser runtime not available. Please refresh the page or check if the extension is enabled.',
        results: []
      };
      window.postMessage(errorResponse, window.location.origin);
      return;
    }

    const payload: any = { type: SW_EVENT_ANKI_SYNC_CARDS };
    if (Array.isArray(msg.cardIds)) payload.cardIds = msg.cardIds;
    if (Array.isArray(msg.cards)) payload.cards = msg.cards;
    if (msg.syncUnsyncedForUser === true) payload.syncUnsyncedForUser = true;

    browser.runtime.sendMessage(payload).then((response: any) => {
      const webAppResponse = {
        type: CONTENT_SCRIPT_EVENT_ANKI_SYNC_CARDS_RESPONSE,
        success: response?.success || false,
        error: response?.error || null,
        results: response?.results || []
      };
      window.postMessage(webAppResponse, window.location.origin);
    }).catch((error: any) => {
      const err = handleRuntimeError(error, CONTENT_SCRIPT_EVENT_ANKI_SYNC_CARDS_RESPONSE);
      const errorResponse = { ...err, type: CONTENT_SCRIPT_EVENT_ANKI_SYNC_CARDS_RESPONSE, results: [] };
      window.postMessage(errorResponse, window.location.origin);
      if (error.message && error.message.includes('Extension context invalidated')) {
        setExtensionStatus(false);
      }
    });
  }

  // Handle updateNoteFields request
  if (msg?.type === CONTENT_SCRIPT_EVENT_ANKI_UPDATE_NOTE_FIELDS) {
    console.log('📥 Received updateNoteFields request:', {
      cardIds: msg.cardIds?.length || 0,
      msg
    });

    // Check if browser runtime is available
    if (!browser.runtime) {
      window.postMessage({
        type: CONTENT_SCRIPT_EVENT_ANKI_UPDATE_NOTE_FIELDS_RESPONSE,
        success: false,
        error: 'Extension runtime not available'
      }, window.location.origin);
      return;
    }

    browser.runtime.sendMessage({
      type: SW_EVENT_ANKI_UPDATE_NOTE_FIELDS,
      cardIds: msg.cardIds
    }).then((response: any) => {
      console.log('📤 Sending update response to frontend:', response);

      // Send response back to web app
      window.postMessage({
        type: CONTENT_SCRIPT_EVENT_ANKI_UPDATE_NOTE_FIELDS_RESPONSE,
        success: response?.success || false,
        error: response?.error || null,
        results: response?.results || [],
        skippedCards: response?.skippedCards || []
      }, window.location.origin);
    }).catch((error: any) => {
      const errorResponse = handleRuntimeError(error, CONTENT_SCRIPT_EVENT_ANKI_UPDATE_NOTE_FIELDS_RESPONSE);
      (errorResponse as any).success = false;
      (errorResponse as any).type = CONTENT_SCRIPT_EVENT_ANKI_UPDATE_NOTE_FIELDS_RESPONSE;
      window.postMessage(errorResponse, window.location.origin);

      // If extension context is invalidated, also update status
      if (error.message && error.message.includes('Extension context invalidated')) {
        setExtensionStatus(false);
      }
    });
  }

  // Handle openInAnki request (content-script facing event)
  if (msg?.type === CONTENT_SCRIPT_EVENT_ANKI_OPEN_NOTE) {
    console.log('Received openInAnki request:', msg);

    // Check if browser runtime is available
    if (!browser.runtime) {
      window.postMessage({
        type: CONTENT_SCRIPT_EVENT_ANKI_OPEN_NOTE_RESPONSE,
        success: false,
        error: 'Extension runtime not available'
      }, window.location.origin);
      return;
    }

    browser.runtime.sendMessage({
      type: SW_EVENT_ANKI_OPEN_NOTE,
      noteId: msg.noteId
    }).then((response: any) => {
      // Send response back to web app
      window.postMessage({
        type: CONTENT_SCRIPT_EVENT_ANKI_OPEN_NOTE_RESPONSE,
        success: response?.success || false,
        error: response?.error || null
      }, window.location.origin);
    }).catch((error: any) => {
      const errorResponse = handleRuntimeError(error, CONTENT_SCRIPT_EVENT_ANKI_OPEN_NOTE_RESPONSE);
      (errorResponse as any).success = false; // Add openInAnki-specific field
      (errorResponse as any).type = CONTENT_SCRIPT_EVENT_ANKI_OPEN_NOTE_RESPONSE;
      window.postMessage(errorResponse, window.location.origin);

      // If extension context is invalidated, also update status
      if (error.message && error.message.includes('Extension context invalidated')) {
        setExtensionStatus(false);
      }
    });
  }
});
