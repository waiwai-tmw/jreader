'use client'

import type { DropResult } from "@hello-pangea/dnd";
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

import { BaseHeader } from "@/components/BaseHeader"
import SettingsPane from "@/components/SettingsPane"
import { useAuth } from '@/contexts/AuthContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { usePageTitle } from '@/hooks/usePageTitle'


export default function SettingsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  usePageTitle('Settings - JReader');
  
  const [preferences, setPreferences] = useState<{
    dictionaryOrder: string[];
    disabledDictionaries: string[];
    spoilerDictionaries: string[];
    freqDictionaryOrder: string[];
    freqDisabledDictionaries: string[];
    shouldHighlightKanjiInSearch?: boolean;
    shouldHighlightKanjiInText?: boolean;
  } | null>(null);

  // Check authentication
  useEffect(() => {
    if (!isLoading && !user) {
      // Not logged in - redirect to login
      router.push('/login');
      return;
    }
  }, [user, isLoading, router]);

  // Load user preferences with localStorage caching
  useEffect(() => {
    if (!user) return; // Don't load preferences if not authenticated

    const loadData = async () => {
      try {
        // Use the user from AuthContext instead of making another getUser call
        if (!user) return;

        // Try to load from localStorage first
        const cachedPreferences = localStorage.getItem(`user-preferences-${user.id}`);
        if (cachedPreferences) {
          try {
            const parsed = JSON.parse(cachedPreferences);
            // Note: We don't set preferences here as we need the full structure for settings
          } catch (e) {
            // console.log('Failed to parse cached preferences, fetching from database');
          }
        }

        // Fetch preferences from API
        const response = await fetch('/api/preferences', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch preferences');
        }

        const { preferences: data } = await response.json();

        let preferences;

        if (!data) {
          // console.log('No user preferences found');

          // Get all dictionaries from Dictionary Index
          const dictResponse = await fetch('/api/dictionaries', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!dictResponse.ok) {
            throw new Error('Failed to fetch dictionaries');
          }

          const { dictionaries: dictIndexData } = await dictResponse.json();

          // Create default preferences
          const termDicts = dictIndexData
              ?.filter((d: any) => d.type === 0)
              .map((d: any) => `${d.title}#${d.revision}`) || [];

          const freqDicts = dictIndexData
              ?.filter((d: any) => d.type === 2)
              .map((d: any) => `${d.title}#${d.revision}`) || [];

          preferences = {
              dictionaryOrder: termDicts,
              disabledDictionaries: [],
              spoilerDictionaries: [],
              freqDictionaryOrder: freqDicts,
              freqDisabledDictionaries: [],
              shouldHighlightKanjiInSearch: true,
              shouldHighlightKanjiInText: true
          };

          // console.log('Created default preferences from Dictionary Index:', preferences);
        } else {
          // console.log('Loaded user preferences from API:', data);
          preferences = data;
        }

        // Cache in localStorage
        const cacheKey = `user-preferences-${user.id}`;
        const preferencesToCache = {
          dictionaryOrder: preferences.dictionaryOrder,
          disabledDictionaries: preferences.disabledDictionaries,
          spoilerDictionaries: preferences.spoilerDictionaries,
          freqDictionaryOrder: preferences.freqDictionaryOrder,
          shouldHighlightKanjiInSearch: preferences.shouldHighlightKanjiInSearch,
          shouldHighlightKanjiInText: preferences.shouldHighlightKanjiInText
        };
        localStorage.setItem(cacheKey, JSON.stringify(preferencesToCache));
        // console.log('Cached preferences in localStorage from settings');

        setPreferences(preferences);
      } catch (err) {
        // console.error('Failed to load user preferences:', err);
      }
    };
    loadData();
  }, [user?.id]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  // Show loading while redirecting
  if (!user) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">Redirecting...</div>
        </div>
      </div>
    );
  }

  const updatePreferences = async (newPreferences: typeof preferences) => {
    if (!newPreferences || !user) return;

    try {
      // Use the user from AuthContext instead of making another getUser call
      if (!user) return;

      // Update preferences via API
      const response = await fetch('/api/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preferences: newPreferences }),
      });

      // console.log('🔍 Settings: User Preferences update executed for user:', user.id);

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      // Update localStorage cache
      const cacheKey = `user-preferences-${user.id}`;
      const cachedPreferences = {
        dictionaryOrder: newPreferences.dictionaryOrder,
        disabledDictionaries: newPreferences.disabledDictionaries,
        spoilerDictionaries: newPreferences.spoilerDictionaries,
        freqDictionaryOrder: newPreferences.freqDictionaryOrder,
        shouldHighlightKanjiInSearch: newPreferences.shouldHighlightKanjiInSearch ?? true,
        shouldHighlightKanjiInText: newPreferences.shouldHighlightKanjiInText ?? true
      };
      localStorage.setItem(cacheKey, JSON.stringify(cachedPreferences));
      // console.log('Updated preferences cache in localStorage');

      setPreferences(newPreferences);
      // console.log('Updated preferences:', newPreferences);
    } catch (err) {
      // console.error('Failed to update preferences:', err);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination || !preferences) return;

    const { source, destination } = result;
    const newPrefs = { ...preferences };

    // Handle moving between term dictionary lists
    if (source.droppableId.startsWith('term-')) {
      if (source.droppableId === 'term-order' && destination.droppableId === 'term-disabled') {
        const [removed] = newPrefs.dictionaryOrder.splice(source.index, 1);
        newPrefs.disabledDictionaries.splice(destination.index, 0, removed);
      } else if (source.droppableId === 'term-disabled' && destination.droppableId === 'term-order') {
        const [removed] = newPrefs.disabledDictionaries.splice(source.index, 1);
        newPrefs.dictionaryOrder.splice(destination.index, 0, removed);
      } else if (source.droppableId === 'term-order' && destination.droppableId === 'term-order') {
        const [removed] = newPrefs.dictionaryOrder.splice(source.index, 1);
        newPrefs.dictionaryOrder.splice(destination.index, 0, removed);
      } else if (source.droppableId === 'term-disabled' && destination.droppableId === 'term-disabled') {
        const [removed] = newPrefs.disabledDictionaries.splice(source.index, 1);
        newPrefs.disabledDictionaries.splice(destination.index, 0, removed);
      }
    }
    // Handle moving between frequency dictionary lists
    else if (source.droppableId.startsWith('freq-')) {
      if (source.droppableId === 'freq-order' && destination.droppableId === 'freq-disabled') {
        const [removed] = newPrefs.freqDictionaryOrder.splice(source.index, 1);
        newPrefs.freqDisabledDictionaries.splice(destination.index, 0, removed);
      } else if (source.droppableId === 'freq-disabled' && destination.droppableId === 'freq-order') {
        const [removed] = newPrefs.freqDisabledDictionaries.splice(source.index, 1);
        newPrefs.freqDictionaryOrder.splice(destination.index, 0, removed);
      } else if (source.droppableId === 'freq-order' && destination.droppableId === 'freq-order') {
        const [removed] = newPrefs.freqDictionaryOrder.splice(source.index, 1);
        newPrefs.freqDictionaryOrder.splice(destination.index, 0, removed);
      } else if (source.droppableId === 'freq-disabled' && destination.droppableId === 'freq-disabled') {
        const [removed] = newPrefs.freqDisabledDictionaries.splice(source.index, 1);
        newPrefs.freqDisabledDictionaries.splice(destination.index, 0, removed);
      }
    }

    setPreferences(newPrefs);
    updatePreferences(newPrefs);
  };

  const toggleSpoiler = (dict: string) => {
    if (!preferences) return;
    const newPrefs = { ...preferences };
    if (newPrefs.spoilerDictionaries.includes(dict)) {
      newPrefs.spoilerDictionaries = newPrefs.spoilerDictionaries.filter(d => d !== dict);
    } else {
      newPrefs.spoilerDictionaries = [...newPrefs.spoilerDictionaries, dict];
    }
    updatePreferences(newPrefs);
  };

  const toggleFrequencyDictionary = async (dict: { title: string, revision: string }) => {
    if (!preferences) return;
    const dictString = `${dict.title}#${dict.revision}`;
    const newPrefs = { ...preferences };
    if (newPrefs.freqDisabledDictionaries.includes(dictString)) {
      newPrefs.freqDisabledDictionaries = newPrefs.freqDisabledDictionaries.filter(d => d !== dictString);
    } else {
      newPrefs.freqDisabledDictionaries = [...newPrefs.freqDisabledDictionaries, dictString];
    }
    await updatePreferences(newPrefs);
  };

  const toggleKanjiHighlightingInSearch = async () => {
    if (!preferences) return;
    const newPrefs = { ...preferences };
    newPrefs.shouldHighlightKanjiInSearch = !newPrefs.shouldHighlightKanjiInSearch;
    await updatePreferences(newPrefs);
  };

  const toggleKanjiHighlightingInText = async () => {
    if (!preferences) return;
    const newPrefs = { ...preferences };
    newPrefs.shouldHighlightKanjiInText = !newPrefs.shouldHighlightKanjiInText;
    await updatePreferences(newPrefs);
  };

  const settingsContext = {
    preferences,
    onDragEnd,
    toggleSpoiler,
    toggleFrequencyDictionary,
    toggleKanjiHighlightingInSearch,
    toggleKanjiHighlightingInText,
    fontSize: 1,
    verticalMargin: 0.5,
    updateSetting: (type: 'fontSize' | 'verticalMargin' | 'einkMode', value: number | boolean) => {
      // This is a placeholder - the settings page doesn't handle these settings
      // console.log('updateSetting called:', type, value);
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      <BaseHeader title="Settings" />
      <div className="relative flex-1 min-h-0">
        <div className="absolute inset-0 overflow-y-auto p-6">
          <SettingsProvider value={settingsContext}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-lg border bg-card p-6">
                <h3 className="font-semibold mb-4">Term Dictionaries</h3>
                <SettingsPane.TermDictionaries />
              </div>
              <div className="rounded-lg border bg-card p-6">
                <h3 className="font-semibold mb-4">Frequency Dictionaries</h3>
                <SettingsPane.FrequencyDictionaries />
              </div>
              <div className="rounded-lg border bg-card p-6">
                <h3 className="font-semibold mb-4">Search Settings</h3>
                <SettingsPane.KanjiHighlightingSettings />
              </div>
              <div className="rounded-lg border bg-card p-6">
                <h3 className="font-semibold mb-4">Display Settings</h3>
                <SettingsPane.EinkModeSettings />
              </div>
            </div>
          </SettingsProvider>
        </div>
      </div>
    </div>
  );
} 