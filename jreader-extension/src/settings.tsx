import { snakeCase } from 'case-anything';
import { Settings, User, Server, Bug, Trash2, RotateCcw, BookOpen, Check, Loader2, XCircle } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import type { Storage } from 'webextension-polyfill';

import { ThemeToggle } from './components/ThemeToggle';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Checkbox } from './components/ui/checkbox';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Skeleton } from './components/ui/skeleton';
import { ThemeProvider } from './contexts/ThemeContext';

import { browser } from '@/lib/browser';
import { SW_EVENT_SUPABASE_GET_CLIENT, SW_EVENT_SUPABASE_GET_USER, SW_EVENT_SUPABASE_GET_CARDS, SW_EVENT_AUTH_SIGN_OUT, SW_EVENT_AUTH_SIGN_IN_DISCORD } from '@/lib/constants';



interface SettingsData {
  api_base_url: string;
  api_timeout: number;
  auto_load_cards: boolean;
  show_debug_info: boolean;
  enable_notifications: boolean;
  log_level: string;
  anki_connect_url: string;
  anki_deck: string;
  anki_note_type: string;
}

interface UserInfo {
  id: string;
  email: string;
  cardsCount: number;
  user_metadata?: {
    avatar_url?: string;
    global_name?: string;
    full_name?: string;
  };
}

const defaultSettings: SettingsData = {
  api_base_url: 'https://waiwais-macbook-pro-2.unicorn-lime.ts.net',
  api_timeout: 30,
  auto_load_cards: true,
  show_debug_info: false,
  enable_notifications: true,
  log_level: 'info',
  anki_connect_url: 'http://127.0.0.1:8765',
  anki_deck: '',
  anki_note_type: ''
};

function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [ankiDecks, setAnkiDecks] = useState<string[]>([]);
  const [ankiNoteTypes, setAnkiNoteTypes] = useState<string[]>([]);
  const [isLoadingAnki, setIsLoadingAnki] = useState(false);
  const [isTestingAnki, setIsTestingAnki] = useState(false);
  const [ankiTestResult, setAnkiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [noteTypeFields, setNoteTypeFields] = useState<string[]>([]);
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [ankiConnectionStatus, setAnkiConnectionStatus] = useState<'connected' | 'disconnected' | 'checking' | null>(null);

  // Available field options for dropdown (memoized to prevent re-creation on every render)
  const fieldOptions = useMemo(() => [
    { value: 'none', label: 'None' },
    { value: '{expression}', label: '{expression}' },
    { value: '{reading}', label: '{reading}' },
    { value: '{main_definition}', label: '{main_definition}' },
    { value: '{glossary}', label: '{glossary}' },
    { value: '{sentence}', label: '{sentence}' },
    { value: '{pitch_accent}', label: '{pitch_accent}' },
    { value: '{pitch_position}', label: '{pitch_position}' },
    { value: '{pitch_categories}', label: '{pitch_categories}' },
    { value: '{expression_furigana}', label: '{expression_furigana}' },
    { value: '{expression_audio}', label: '{expression_audio}' },
    { value: '{document-title}', label: '{document-title}' },
    { value: '{frequency}', label: '{frequency}' },
    { value: '{frequency-harmonic-rank}', label: '{frequency-harmonic-rank}' }
  ], []);

  const loadUserStatus = useCallback(() => {
    console.log('🔐 Loading user status in settings...');

    // Check for Supabase session directly (new authentication flow)
    chrome.storage.local.get(['supabaseSession'], (sessionResult) => {
      if (!sessionResult['supabaseSession']) {
        console.log('🔐 No session found in settings');
        setUserInfo(null);
        return;
      }

      console.log('🔐 Session found, checking service worker...');

      // Check if service worker has valid client
      chrome.runtime.sendMessage({ type: SW_EVENT_SUPABASE_GET_CLIENT }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('🔐 Error checking service worker:', chrome.runtime.lastError);
          setUserInfo(null);
          return;
        }

        console.log(`🔐 ${SW_EVENT_SUPABASE_GET_CLIENT} response in settings:`, response);

        if (response && response.hasClient && response.isSessionValid) {
          chrome.runtime.sendMessage({ type: SW_EVENT_SUPABASE_GET_USER }, (userResponse) => {
            if (chrome.runtime.lastError) {
              console.error('🔐 Error getting user:', chrome.runtime.lastError);
              setUserInfo(null);
              return;
            }

            console.log(`🔐 ${SW_EVENT_SUPABASE_GET_USER} response in settings:`, userResponse);

            if (userResponse && userResponse.user) {
              chrome.runtime.sendMessage({ type: SW_EVENT_SUPABASE_GET_CARDS }, (cardsResponse) => {
                if (chrome.runtime.lastError) {
                  console.error('🔐 Error getting cards:', chrome.runtime.lastError);
                  // Still set user info even if cards fail
                  setUserInfo({
                    ...userResponse.user,
                    cardsCount: 0
                  });
                  return;
                }

                console.log(`🔐 ${SW_EVENT_SUPABASE_GET_CARDS} response in settings:`, cardsResponse);

                setUserInfo({
                  ...userResponse.user,
                  cardsCount: cardsResponse?.cards?.length || 0
                });
              });
            } else {
              setUserInfo(null);
            }
          });
        } else {
          console.log('🔐 Service worker client not ready or session invalid');
          setUserInfo(null);
        }
      });
    });
  }, []);

  const fetchAnkiDecks = useCallback(async () => {
    if (!settings.anki_connect_url) return;

    setIsLoadingAnki(true);
    try {
      const response = await fetch(settings.anki_connect_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'deckNames',
          version: 6
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }

      setAnkiDecks(result.result || []);
      showStatus('Anki decks loaded successfully', 'success');
    } catch (error) {
      console.error('Error fetching Anki decks:', error);
      showStatus(`Failed to load Anki decks: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      setAnkiDecks([]);
    } finally {
      setIsLoadingAnki(false);
    }
  }, [settings.anki_connect_url]);

  const fetchAnkiNoteTypes = useCallback(async () => {
    if (!settings.anki_connect_url) return;

    setIsLoadingAnki(true);
    try {
      const response = await fetch(settings.anki_connect_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'modelNames',
          version: 6
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }

      setAnkiNoteTypes(result.result || []);
      showStatus('Anki note types loaded successfully', 'success');
    } catch (error) {
      console.error('Error fetching Anki note types:', error);
      showStatus(`Failed to load Anki note types: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      setAnkiNoteTypes([]);
    } finally {
      setIsLoadingAnki(false);
    }
  }, [settings.anki_connect_url]);

  const fetchNoteTypeFields = useCallback(async (noteTypeName: string) => {
    if (!settings.anki_connect_url || !noteTypeName) return;

    setIsLoadingAnki(true);
    try {
      const response = await fetch(settings.anki_connect_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'modelFieldNames',
          version: 6,
          params: {
            modelName: noteTypeName
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }

      const fields = result.result || [];
      setNoteTypeFields(fields);

      // Initialize field mappings with automatic matching
      const initialMappings: Record<string, string> = {};
      fields.forEach((field: string) => {
        // Check if there's an existing mapping
        if (fieldMappings[field]) {
          initialMappings[field] = fieldMappings[field];
        } else {
          // Auto-map fields that match exactly (case-insensitive)
          // Also try converting CamelCase to snake_case using case-anything
          const fieldLower = field.toLowerCase();
          const fieldSnakeCase = snakeCase(field);

          // Special case mappings
          let autoMapping = null;
          if (field === 'ExpressionReading') {
            autoMapping = fieldOptions.find(option => option.value === '{reading}');
          } else if (field === 'PitchPosition') {
            autoMapping = fieldOptions.find(option => option.value === '{pitch_position}');
          } else if (field === 'PitchCategories') {
            autoMapping = fieldOptions.find(option => option.value === '{pitch_categories}');
          } else if (field === 'FreqSort') {
            autoMapping = fieldOptions.find(option => option.value === '{frequency-harmonic-rank}');
          } else {
            autoMapping = fieldOptions.find(option => {
              if (option.value === 'none') return false;
              const optionField = option.value.replace(/[{}]/g, '').toLowerCase();
              return optionField === fieldLower || optionField === fieldSnakeCase;
            });
          }
          initialMappings[field] = autoMapping ? autoMapping.value : '';
        }
      });
      setFieldMappings(initialMappings);

      showStatus(`Loaded ${fields.length} fields for ${noteTypeName}`, 'success');
    } catch (error) {
      console.error('Error fetching note type fields:', error);
      showStatus(`Failed to load fields for ${noteTypeName}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      setNoteTypeFields([]);
      setFieldMappings({});
    } finally {
      setIsLoadingAnki(false);
    }
  }, [settings.anki_connect_url, fieldMappings, fieldOptions]);

  useEffect(() => {
    loadSettings();
    loadUserStatus();

    // CRITICAL: Port keep-alive to prevent service worker from dying during OAuth
    const port = browser.runtime.connect({ name: 'auth-keepalive' });
    console.log('🔐 [SETTINGS] Port keep-alive established');

    // Listen for auth status updates from service worker
    port.onMessage.addListener((msg: any) => {
      if (msg.type === 'auth:status') {
        console.log('🔐 [SETTINGS] Auth status update:', msg.stage);
      }
    });

    // Listen for storage changes to update authentication status
    const handleStorageChange = (changes: { [key: string]: Storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && (changes['device_token'] || changes['supabaseSession'])) {
        // Reload user status when device token or session changes
        loadUserStatus();
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);

    return () => {
      port.disconnect();
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [loadUserStatus]);

  // Helper function to check AnkiConnect connection
  const checkAnkiConnection = useCallback(async (silent: boolean = true) => {
    if (!settings.anki_connect_url) {
      if (!silent) {
        showStatus('Please enter an AnkiConnect URL first', 'error');
      }
      setAnkiConnectionStatus(null);
      return;
    }

    if (!silent) {
      setIsTestingAnki(true);
    }
    setAnkiTestResult(null);
    setAnkiConnectionStatus('checking');

    try {
      const response = await fetch(settings.anki_connect_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'version',
          version: 6
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }

      setAnkiTestResult({
        success: true,
        message: `AnkiConnect v${result.result}`
      });
      setAnkiConnectionStatus('connected');

      if (!silent) {
        showStatus(`✅ AnkiConnect connection successful! Version: ${result.result}`, 'success');
      } else {
        console.log('AnkiConnect is available, version:', result.result);
      }

      // Fetch decks and note types after successful connection
      void fetchAnkiDecks();
      void fetchAnkiNoteTypes();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setAnkiTestResult({
        success: false,
        message: errorMessage
      });
      setAnkiConnectionStatus('disconnected');

      if (!silent) {
        console.error('Error testing AnkiConnect connection:', error);
        showStatus(`❌ AnkiConnect connection failed: ${errorMessage}`, 'error');
      } else {
        console.log('AnkiConnect is not available:', errorMessage);
      }
    } finally {
      if (!silent) {
        setIsTestingAnki(false);
      }
    }
  }, [settings.anki_connect_url, fetchAnkiDecks, fetchAnkiNoteTypes]);

  // Wrapper for the manual "Test Connection" button
  const testAnkiConnection = () => checkAnkiConnection(false);

  const startDiscordAuth = useCallback(async () => {
    console.log('🔐 [SETTINGS] startDiscordAuth called');

    if (isAuthenticating) {
      console.log('🔐 [SETTINGS] OAuth already in progress');
      return;
    }

    setIsAuthenticating(true);
    showStatus('Starting Discord authentication...', 'info');

    try {
      // Message the service worker to start OAuth
      // The service worker will handle launchWebAuthFlow
      console.log('🔐 [SETTINGS] Sending auth:start message to service worker...');

      const response = await browser.runtime.sendMessage({
        type: SW_EVENT_AUTH_SIGN_IN_DISCORD
      });

      console.log('🔐 [SETTINGS] Auth response:', response);

      if (response && (response as { ok?: boolean; error?: string }).ok) {
        showStatus('Successfully signed in with Discord!', 'success');
        setTimeout(loadUserStatus, 500);
      } else {
        throw new Error((response as { error?: string })?.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('🔐 [SETTINGS] OAuth failed:', error);
      showStatus(`Failed to sign in: ${(error as Error).message}`, 'error');
    } finally {
      setIsAuthenticating(false);
    }
  }, [isAuthenticating, loadUserStatus]);

  // Auto-load Anki data when settings are loaded or AnkiConnect URL changes
  // But first test the connection to avoid errors when Anki is not running
  useEffect(() => {
    if (settings.anki_connect_url) {
      void checkAnkiConnection();
    } else {
      setAnkiConnectionStatus(null);
    }
  }, [settings.anki_connect_url, checkAnkiConnection]);

  // Auto-load note type fields when a note type is selected
  useEffect(() => {
    if (settings.anki_note_type && settings.anki_connect_url) {
      void fetchNoteTypeFields(settings.anki_note_type);
    }
  }, [settings.anki_note_type, settings.anki_connect_url, fetchNoteTypeFields]);

  // Check for navigation requests from popup
  useEffect(() => {
    const checkNavigationRequest = async () => {
      try {
        const result = await new Promise<{ navigateToSection?: string }>((resolve) => {
          chrome.storage.local.get(['navigateToSection'], (res) => resolve(res as { navigateToSection?: string }));
        });

        if (result.navigateToSection) {
          // Clear the navigation flag
          void chrome.storage.local.remove(['navigateToSection']);

          // Wait a bit for the page to fully load, then scroll to the section
          setTimeout(() => {
            const element = document.getElementById(result.navigateToSection!);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
              // Add a subtle highlight effect
              element.style.transition = 'box-shadow 0.3s ease';
              element.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.5)';
              setTimeout(() => {
                element.style.boxShadow = '';
              }, 2000);
            }
          }, 500);
        }
      } catch (error) {
        console.error('Error checking navigation request:', error);
      }
    };

    void checkNavigationRequest();
  }, []);

  // Check for OAuth trigger from popup
  useEffect(() => {
    const checkOAuthTrigger = async () => {
      try {
        const result = await browser.storage.local.get(['triggerOAuth']);

        if (result['triggerOAuth']) {
          // Clear the trigger flag
          await browser.storage.local.remove(['triggerOAuth']);
          console.log('🔐 [SETTINGS] OAuth triggered from popup');

          // Start OAuth flow
          void startDiscordAuth();
        }
      } catch (error) {
        console.error('🔐 [SETTINGS] Error checking OAuth trigger:', error);
      }
    };

    void checkOAuthTrigger();
  }, [startDiscordAuth]);

  const loadSettings = () => {
    chrome.storage.local.get([...Object.keys(defaultSettings), 'fieldMappings'], (result) => {
      setSettings({
        api_base_url: result['api_base_url'] || defaultSettings.api_base_url,
        api_timeout: result['api_timeout'] || defaultSettings.api_timeout,
        auto_load_cards: result['auto_load_cards'] !== false,
        show_debug_info: result['show_debug_info'] || false,
        enable_notifications: result['enable_notifications'] !== false,
        log_level: result['log_level'] || defaultSettings.log_level,
        anki_connect_url: result['anki_connect_url'] || defaultSettings.anki_connect_url,
        anki_deck: result['anki_deck'] || defaultSettings.anki_deck,
        anki_note_type: result['anki_note_type'] || defaultSettings.anki_note_type,
      });
      setFieldMappings(result['fieldMappings'] || {});
    });
  };

  const showStatus = (message: string, type: 'success' | 'error' | 'info') => {
    setStatus({ message, type });
    setTimeout(() => setStatus(null), 5000);
  };

  const resetAutoMappings = () => {
    if (!noteTypeFields.length) {
      showStatus('No note type fields available to reset', 'error');
      return;
    }

    // Re-apply auto-mapping logic to reset all mappings
    const initialMappings: Record<string, string> = {};
    noteTypeFields.forEach((field: string) => {
      // Auto-map fields that match exactly (case-insensitive)
      // Also try converting CamelCase to snake_case using case-anything
      const fieldLower = field.toLowerCase();
      const fieldSnakeCase = snakeCase(field);

      // Special case mappings
      let autoMapping = null;
      if (field === 'ExpressionReading') {
        autoMapping = fieldOptions.find(option => option.value === '{reading}');
      } else if (field === 'PitchPosition') {
        autoMapping = fieldOptions.find(option => option.value === '{pitch_position}');
      } else if (field === 'PitchCategories') {
        autoMapping = fieldOptions.find(option => option.value === '{pitch_categories}');
      } else if (field === 'FreqSort') {
        autoMapping = fieldOptions.find(option => option.value === '{frequency-harmonic-rank}');
      } else {
        autoMapping = fieldOptions.find(option => {
          if (option.value === 'none') return false;
          const optionField = option.value.replace(/[{}]/g, '').toLowerCase();
          return optionField === fieldLower || optionField === fieldSnakeCase;
        });
      }
      initialMappings[field] = autoMapping ? autoMapping.value : '';
    });

    setFieldMappings(initialMappings);
    showStatus(`Reset auto-mapping for ${noteTypeFields.length} fields`, 'success');
  };

  const saveSettings = async () => {
    setIsSaving(true);

    try {
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({
          ...settings,
          fieldMappings
        }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });

      showStatus('Settings saved successfully!', 'success');
      setTimeout(loadUserStatus, 1000);
    } catch(error) {
      showStatus('Failed to save settings. Please try again.', 'error');
      console.log(`Failed to save settings, error=${JSON.stringify(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      chrome.storage.local.set(defaultSettings, () => {
        setSettings(defaultSettings);
        showStatus('Settings reset to defaults', 'info');
      });
    }
  };

  const signOut = async () => {
    if (!confirm('Are you sure you want to sign out?')) return;

    try {
      chrome.runtime.sendMessage({ type: SW_EVENT_AUTH_SIGN_OUT }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error signing out:', chrome.runtime.lastError);
          showStatus('Failed to sign out', 'error');
          return;
        }

        if (response && response.ok) {
          showStatus('Successfully signed out', 'success');
          loadUserStatus();
        } else {
          showStatus('Failed to sign out', 'error');
        }
      });
    } catch (error) {
      console.error('Error signing out:', error);
      showStatus('Failed to sign out', 'error');
    }
  };

  const clearCache = () => {
    if (confirm('Are you sure you want to clear the extension cache?')) {
      chrome.storage.local.clear(() => {
        showStatus('Cache cleared successfully', 'success');
        loadSettings();
        loadUserStatus();
      });
    }
  };


  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg">
                <Settings className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">JReader Extension Settings</h1>
                <p className="text-sm sm:text-base text-muted-foreground mt-1">Configure your extension preferences and API settings</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Main Content - Mobile-first single column, desktop grid */}
        <div className="space-y-4 sm:space-y-6 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
          {/* Main Settings - Mobile-first single column, desktop spans 2 columns */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">

            {/* User Status */}
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <div className="p-1.5 bg-green-100 dark:bg-green-900/50 rounded-md">
                    <User className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  Authentication Status
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {userInfo && userInfo.id ? (
                  <div className="space-y-4">
                    {/* Profile Section with Authentication Status */}
                    <div className="flex items-center gap-3 p-3 sm:p-4 bg-muted/50 rounded-lg">
                      <img
                        src={userInfo.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userInfo.user_metadata?.global_name || userInfo.user_metadata?.full_name || userInfo.email || 'User')}&background=007bff&color=fff&size=40`}
                        alt="User"
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-semibold text-foreground text-sm">
                            {userInfo.user_metadata?.global_name || userInfo.user_metadata?.full_name || userInfo.email || 'User'}
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-green-500 dark:bg-green-400 rounded-full"></div>
                            <span className="text-green-700 dark:text-green-300 font-medium text-xs">Authenticated</span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {userInfo.cardsCount} cards
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={signOut}
                      className="w-full"
                    >
                      Sign Out
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 sm:p-4 bg-muted/50 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-semibold text-foreground text-sm">
                            Not Connected
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-red-500 dark:bg-red-400 rounded-full"></div>
                            <span className="text-red-700 dark:text-red-300 font-medium text-xs">Not Connected</span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Sign in with Discord to sync your cards
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={startDiscordAuth}
                      disabled={isAuthenticating}
                      className="w-full"
                    >
                      {isAuthenticating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        <>
                          <User className="h-4 w-4 mr-2" />
                          Sign in with Discord
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* API Configuration */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-md">
                    <Server className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  API Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                <div className="space-y-4 sm:space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="apiUrl" className="text-sm font-medium">API Base URL</Label>
                    <Input
                      id="apiUrl"
                      type="url"
                      value={settings.api_base_url}
                      readOnly
                      className="w-full text-sm bg-muted text-muted-foreground cursor-not-allowed"
                      title="This setting is managed by the extension and cannot be modified"
                    />
                    <p className="text-xs text-muted-foreground">The base URL for your JReader API server (read-only)</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="apiTimeout" className="text-sm font-medium">API Timeout (seconds)</Label>
                    <Input
                      id="apiTimeout"
                      type="number"
                      min="5"
                      max="60"
                      value={settings.api_timeout}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({...settings, api_timeout: parseInt(e.target.value) || 30})}
                      className="w-full text-sm"
                    />
                    <p className="text-xs text-muted-foreground">How long to wait for API responses</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Extension Behavior */}
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <div className="p-1.5 bg-purple-100 dark:bg-purple-900/50 rounded-md">
                    <Settings className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  Extension Behavior
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <Checkbox
                      id="autoLoadCards"
                      checked={settings.auto_load_cards}
                      onCheckedChange={(checked: boolean) => setSettings({...settings, auto_load_cards: !!checked})}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <Label htmlFor="autoLoadCards" className="text-sm font-medium cursor-pointer">Auto-load cards when popup opens</Label>
                      <p className="text-xs text-muted-foreground mt-1">Automatically fetch and display cards when opening the extension popup</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <Checkbox
                      id="showDebugInfo"
                      checked={settings.show_debug_info}
                      onCheckedChange={(checked: boolean) => setSettings({...settings, show_debug_info: !!checked})}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <Label htmlFor="showDebugInfo" className="text-sm font-medium cursor-pointer">Show debug information</Label>
                      <p className="text-xs text-muted-foreground mt-1">Display additional debugging information in the console</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <Checkbox
                      id="enableNotifications"
                      checked={settings.enable_notifications}
                      onCheckedChange={(checked: boolean) => setSettings({...settings, enable_notifications: !!checked})}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <Label htmlFor="enableNotifications" className="text-sm font-medium cursor-pointer">Enable notifications</Label>
                      <p className="text-xs text-muted-foreground mt-1">Show browser notifications for important events</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Anki Settings */}
            <Card id="anki-settings" className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <div className="p-1.5 bg-orange-100 dark:bg-orange-900/50 rounded-md">
                    <BookOpen className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  Anki Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="ankiConnectUrl" className="text-sm font-medium">AnkiConnect URL</Label>
                      <div className="flex items-center gap-2">
                        {ankiConnectionStatus === 'connected' && ankiTestResult?.success && (
                          <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full"></div>
                            <span>v{ankiTestResult.message.replace('AnkiConnect v', '')}</span>
                          </div>
                        )}
                        {ankiConnectionStatus === 'checking' && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Checking...</span>
                          </div>
                        )}
                        {ankiConnectionStatus === 'disconnected' && ankiTestResult?.success === false && (
                          <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                            <XCircle className="h-3 w-3" />
                            <span>Unavailable (is Anki running?)</span>
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={testAnkiConnection}
                          disabled={isTestingAnki || !settings.anki_connect_url}
                          className="h-6 px-2 text-xs"
                        >
                          {isTestingAnki ? 'Testing...' : 'Test Connection'}
                        </Button>
                      </div>
                    </div>
                    <Input
                      id="ankiConnectUrl"
                      type="url"
                      value={settings.anki_connect_url}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setSettings({...settings, anki_connect_url: e.target.value});
                        setAnkiTestResult(null); // Clear test result when URL changes
                      }}
                      placeholder="http://127.0.0.1:8765"
                      className="w-full text-sm"
                    />
                    <p className="text-xs text-muted-foreground">URL where AnkiConnect is running (default: 127.0.0.1:8765)</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="ankiDeck" className="text-sm font-medium">Deck</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchAnkiDecks}
                        disabled={isLoadingAnki || !settings.anki_connect_url}
                        className="h-6 px-2 text-xs"
                      >
                        {isLoadingAnki ? 'Loading...' : 'Refresh'}
                      </Button>
                    </div>
                    {isLoadingAnki ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Select value={settings.anki_deck} onValueChange={(value: string) => setSettings({...settings, anki_deck: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder={ankiDecks.length > 0 ? "Select a deck" : "Load decks first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {ankiDecks.length > 0 ? (
                            ankiDecks.map((deck) => (
                              <SelectItem key={deck} value={deck}>{deck}</SelectItem>
                            ))
                          ) : (
                            <SelectItem value="__no_decks__" disabled>No decks loaded</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                    <p className="text-xs text-muted-foreground">Choose which Anki deck to add new cards to</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="ankiNoteType" className="text-sm font-medium">Note Type</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchAnkiNoteTypes}
                        disabled={isLoadingAnki || !settings.anki_connect_url}
                        className="h-6 px-2 text-xs"
                      >
                        {isLoadingAnki ? 'Loading...' : 'Refresh'}
                      </Button>
                    </div>
                    {isLoadingAnki ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Select value={settings.anki_note_type} onValueChange={(value: string) => setSettings({...settings, anki_note_type: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder={ankiNoteTypes.length > 0 ? "Select a note type" : "Load note types first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {ankiNoteTypes.length > 0 ? (
                            ankiNoteTypes.map((noteType) => (
                              <SelectItem key={noteType} value={noteType}>{noteType}</SelectItem>
                            ))
                          ) : (
                            <SelectItem value="__no_note_types__" disabled>No note types loaded</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                    <p className="text-xs text-muted-foreground">Choose the note type template for new cards</p>
                  </div>

                  {/* Marker Reference Table */}
                  <div className="space-y-3 pt-4 border-t border-border">
                    <details className="group">
                      <summary className="cursor-pointer text-sm font-medium text-foreground hover:text-primary transition-colors">
                        📋 Marker Reference
                        <span className="ml-2 text-xs text-muted-foreground group-open:hidden">(click to expand)</span>
                        <span className="ml-2 text-xs text-muted-foreground hidden group-open:inline">(click to collapse)</span>
                      </summary>
                      <div className="mt-3 overflow-hidden rounded-lg border border-border">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-foreground">Marker</th>
                              <th className="px-3 py-2 text-left font-medium text-foreground">Description</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            <tr>
                              <td className="px-3 py-2 font-mono text-foreground">{'{expression}'}</td>
                              <td className="px-3 py-2 text-muted-foreground">The Japanese term in kanji (or kana if kanji not available)</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 font-mono text-foreground">{'{reading}'}</td>
                              <td className="px-3 py-2 text-muted-foreground">Kana reading for the term</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 font-mono text-foreground">{'{main_definition}'}</td>
                              <td className="px-3 py-2 text-muted-foreground">First definition from the dictionary entry</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 font-mono text-foreground">{'{sentence}'}</td>
                              <td className="px-3 py-2 text-muted-foreground">Example sentence or context where the term appears</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 font-mono text-foreground">{'{pitch_accent}'}</td>
                              <td className="px-3 py-2 text-muted-foreground">Pitch accent information for the term</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 font-mono text-foreground">{'{expression_furigana}'}</td>
                              <td className="px-3 py-2 text-muted-foreground">Expression with reading in brackets: expression[reading]</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 font-mono text-foreground">{'{expression_audio}'}</td>
                              <td className="px-3 py-2 text-muted-foreground">Audio file for the expression pronunciation (requires audio to be available)</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-2 font-mono text-foreground">{'{document-title}'}</td>
                              <td className="px-3 py-2 text-muted-foreground">Title of the book or content that the term appeared in. Unavailable in standalone dictionary page.</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </div>

                  {/* Field Mapping Section */}
                  {noteTypeFields.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">Field Mapping</h4>
                        <span className="text-xs text-muted-foreground">
                          {noteTypeFields.length} field{noteTypeFields.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Configure what values will be populated in each field when creating cards
                      </p>

                      {/* Reset Auto-Mapping Button */}
                      <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <RotateCcw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Reset Auto-Mapping</span>
                          </div>
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            Restore all recommended field mappings. Useful if you've made changes and want to start over with the smart defaults.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={resetAutoMappings}
                          disabled={!noteTypeFields.length}
                          className="ml-3 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Reset
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-xs font-medium text-muted-foreground">
                          <div>Field</div>
                          <div>Value</div>
                        </div>

                        {isLoadingAnki ? (
                          Array.from({ length: 3 }).map((_, index) => (
                            <div key={index} className="grid grid-cols-2 gap-3 items-center">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-10 w-full" />
                            </div>
                          ))
                        ) : (
                          noteTypeFields.map((field) => (
                            <div key={field} className="grid grid-cols-2 gap-3 items-center">
                              <div className="text-sm font-medium text-foreground">
                                {field}
                              </div>
                              <Select
                                value={fieldMappings[field] || 'none'}
                                onValueChange={(value: string) => setFieldMappings({
                                  ...fieldMappings,
                                  [field]: value === 'none' ? '' : value
                                })}
                              >
                                <SelectTrigger className="text-sm">
                                  <SelectValue placeholder="Select field mapping" />
                                </SelectTrigger>
                                <SelectContent>
                                  {fieldOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Mobile appears below main content, desktop on right */}
          <div className="space-y-4 sm:space-y-6">

            {/* Debug Section */}
            <Card className="border-l-4 border-l-yellow-500 dark:border-l-yellow-400 bg-yellow-50/50 dark:bg-yellow-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-yellow-800 dark:text-yellow-200">
                  <div className="p-1.5 bg-yellow-100 dark:bg-yellow-900/50 rounded-md">
                    <Bug className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  Debug & Tools
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="logLevel" className="text-sm font-medium">Log Level</Label>
                  <Select value={settings.log_level} onValueChange={(value: string) => setSettings({...settings, log_level: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="error">Error Only</SelectItem>
                      <SelectItem value="warn">Warning & Error</SelectItem>
                      <SelectItem value="info">Info, Warning & Error</SelectItem>
                      <SelectItem value="debug">All Logs</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Controls console logging verbosity</p>
                </div>

                <div className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={clearCache}
                    className="w-full justify-start"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Cache
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-card rounded-lg border shadow-sm">
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="font-semibold text-foreground text-base sm:text-lg">Save Your Changes</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Don't forget to save your settings after making changes</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={saveSettings}
                disabled={isSaving}
                className="flex-1"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : status?.type === 'success' && status.message.includes('saved successfully') ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Saved!
                  </>
                ) : (
                  'Save Settings'
                )}
              </Button>
              <Button
                variant="secondary"
                onClick={resetToDefaults}
                className="flex-1"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </Button>
            </div>
          </div>
        </div>

        {/* Status Message */}
        {status && (
          <div className={`p-3 sm:p-4 rounded-md text-sm sm:text-base ${
            status.type === 'success' ? 'bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800' :
            status.type === 'error' ? 'bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800' :
            'bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
          }`}>
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
}

// Initialize the React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <ThemeProvider>
      <SettingsPage />
    </ThemeProvider>
  );
}
