import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { browser } from '@/lib/browser';
import { POPUP_EVENT_AUTH_CHANGED } from '@/lib/constants';
import { signOut, getCurrentSession } from '@/lib/extensionAuth';

let capturedOnAuthChange: ((_event: string, session: any) => void) | null = null;

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      auth: {
        onAuthStateChange: (cb: (event: string, session: any) => void) => {
          capturedOnAuthChange = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } } as any;
        },
        getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
        signOut: vi.fn(async () => ({})),
        setSession: vi.fn(async () => ({ data: {}, error: null })),
      },
    })),
  };
});
// Ensure Supabase config is considered present during tests
vi.mock('@/lib/config', () => ({
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'test_anon_key',
  isSupabaseConfigured: () => true,
  getSupabaseConfig: () => ({ url: 'http://localhost:54321', anonKey: 'test_anon_key' }),
}));

// Mock browser APIs used by extensionAuth (define inside factory to avoid hoist issues)
vi.mock('@/lib/browser', () => {
  const mockBrowser = {
    storage: {
      local: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined),
      },
      session: {
        remove: vi.fn(async () => undefined),
      },
    },
    runtime: {
      sendMessage: vi.fn(async () => undefined),
    },
    action: {
      setBadgeText: vi.fn(async () => undefined),
      setTitle: vi.fn(async () => undefined),
      openPopup: vi.fn(async () => undefined),
    },
    tabs: {
      query: vi.fn(async () => []),
      sendMessage: vi.fn(async () => undefined),
    },
  } as any;
  return { browser: mockBrowser };
});

describe('extensionAuth auth-changed event emission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnAuthChange = null;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits POPUP_EVENT_AUTH_CHANGED on SIGNED_IN via onAuthStateChange', async () => {
    // Initialize client to register onAuthStateChange
    await getCurrentSession();

    // Simulate Supabase auth state change
    expect(capturedOnAuthChange).toBeTypeOf('function');
    const session = { access_token: 'a', refresh_token: 'b', user: { id: 'u1', email: 'e' } };
    // Await the async handler so awaited sendMessage settles before assertion
    if (capturedOnAuthChange) {
      await (capturedOnAuthChange('SIGNED_IN', session) as unknown as Promise<void>);
    }

    // Assert message emission
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: POPUP_EVENT_AUTH_CHANGED,
      session,
      event: 'SIGNED_IN',
    });
  });

  it('emits POPUP_EVENT_AUTH_CHANGED on signOut', async () => {
    await signOut();
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: POPUP_EVENT_AUTH_CHANGED,
      session: null,
      event: 'SIGNED_OUT',
    });
  });
});
