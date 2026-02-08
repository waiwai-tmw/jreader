import {
  User,
  Settings,
  RefreshCw,
  Loader2,
  BookOpen
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import 'webextension-polyfill';
import type { Storage } from 'webextension-polyfill';

import { ThemeToggle } from './components/ThemeToggle';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Skeleton } from './components/ui/skeleton';
import { ThemeProvider } from './contexts/ThemeContext';

import { browser, getBrowserInfo, sendMessage } from '@/lib/browser';
import { SW_EVENT_SUPABASE_GET_CLIENT, SW_EVENT_SUPABASE_GET_USER, SW_EVENT_SUPABASE_GET_CARDS, SW_EVENT_AUTH_SIGN_IN_DISCORD, SW_EVENT_AUTH_SIGN_OUT, SW_EVENT_ANKI_SYNC_CARDS, POPUP_EVENT_AUTH_CHANGED } from '@/lib/constants';

console.log('🎨 JReader Extension popup loaded');
console.log('🔍 Browser info:', getBrowserInfo());
console.log('📊 Popup environment:', {
  hasBrowser: typeof browser !== 'undefined',
  hasRuntime: !!(browser as any)?.runtime,
  hasStorage: !!(browser as any)?.storage,
  extensionId: (browser as any)?.runtime?.id || 'unknown',
  timestamp: new Date().toISOString()
});

interface UserData {
  id: string;
  email: string;
  user_metadata?: {
    avatar_url?: string;
    global_name?: string;
    full_name?: string;
  };
}

interface CardData {
  id: string;
  expression: string;
  created_at: string;
  sync_status?: string;
  synced_at?: string;
  anki_note_id?: string;
}

function Popup() {
  const [session, setSession] = useState<any>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [cards, setCards] = useState<CardData[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    syncedCount?: number;
    duplicateCount?: number;
    errorCount?: number;
    errors?: string[];
    message?: string;
    warning?: string;
    error?: string;
  } | null>(null);
  const [ankiSettings, setAnkiSettings] = useState<{
    anki_connect_url: string;
    anki_deck: string;
    anki_note_type: string;
  } | null>(null);

  useEffect(() => {
    // Initialize popup - use storage-first approach
    void initAuthState();
    void loadAnkiSettings();

    // Listen for auth changes
    const messageListener = (request: any) => {
      if (request.type === POPUP_EVENT_AUTH_CHANGED) {
        console.log('🔐 Received AUTH_CHANGED:', request.event);
        setSession(request.session ?? null);
      }
    };

    browser.runtime.onMessage.addListener(messageListener);

    // Listen for storage changes to update Anki settings and pairing status
    const handleStorageChange = (changes: { [key: string]: Storage.StorageChange }, areaName: string) => {
      if (areaName === 'local') {
        // Handle Anki settings changes
        if (changes['anki_connect_url'] || changes['anki_deck'] || changes['anki_note_type']) {
          void loadAnkiSettings();
        }

        // Handle auth session changes
        if (changes['supabaseSession']) {
          console.log('🔐 Supabase session changed in storage');
          setSession(changes['supabaseSession'].newValue ?? null);
        }

      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);

    return () => {
      browser.runtime.onMessage.removeListener(messageListener);
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // Initialize auth state from storage (storage-first approach)
  const initAuthState = async () => {
    try {
      console.log('🔐 Initializing auth state from storage...');
      const { supabaseSession } = await browser.storage.local.get('supabaseSession');
      setSession(supabaseSession ?? null);
      console.log('🔐 Session initialized:', supabaseSession ? 'authenticated' : 'not authenticated');

      // Debug session structure
      // if (supabaseSession) {
      //   console.log('🔐 Session structure debug:', {
      //     hasAccessToken: !!supabaseSession.access_token,
      //     hasRefreshToken: !!supabaseSession.refresh_token,
      //     hasUser: !!supabaseSession.user,
      //     userId: supabaseSession.user?.id,
      //     email: supabaseSession.user?.email,
      //     expiresAt: supabaseSession.expires_at,
      //     tokenType: supabaseSession.token_type,
      //     sessionKeys: Object.keys(supabaseSession)
      //   });
      // }
    } catch (error) {
      console.error('Error initializing auth state:', error);
      setSession(null);
    }
  };

  // Derive authentication state from session
  const isAuthenticated = !!session?.access_token;

  // Debug authentication state
  console.log('🔐 Authentication state debug:', {
    hasSession: !!session,
    hasAccessToken: !!session?.access_token,
    isAuthenticated,
    sessionType: typeof session,
    timestamp: new Date().toISOString()
  });

  // Load user profile and cards when authenticated
  useEffect(() => {
    if (isAuthenticated && !userData) {
      setTimeout(() => {
        void loadUserProfile();
        void loadUserCards();
      }, 100);
    } else if (!isAuthenticated) {
      setUserData(null);
    }
  }, [isAuthenticated, userData]);

  const loadAnkiSettings = async () => {
    try {
      const result = await browser.storage.local.get([
        'anki_connect_url',
        'anki_deck',
        'anki_note_type'
      ]);

      // Check if all required settings are configured
      if (!result['anki_connect_url'] || !result['anki_deck'] || !result['anki_note_type']) {
        console.log('Anki settings not configured yet');
        setAnkiSettings(null);
        return;
      }

      // Validate types
      if (typeof result['anki_connect_url'] !== 'string') {
        throw new Error('Anki connect URL is not a string: ' + result['anki_connect_url']);
      }

      if (typeof result['anki_deck'] !== 'string') {
        throw new Error('Anki deck is not a string: ' + result['anki_deck']);
      }

      if (typeof result['anki_note_type'] !== 'string') {
        throw new Error('Anki note type is not a string: ' + result['anki_note_type']);
      }

      setAnkiSettings({
        anki_connect_url: result['anki_connect_url'],
        anki_deck: result['anki_deck'],
        anki_note_type: result['anki_note_type']
      });
    } catch (error) {
      console.error('Error loading Anki settings:', error);
      setAnkiSettings(null);
    }
  };

  const loadUserProfile = async () => {
    try {
      console.log('🔐 Loading user profile...');
      const response = await sendMessage<{ hasClient: boolean; isSessionValid: boolean }>({ type: SW_EVENT_SUPABASE_GET_CLIENT });

      console.log(`🔐 ${SW_EVENT_SUPABASE_GET_CLIENT} response:`, response);

      if (response && response.hasClient && response.isSessionValid) {
        try {
          console.log('🔐 Getting user data...');
          const userResponse = await sendMessage<{ user: any }>({ type: SW_EVENT_SUPABASE_GET_USER });

          console.log(`🔐 ${SW_EVENT_SUPABASE_GET_USER} response:`, userResponse);

          if (userResponse && userResponse.user) {
            console.log('🔐 Setting user data:', userResponse.user);
            setUserData(userResponse.user);
          } else {
            console.log('🔐 No user data in response, setting null');
            setUserData(null);
          }
        } catch (error) {
          console.error('Error getting user data:', error);
          setUserData(null);
        }
      } else {
        console.log('🔐 Supabase client not ready or session invalid, setting userData to null');
        setUserData(null);
      }
    } catch (error) {
      console.error('Error connecting to background script:', error);
      setUserData(null);
    }
  };

  const loadUserCards = async () => {
    setCardsLoading(true);
    try {
      console.log('🔐 Loading user cards...');
      const response = await sendMessage<{ hasClient: boolean; isSessionValid: boolean }>({ type: SW_EVENT_SUPABASE_GET_CLIENT });

      console.log(`🔐 ${SW_EVENT_SUPABASE_GET_CLIENT} response for cards:`, response);

      if (response && response.hasClient && response.isSessionValid) {
        try {
          console.log(`🔐 Sending ${SW_EVENT_SUPABASE_GET_CARDS} request...`);
          const cardsResponse = await sendMessage<{ success: boolean; cards?: any[]; error?: string }>({ type: SW_EVENT_SUPABASE_GET_CARDS });

          console.log(`🔐 ${SW_EVENT_SUPABASE_GET_CARDS} response:`, cardsResponse);

          if (cardsResponse && cardsResponse.success) {
            console.log('🔐 Setting cards:', cardsResponse.cards?.length || 0, 'cards');
            setCards(cardsResponse.cards || []);
          } else {
            console.log(`🔐 ${SW_EVENT_SUPABASE_GET_CARDS} failed:`, cardsResponse?.error);
            setCards([]);
          }
        } catch (error) {
          console.error('Error getting cards:', error);
          setCards([]);
        }
      } else {
        console.log('🔐 Supabase client not ready for cards, setting empty array');
        setCards([]);
      }
    } catch (error) {
      console.error('Error connecting to background script:', error);
      setCards([]);
    } finally {
      setCardsLoading(false);
    }
  };

  const startDiscordAuth = async () => {
    console.log('🔐 [POPUP] startDiscordAuth called');

    if (isPairing) {
      console.log('🔐 [POPUP] Already pairing');
      return;
    }

    setIsPairing(true);

    try {
      const browserType = getBrowserInfo();
      console.log('🔐 [POPUP] Browser type:', browserType);

      if (browserType === 'firefox') {
        // Firefox: open settings page for OAuth
        // Settings page has Port keep-alive to prevent SW from dying
        console.log('🔐 [POPUP] Firefox detected, opening settings page for OAuth...');

        // Set a flag to trigger OAuth in settings page
        await browser.storage.local.set({ triggerOAuth: true });

        // Open settings page
        await browser.runtime.openOptionsPage();

        // Close popup
        window.close();
      } else {
        // Chrome: call service worker directly from popup
        // Note: Don't await this response since popup will close during OAuth
        // The popup will reopen and detect auth state from storage
        console.log('🔐 [POPUP] Chrome detected, starting Discord OAuth flow...');
        sendMessage<{ ok: boolean; user?: any; error?: string }>({
          type: SW_EVENT_AUTH_SIGN_IN_DISCORD
        }).then(response => {
          console.log('🔐 [POPUP] Received response from auth.signInDiscord:', response);
          // Response handling is now done via storage changes and AUTH_CHANGED messages
        }).catch(error => {
          console.error('🔐 [POPUP] Error starting Discord authentication:', error);
          // Reset pairing state on error
          setIsPairing(false);
        });

        // Note: We don't wait for the response here because:
        // 1. The popup will close during OAuth flow
        // 2. When it reopens, it will read auth state from storage
        // 3. The service worker will broadcast AUTH_CHANGED messages
      }
    } catch (error) {
      console.error('🔐 [POPUP] Error starting Discord authentication:', error);
      setIsPairing(false);
    }
  };

  const signOut = async () => {
    try {
      console.log('🔐 Starting sign out...');
      const response = await sendMessage<{ ok: boolean; error?: string }>({ type: SW_EVENT_AUTH_SIGN_OUT });

      if (response && response.ok) {
        console.log('🔐 Sign out successful');
      } else {
        console.error('🔐 Sign out failed:', response?.error);
      }

      // Clear UI state regardless of response
      setIsPairing(false);
      setUserData(null);
      setCards([]);
    } catch (error) {
      console.error('🔐 Error signing out:', error);
      // Clear UI state even if sign out fails
      setIsPairing(false);
      setUserData(null);
      setCards([]);
    }
  };

  const openSettings = (section?: string) => {
    void browser.runtime.openOptionsPage();

    // If a section is specified, we'll need to handle navigation after the page loads
    // This is a bit tricky since we can't directly control the options page from the popup
    // The options page will need to check for URL parameters or storage flags
    if (section) {
      // Store the section to navigate to in storage
      void browser.storage.local.set({ navigateToSection: section });
    }
  };

  const syncToAnki = async () => {
    console.log('🔄 Starting sync to Anki...');

    if (isSyncing) {
      console.log('⏳ Sync already in progress, skipping');
      return;
    }

    // Check if Anki settings are configured
    if (!ankiSettings) {
      console.log('❌ Anki settings not configured, opening settings page');
      setSyncResult({
        success: false,
        error: 'Opening settings page to configure Anki settings. Please set your AnkiConnect URL, Deck, and Note Type.'
      });
      // Open the settings page directly to Anki settings section
      openSettings('anki-settings');
      return;
    }

    console.log('⚙️ Anki settings found:', {
      hasConnectUrl: !!ankiSettings.anki_connect_url,
      hasDeck: !!ankiSettings.anki_deck,
      hasNoteType: !!ankiSettings.anki_note_type,
      timestamp: new Date().toISOString()
    });

    setIsSyncing(true);
    setSyncResult(null); // Clear previous results

    console.log('📤 Sending SYNC_CARDS (syncUnsyncedForUser) message to background script');
    try {
      const response = await sendMessage<{ success: boolean; error?: string; syncedCount?: number; results?: any[] }>({ type: SW_EVENT_ANKI_SYNC_CARDS, syncUnsyncedForUser: true });

      console.log('📨 Received SW_EVENT_ANKI_SYNC_CARDS response:', {
        hasResponse: !!response,
        success: response?.success,
        error: response?.error,
        syncedCount: response?.syncedCount,
        resultsCount: response?.results?.length,
        timestamp: new Date().toISOString()
      });

      if (response) {
        // Use conditional spread to only include optional properties when they have values
        // This satisfies exactOptionalPropertyTypes by not setting properties to undefined
        setSyncResult({
          success: response.success,
          syncedCount: response.syncedCount ?? (response.results?.filter(r => r.ankiNoteId).length ?? 0),
          ...(response.success && { message: 'Sync completed successfully' }),
          ...(response.error && { error: response.error })
        });

        // If sync was successful, reload the cards to update the UI
        if (response.success) {
          console.log('✅ Sync successful, reloading cards to update UI');
          await loadUserCards();
        }
      } else {
        console.log('❌ No response from sync operation');
        setSyncResult({
          success: false,
          error: 'No response from sync operation'
        });
      }
    } catch (error) {
      console.error('💥 Error syncing to Anki:', error);
      setSyncResult({
        success: false,
        error: 'Error syncing to Anki: ' + (error as Error).message
      });
    } finally {
      setIsSyncing(false);
    }
  };



  return (
    <div className="w-80 bg-background p-4">
      {/* Header with User Profile and Theme Toggle */}
      <div className="flex items-center justify-between mb-4">
        {(() => {
          if (isAuthenticated && userData) {
            return (
              <div className="flex items-center gap-3">
                <img
                  src={userData.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.email || 'User')}&background=007bff&color=fff&size=40`}
                  alt="User"
                  className="w-8 h-8 rounded-full object-cover"
                />
                <div>
                  <div className="font-semibold text-foreground text-sm">
                    {userData.user_metadata?.global_name || userData.user_metadata?.full_name || userData.email || 'User'}
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-green-500 dark:bg-green-400 rounded-full"></div>
                    <span className="text-green-700 dark:text-green-300 font-medium text-xs">Connected</span>
                  </div>
                </div>
              </div>
            );
          } else if (isPairing) {
            return (
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <div className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                    <span className="text-blue-700 dark:text-blue-300 font-medium text-xs">Signing in...</span>
                  </div>
                </div>
              </div>
            );
          } else {
            return (
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-lg">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-sm font-bold text-foreground">JReader Extension</h1>
                  <p className="text-xs text-muted-foreground">Not signed in</p>
                </div>
              </div>
            );
          }
        })()}
        <ThemeToggle />
      </div>

      {/* Cards Section */}
      {userData && (
        <Card className="mb-4 border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Your Cards</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={loadUserCards}
                disabled={cardsLoading}
                className="h-7 px-2 text-xs"
              >
                <RefreshCw className={`h-3 w-3 ${cardsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {cardsLoading ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading cards...
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  You have {cards.length} card{cards.length !== 1 ? 's' : ''}
                </div>
                {cards.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-green-700 dark:text-green-300">
                        {cards.filter(card => card.sync_status === 'pushed').length} synced
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span className="text-orange-700 dark:text-orange-300">
                        {cards.filter(card => !card.sync_status || card.sync_status !== 'pushed').length} unsynced
                      </span>
                    </div>
                  </div>
                )}
                {cards.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-primary hover:underline mb-2">
                      Show expressions
                    </summary>
                    <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-muted/50 rounded border">
                      {cards.map((card, index) => (
                        <div key={card.id || index} className="flex items-center justify-between text-xs text-foreground border-b border-border pb-1 last:border-b-0 last:pb-0">
                          <span>{card.expression || 'No expression'}</span>
                          <div className="flex items-center gap-1">
                            {card.sync_status === 'pushed' ? (
                              <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                <span className="text-green-700 dark:text-green-300 text-xs">Synced</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                                <span className="text-orange-700 dark:text-orange-300 text-xs">Unsynced</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {cards.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <Button
                      onClick={syncToAnki}
                      disabled={isSyncing}
                      className="w-full"
                      size="sm"
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : !ankiSettings ? (
                        <>
                          <Settings className="h-4 w-4 mr-2" />
                          Configure Anki Settings
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Sync {cards.filter(card => !card.sync_status || card.sync_status !== 'pushed').length} Unsynced Cards
                        </>
                      )}
                    </Button>

                    {/* Sync Results */}
                    {syncResult && (
                      <div className="mt-3 p-3 rounded-lg border text-sm">
                        {syncResult.success ? (
                          <div className="text-green-600 dark:text-green-400">
                            <div className="font-medium">✅ Sync Complete</div>
                            {syncResult.message && (
                              <div className="mt-1">{syncResult.message}</div>
                            )}
                            {syncResult.warning && (
                              <div className="mt-1 text-yellow-600 dark:text-yellow-400">
                                ⚠️ {syncResult.warning}
                              </div>
                            )}
                            {syncResult.errors && syncResult.errors.length > 0 && (
                              <div className="mt-2">
                                <div className="font-medium text-red-600 dark:text-red-400">Errors:</div>
                                <ul className="mt-1 text-xs text-red-600 dark:text-red-400">
                                  {syncResult.errors.map((error, index) => (
                                    <li key={index}>• {error}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-red-600 dark:text-red-400">
                            <div className="font-medium">❌ Sync Failed</div>
                            <div className="mt-1">{syncResult.error}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}


      {/* Action Buttons */}
      <div className="space-y-2 mb-4">
        {!isAuthenticated ? (
          <Button
            onClick={startDiscordAuth}
            disabled={isPairing}
            className="w-full"
          >
            {isPairing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <User className="h-4 w-4 mr-2" />
                Sign in with Discord
              </>
            )}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={signOut}
              size="sm"
              className="flex-1"
            >
              Sign Out
            </Button>
            <Button
              variant="outline"
              onClick={() => openSettings()}
              size="sm"
              className="px-3"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Initialize the popup
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <ThemeProvider>
      <Popup />
    </ThemeProvider>
  );
}
