import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

import { browser, getBrowserInfo as getBrowserType } from './browser';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from './config';
import { CONTENT_SCRIPT_EVENT_UPDATE_EXTENSION_STATUS, POPUP_EVENT_AUTH_CHANGED } from './constants';

// Safe short hash for debug logs to verify tokens are different
async function hashToken(token: string): Promise<string> {
  if (!token) return 'none';
  const data = new TextEncoder().encode(token);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .slice(0, 6)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Update extension status in localStorage for frontend to detect
async function updateExtensionStatusInLocalStorage(isAuthenticated: boolean): Promise<void> {
  try {
    // Get all tabs that might have the frontend open
    const allowedDomains = [
      'https://jreader.moe',
      'https://waiwais-macbook-pro-2.unicorn-lime.ts.net',
    ];

    const msg = {
      type: CONTENT_SCRIPT_EVENT_UPDATE_EXTENSION_STATUS,
      isAuthenticated: isAuthenticated
    };

    for (const domain of allowedDomains) {
      try {
        const tabs = await browser.tabs.query({ url: `${domain}/*` });
        for (const tab of tabs) {
          if (tab.id) {
            // Send message to content script to update localStorage
            await browser.tabs.sendMessage(tab.id, msg).catch((err) => {
              console.log(`Could not send message to tab ${tab.id ?? 'unknown'} for domain ${domain}`, err);
            });
          }
        }
      } catch (error) {
        // Ignore errors for individual domains
        console.log(`Could not query tabs for domain ${domain}:`, error);
      }
    }

    console.log('📤 Updated extension status in localStorage:', msg, { isAuthenticated });
  } catch (error) {
    console.error('Error updating extension status in localStorage:', error);
  }
}

/**
 * Storage adapter so Supabase can persist PKCE verifier + state across MV3 SW sleeps.
 * Using chrome.storage.session keeps it ephemeral per-browser-session and fast.
 */
const storage = {
  async getItem(key: string) {
    const obj = await browser.storage.session.get(key);
    // supabase-js expects string or null
    return (obj && typeof obj[key] === 'string') ? obj[key] : null;
  },
  async setItem(key: string, value: string) {
    await browser.storage.session.set({ [key]: value });
  },
  async removeItem(key: string) {
    await browser.storage.session.remove(key);
  },
};

let supa: SupabaseClient | null = null;

/**
 * One singleton client for the whole SW lifetime with persistent storage for PKCE/state
 */
export function getClient(): SupabaseClient {
  if (!supa) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase configuration missing - check your .env.local file');
    }

    supa = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,          // we persist manually to chrome.storage.local
        detectSessionInUrl: false,
        flowType: 'pkce',               // be explicit
        storage,                        // <-- critical for PKCE/state across sleeps
        storageKey: 'jreader_sw_auth',  // keeps it namespaced
      },
    });

    // Keep long-lived session persisted (so we can rehydrate after restarts)
    supa.auth.onAuthStateChange(async (_evt, session) => {
      if (session) {
        await browser.storage.local.set({ supabaseSession: session });
      }
      if (_evt === 'SIGNED_OUT') {
        await browser.storage.local.remove('supabaseSession');
      }

      // Broadcast auth state changes to any open UI
      try {
        await browser.runtime.sendMessage({
          type: POPUP_EVENT_AUTH_CHANGED,
          session: session || null,
          event: _evt
        });
      } catch (err) {
        // Ignore if no listeners (popup closed)
        console.log('No listeners for AUTH_CHANGED message', err);
      }
    });
  }
  return supa!;
}

function getExtRedirect(): string {
  const browserType = getBrowserType();

  if (browserType === 'firefox') {
    // Firefox: Use browser.identity.getRedirectURL() without path
    // Returns: https://<ext-id>.extensions.allizom.org/
    // IMPORTANT: For Firefox, this must be an HTTPS URL, not moz-extension://
    // The identity API only captures the final redirect if it matches this exact URL
    const redirectUrl = browser.identity.getRedirectURL();
    console.log('🔐 [Firefox] Identity redirect URL:', redirectUrl);
    return redirectUrl;
  } else {
    // Chrome: Use chrome.identity.getRedirectURL with 'auth-callback' path
    // Returns: chrome-extension://<id>/auth-callback or https://<id>.chromiumapp.org/auth-callback
    // This must match the URL configured in Supabase
    // @ts-ignore - chrome.identity is available in Chrome extensions
    const redirectUrl = chrome.identity.getRedirectURL('auth-callback');
    console.log('🔐 [Chrome] Identity redirect URL:', redirectUrl);
    return redirectUrl;
  }
}


/**
 * Start Discord OAuth via Supabase, open with identity API, then exchange the code.
 * MUST be called from service worker context, not from UI pages.
 */
export async function signInWithDiscord(): Promise<Session> {
  console.log('🔐 [SW] signInWithDiscord called');

  const client = getClient();
  const redirectTo = getExtRedirect();

  console.log('🔐 [SW] Starting Discord OAuth flow:', { redirectUrl: redirectTo });

  // CRITICAL: skipBrowserRedirect prevents Supabase from navigating the current page
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo,
      skipBrowserRedirect: true, // CRITICAL: prevents page navigation
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('No auth URL from Supabase');

  console.log('🔐 [SW] Supabase generated OAuth URL:', data.url);

  // Use identity API - works in both Chrome and Firefox when called from SW
  console.log('🔐 [SW] Launching browser.identity.launchWebAuthFlow...');
  console.log('🔐 [SW] Expected redirect URL to match:', redirectTo);

  let finalUrl: string;
  try {
    finalUrl = await browser.identity.launchWebAuthFlow({
      url: data.url,
      interactive: true,
    });
    console.log('🔐 [SW] OAuth flow completed, final URL:', finalUrl);
  } catch (error) {
    console.error('🔐 [SW] launchWebAuthFlow failed:', error);
    console.log('🔐 [SW] This usually means the OAuth provider redirected to a URL that Chrome did not recognize');
    console.log('🔐 [SW] Expected redirect pattern:', redirectTo);
    console.log('🔐 [SW] Make sure this URL pattern is added to your Supabase Discord OAuth settings');
    throw error;
  }

  // Parse the redirect URL
  const u = new URL(finalUrl!);
  const errParam = u.searchParams.get('error') || u.searchParams.get('error_description');
  if (errParam) throw new Error(`OAuth error: ${errParam}`);

  const code = u.searchParams.get('code');
  if (!code) throw new Error('Missing authorization code');

  console.log('🔐 [SW] Exchanging code for session...');
  // Exchange code for session - the old method name still works
  const { data: exchanged, error: exErr } = await client.auth.exchangeCodeForSession(code);
  if (exErr) throw exErr;

  console.log('🔐 Session exchange successful:', {
    userId: exchanged.session?.user?.id,
    email: exchanged.session?.user?.email
  });

  // Debug: Log token hashes to verify they're different from web app
  if (exchanged.session?.refresh_token) {
    const extHash = await hashToken(exchanged.session.refresh_token);
    console.log('🔐 EXT refresh token hash:', extHash);
  }

  await browser.storage.local.set({ supabaseSession: exchanged.session });

  // Update extension status in localStorage for frontend to detect
  await updateExtensionStatusInLocalStorage(true);

  // Set instant badge feedback for successful sign-in
  try {
    await browser.action.setBadgeText({ text: "✓" });
    await browser.action.setBadgeBackgroundColor({ color: "#10b981" }); // Tailwind's green-500
    await browser.action.setTitle({ title: `JReader: Signed in as ${exchanged.session?.user?.email ?? "Account"}` });

    // Auto-clear badge after 8 seconds
    setTimeout(() => {
      browser.action.setBadgeText({ text: "" }).catch(() => {
        // Ignore errors if extension context is invalid
      });
    }, 8000);

    console.log('🔐 Badge feedback set for successful sign-in');
  } catch (error) {
    console.log('Could not set badge feedback:', error);
  }

  // Try to auto-open popup as best-effort (may not work post-OAuth)
  try {
    await browser.action.openPopup();
    console.log('🔐 Auto-opened popup after successful sign-in');
  } catch (error) {
    // This is expected to fail often after OAuth, so just log and continue
    console.log('🔐 Could not auto-open popup (this is normal after OAuth):', error);
  }

  // Broadcast auth change to any open popup/options pages
  try {
    await browser.runtime.sendMessage({
      type: POPUP_EVENT_AUTH_CHANGED,
      session: exchanged.session,
      event: 'SIGNED_IN'
    });
  } catch (err) {
    // Ignore if no listeners (popup closed)
    console.log('No listeners for AUTH_CHANGED message', err);
  }

  return exchanged.session!;
}

export async function restoreSessionIfAny(): Promise<Session | null> {
  try {
    const client = getClient();
    const result = await browser.storage.local.get('supabaseSession');
    const supabaseSession = result['supabaseSession'] as Session | undefined;
    if (supabaseSession?.access_token && supabaseSession?.refresh_token) {
      await client.auth.setSession({
        access_token: supabaseSession.access_token,
        refresh_token: supabaseSession.refresh_token,
      });

      console.log('🔐 Session restored:', {
        userId: supabaseSession.user?.id,
        email: supabaseSession.user?.email
      });

      return supabaseSession;
    }
    return null;
  } catch (error) {
    console.error('Error restoring session:', error);
    return null;
  }
}

export async function signOut(): Promise<void> {
  try {
    const client = getClient();
    // Use local scope to avoid affecting web app session
    await client.auth.signOut({ scope: 'local' });
    await browser.storage.local.remove('supabaseSession');
    // Clean PKCE/state too
    await browser.storage.session.remove('jreader_sw_auth');

    // Clear badge immediately on sign-out
    try {
      await browser.action.setBadgeText({ text: "" });
      await browser.action.setTitle({ title: "JReader" });
      console.log('🔐 Badge cleared on sign-out');
    } catch (error) {
      console.log('Could not clear badge on sign-out:', error);
    }

    // Update extension status in localStorage for frontend to detect
    await updateExtensionStatusInLocalStorage(false);

    // Broadcast sign out to any open UI
    try {
      await browser.runtime.sendMessage({
        type: POPUP_EVENT_AUTH_CHANGED,
        session: null,
        event: 'SIGNED_OUT'
      });
    } catch (err) {
      // Ignore if no listeners (popup closed)
      console.log('No listeners for AUTH_CHANGED message', err);
    }

    console.log('🔐 Signed out and cleared session data');
  } catch (error) {
    console.error('Error signing out:', error);
    // Even if signout fails, clear storage
    await browser.storage.local.remove('supabaseSession');
    await browser.storage.session.remove('jreader_sw_auth');

    // Clear badge even if signout failed
    try {
      await browser.action.setBadgeText({ text: "" });
      await browser.action.setTitle({ title: "JReader" });
      console.log('🔐 Badge cleared on sign-out (fallback)');
    } catch (badgeError) {
      console.log('Could not clear badge on sign-out (fallback):', badgeError);
    }

    // Still update extension status
    await updateExtensionStatusInLocalStorage(false);
  }
}

export async function getCurrentSession(): Promise<Session | null> {
  try {
    const client = getClient();
    const { data } = await client.auth.getSession();
    return data.session ?? null;
  } catch (error) {
    console.error('Error getting current session:', error);
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  return !!(await getCurrentSession());
}
