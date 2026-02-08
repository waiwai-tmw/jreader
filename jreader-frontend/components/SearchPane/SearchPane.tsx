'use client'

import { CheckCheck, Volume2, CirclePlus, BookOpenText, BookOpenCheck, ArrowLeft, ArrowRight } from "lucide-react";
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { match } from 'ts-pattern';

import { Breadcrumb } from './Breadcrumb';
import { DefinitionText, DefinitionView } from './Definition';
import { DictionaryExplanation } from './DictionaryExplanation';
import { PitchAccentGraphs } from './PitchAccent';

import { Badge } from "@/components/ui/badge"
import { Button } from '@/components/ui/button';
import { Checkbox } from "@/components/ui/checkbox"
import { CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandEmpty } from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from '@/components/ui/kbd';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton";
import { useAnkiHealth } from '@/contexts/AnkiHealthContext';
import { useAutoSync } from '@/contexts/AutoSyncContext';
import { useExtension } from '@/contexts/ExtensionContext';
import { useKanjiStates, KanjiQueryEnabled, SubscriptionCheck } from '@/hooks/useKanjiStates'
import { cn } from '@/lib/utils';
import { makeDefinitionKey, parseDefinitionKey, type DefinitionKey, makeAudioSelectionKey, type AudioSelectionKey } from './definitionKey';
import type { LookupTermResponse, FrequencyDataList, TermEntry, PitchAccentEntryList } from '@/types/backend-types';
import { EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_SYNC_CARDS, EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_SYNC_CARDS_RESPONSE, EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_OPEN_NOTE, EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_OPEN_NOTE_RESPONSE } from '@/types/events'
import { getBackendApiUrl } from '@/utils/api';
import { playAudioFromUrl, extractAudioUrlWithoutParams } from '@/utils/audioUtils';
import { createCardInDatabaseWithClient, validateCardCreationResult } from '@/utils/cardCreation';
import { createDatabaseClient } from '@/utils/supabase/database';
import { groupByTerm } from '@/utils/dictionary';
import { shouldShowExtensionToasts } from '@/utils/extensionPathUtils';
import { CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK, CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK_RESPONSE } from '@jreader/shared-types-ts/extensionAvailability';

// Re-render tracking
import { useRenderTracker } from '@/utils/renderTracker';
import { createClient } from '@/utils/supabase/client'
import { containsKanji } from '@/utils/text';

type SearchStackEntry = {
  query: string;
  firstTerm?: string;
  results?: SearchPaneProps['searchResult'];
  position?: number;
  checkedState?: Record<string, number | false>;
  isBaseSearch?: boolean;
};

type PreparedCardData = {
  term: string;
  reading?: string;
  definitions: Array<{ type: string; content: string; dictionary_title?: string; dictionary_origin?: string }>;
  frequencyPairs: Array<[string, string | number]>;
  pitchAccent: string;
  expressionAudio?: string | null;
};

type PrepareDataFn = () => Promise<PreparedCardData>;

interface AudioSource {
  name: string;
  url: string;
}

interface AudioResponse {
  type: string;
  audioSources: AudioSource[];
}

interface SearchPaneProps {
  searchQuery: string;
  searchResult: LookupTermResponse | null;
  isLoading: boolean;
  onSearch: (text: string, position: number, source: 'textpane' | 'searchpane') => void;
  onBack: () => void;
  stackPosition: string;
  searchStack: SearchStackEntry[];
  setSearchStack: (stack: SearchStackEntry[] | ((prev: SearchStackEntry[]) => SearchStackEntry[])) => void;
  isStandalone?: boolean;
  isAuthenticated?: boolean;
  clickedPosition?: number;
  userPreferences?: UserPreferences | null;
  bookTitle?: string;
  prepareDataRef?: React.MutableRefObject<PrepareDataFn | null>;
}

// Helper function to get frequency info for a term+reading combination
function getFrequencyInfo(
  term: string,
  reading: string | undefined,
  frequencyData: any
): { frequency: number; dictionaryName: string } | null {
  if (!frequencyData?.c) return null;

  // frequencyData.c is an array of [dictionaryName, [[term, reading, frequency], ...]]
  for (const [dictName, entries] of frequencyData.c) {
    if (!entries?.[0]) continue;

    for (const entry of entries[0]) {
      if (!entry || entry.length < 3) continue;
      const [entryTerm, entryReading, frequency] = entry;

      if (entryTerm === term && (!reading || entryReading === reading)) {
        return {
          frequency,
          dictionaryName: dictName.split('#')[0] // Remove the revision part
        };
      }
    }
  }

  return null;
}

interface FrequencyDictData {
  itemsList: Array<{
    term: string;
    reading?: string;
    value?: number;
    displayValue?: string;
  }>;
}

function getAllFrequencyInfo(
  term: string,
  reading: string | undefined,
  searchResult: LookupTermResponse | null,
  freqDictionaryOrder: string[] = []
): Array<{ frequency: string | number; dictionaryName: string; isTermOnly: boolean }> {
  if (!searchResult?.frequencyDataLists) return [];
  // console.log('Frequency data lists:', searchResult.frequencyDataLists);

  const results: Array<{ frequency: string | number; dictionaryName: string; fullDictName: string; isTermOnly: boolean }> = [];

  Object.entries(searchResult.frequencyDataLists).forEach(([dictName, data]) => {
    // First try to find reading-specific data
    let match = (data as FrequencyDataList).items.find(item =>
      item.term === term && item.reading === reading
    );

    // If no reading-specific data found, fall back to term-only data
    if (!match && reading) {
      match = (data as FrequencyDataList).items.find(item =>
        item.term === term && !item.reading
      );
    }

    // If no reading specified, just match any item for this term
    if (!reading) {
      match = (data as FrequencyDataList).items.find(item =>
        item.term === term
      );
    }

    if (match) {
      const displayValue = match.displayValue?.trim();
      const value = match.value;

      if (!value && !displayValue) return;

      results.push({
        frequency: displayValue || value!,
        dictionaryName: dictName.split('#')[0], // Short name for display
        fullDictName: dictName, // Full name for sorting
        isTermOnly: !match.reading // Track if this is term-only data
      });
    }
  });

  // Sort based on frequency dictionary order
  return results
    .sort((a, b) => {
      const aIndex = freqDictionaryOrder.indexOf(a.fullDictName);
      const bIndex = freqDictionaryOrder.indexOf(b.fullDictName);

      // If dictionary is not in order list, put it at the end
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;

      return aIndex - bIndex;
    })
    .map(({ frequency, dictionaryName, isTermOnly }) => ({ frequency, dictionaryName, isTermOnly }));
}

// Helper to create stable anchor ids for term+reading blocks
function makeAnchorId(term: string, reading?: string) {
  const encode = (s: string) => encodeURIComponent(s).replace(/%/g, '-');
  return `sp-anchor-${encode(term)}-${encode(reading || '')}`;
}

// Helper to get the selected audio source from a list of sources
// Returns the selected source or the first one if none is selected
// Returns null if audioSources array is empty
function getSelectedAudioSource(
  audioSources: AudioSource[],
  selectedAudioByLayer: Record<number, Record<AudioSelectionKey, number>>,
  termGroupIndex: number,
  layerIndex: number
): AudioSource | null {
  if (!audioSources || audioSources.length === 0) {
    return null;
  }
  const audioSelectionKeyStr = makeAudioSelectionKey({
    termGroupIndex,
    layerIndex
  });
  const layerAudio = selectedAudioByLayer[layerIndex] || {};
  const selectedSourceIndex = layerAudio[audioSelectionKeyStr] ?? 0;
  return audioSources[selectedSourceIndex] || audioSources[0];
}

interface UserPreferences {
  dictionaryOrder: string[];
  disabledDictionaries: string[];
  spoilerDictionaries: string[];
  freqDictionaryOrder: string[];
  shouldHighlightKanjiInSearch?: boolean;
}

function SpoilerContent({
  children,
  title,
  isRevealed,
  onToggleReveal
}: {
  children: React.ReactNode;
  title: string;
  isRevealed: boolean;
  onToggleReveal: (revealed: boolean) => void;
}) {
  return isRevealed ? (
    <div className="relative">
      {children}
      <button
        onClick={() => onToggleReveal(false)}
        className="absolute top-2 right-20 text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80"
      >
        Hide
      </button>
    </div>
  ) : (
    <div>
      <h3 className="text-md font-semibold text-foreground mb-2 mt-2">
        {title}
      </h3>
      <button
        onClick={() => onToggleReveal(true)}
        className="w-full p-4 text-left border border-border rounded-lg hover:bg-muted/50"
      >
        Click to reveal definition
      </button>
    </div>
  );
}

// Export with React.memo to prevent unnecessary re-renders
export default React.memo(SearchPane, (prevProps, nextProps) => {
  // Custom comparison function to determine if re-render is needed
  const searchStackFirstTermsPrev = prevProps.searchStack.map(e => e.firstTerm || '');
  const searchStackFirstTermsNext = nextProps.searchStack.map(e => e.firstTerm || '');
  const searchStackFirstTermsChanged = JSON.stringify(searchStackFirstTermsPrev) !== JSON.stringify(searchStackFirstTermsNext);

  const propsChanged =
    prevProps.searchQuery !== nextProps.searchQuery ||
    prevProps.isLoading !== nextProps.isLoading ||
    prevProps.stackPosition !== nextProps.stackPosition ||
    prevProps.searchStack.length !== nextProps.searchStack.length ||
    searchStackFirstTermsChanged ||
    prevProps.isStandalone !== nextProps.isStandalone ||
    prevProps.isAuthenticated !== nextProps.isAuthenticated ||
    prevProps.clickedPosition !== nextProps.clickedPosition ||
    JSON.stringify(prevProps.userPreferences) !== JSON.stringify(nextProps.userPreferences);

  // For searchResult, use deep comparison
  const searchResultChanged =
    prevProps.searchResult?.dictionaryResults?.length !== nextProps.searchResult?.dictionaryResults?.length ||
    JSON.stringify(prevProps.searchResult?.pitchAccentResults) !== JSON.stringify(nextProps.searchResult?.pitchAccentResults) ||
    JSON.stringify(prevProps.searchResult?.frequencyDataLists) !== JSON.stringify(nextProps.searchResult?.frequencyDataLists);

  return !propsChanged && !searchResultChanged;
});

function SearchPane({
  searchQuery,
  searchResult,
  isLoading,
  onSearch,
  onBack,
  stackPosition,
  searchStack,
  setSearchStack,
  isStandalone = false,
  isAuthenticated = true,
  clickedPosition: propClickedPosition,
  userPreferences: propUserPreferences,
  bookTitle,
  prepareDataRef
}: SearchPaneProps) {

  // Track re-renders
  const { track } = useRenderTracker({
    componentName: 'SearchPane',
    enabled: process.env.NODE_ENV === 'development',
    logProps: false,
    trackDependencies: true
  });

  // Create a stable hash of the search result to prevent unnecessary re-renders
  const searchResultHash = useMemo(() => {
    if (!searchResult) return null;
    return JSON.stringify({
      dictLength: searchResult.dictionaryResults?.length || 0,
      pitchLength: Object.keys(searchResult.pitchAccentResults || {}).length,
      freqLength: Object.keys(searchResult.frequencyDataLists || {}).length,
      contentHash: searchResult.dictionaryResults?.map(r => r.entries?.length).join(',') || ''
    });
  }, [searchResult]);

  // Batch state updates to prevent paired renders
  const renderCount = useMemo(() => {
    return track({
      searchQuery,
      searchResult: searchResult ? {
        hasResults: !!searchResult.dictionaryResults,
        resultCount: searchResult.dictionaryResults?.length || 0,
        hasPitchAccent: !!searchResult.pitchAccentResults,
        hasFrequency: !!searchResult.frequencyDataLists,
        hash: searchResultHash
      } : null,
      isLoading,
      stackPosition,
      searchStackLength: searchStack.length,
      isStandalone,
      isAuthenticated,
      clickedPosition: propClickedPosition,
      userPreferences: propUserPreferences ? {
        hasPreferences: true,
        dictionaryOrderLength: propUserPreferences.dictionaryOrder?.length || 0,
        disabledDictionariesLength: propUserPreferences.disabledDictionaries?.length || 0,
        spoilerDictionariesLength: propUserPreferences.spoilerDictionaries?.length || 0,
        freqDictionaryOrderLength: propUserPreferences.freqDictionaryOrder?.length || 0,
        shouldHighlightKanjiInSearch: propUserPreferences.shouldHighlightKanjiInSearch
      } : null
    }, [
      searchQuery,
      searchResultHash,
      isLoading,
      stackPosition,
      searchStack.length,
      isStandalone,
      isAuthenticated,
      propClickedPosition,
      propUserPreferences
    ]);
  }, [
    searchQuery,
    searchResultHash,
    isLoading,
    stackPosition,
    searchStack.length,
    isStandalone,
    isAuthenticated,
    propClickedPosition,
    propUserPreferences
  ]);


  // Only use kanji states if user is authenticated
  const { markKanjiAsEncountered, knownKanji, encounteredKanji, cycleKanjiState } = useKanjiStates(
    isAuthenticated ? KanjiQueryEnabled.ENABLED : KanjiQueryEnabled.DISABLED,
    SubscriptionCheck.DONT_CHECK
  );

  // Create a single Supabase client instance with error handling
  const [supabase, setSupabase] = useState(() => {
    try {
      return createClient();
    } catch (error) {
      console.error('Failed to create Supabase client:', error);
      return null;
    }
  });

  // Audio state
  const [audioData, setAudioData] = useState<Record<string, AudioResponse>>({});
  const [audioLoading, setAudioLoading] = useState<Record<string, boolean>>({});
  const [audioError, setAudioError] = useState<Record<string, string>>({});

  // Mined cards state
  const [minedCards, setMinedCards] = useState<Record<string, { id: string; anki_note_id: string | null }>>({});
  const [isCheckingMinedCards, setIsCheckingMinedCards] = useState(false);

  // Dictionary selection state per layer (search stack index)
  // For each layer: definitionKey -> false (unchecked) or number (selection order)
  const [checkedByLayer, setCheckedByLayer] = useState<Record<number, Record<DefinitionKey, number | false>>>({});
  const [showOnlyCheckedByLayer, setShowOnlyCheckedByLayer] = useState<Record<number, boolean>>({});

  // Audio source selection state per layer
  // For each layer: audioSelectionKey -> index of selected audio source
  const [selectedAudioByLayer, setSelectedAudioByLayer] = useState<Record<number, Record<AudioSelectionKey, number>>>({});

  // Spoiler reveal state
  // Maps definitionKey (which includes termGroupIndex/slideIndex/layerIndex) to whether it's revealed
  // Flattened structure since key now includes all necessary info
  const [spoilerRevealed, setSpoilerRevealed] = useState<Record<DefinitionKey, boolean>>({});
  const [commandJumpOpen, setCommandJumpOpen] = useState(false);
  const [commandActionsOpen, setCommandActionsOpen] = useState(false);

  // Local state for the input field (separate from the parent's searchQuery prop)
  const [inputValue, setInputValue] = useState(searchQuery);

  // Auto-sync state from context
  const { autoSyncEnabled, setAutoSyncEnabled } = useAutoSync();
  const { checkAnkiHealth } = useAnkiHealth();

  // Extension status from context
  const { extensionStatus } = useExtension();

  // Current visible layer index (0-based) derived from stackPosition like "2/3"
  const currentLayerIndex = useMemo(() => {
    const [currStr] = stackPosition.split('/');
    const curr = Number(currStr);
    return isNaN(curr) ? Math.max(0, searchStack.length - 1) : Math.max(0, curr - 1);
  }, [stackPosition, searchStack.length]);

  // Toggle commands: Cmd/Ctrl-J for Jump, Cmd/Ctrl-K for Actions
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'j')) {
        e.preventDefault();
        setCommandJumpOpen(prev => !prev);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setCommandActionsOpen(prev => !prev);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Function to ensure Supabase client is available
  const ensureSupabaseClient = useCallback(async () => {
    if (supabase) {
      return supabase;
    }

    try {
      console.log('🔄 Recreating Supabase client...');
      const newClient = createClient();
      setSupabase(newClient);
      return newClient;
    } catch (error) {
      console.error('Failed to recreate Supabase client:', error);
      throw new Error('Supabase client not available');
    }
  }, [supabase]);

  // Function to handle dictionary checkbox changes for a given layer index
  const handleDictionaryCheck = useCallback((layerIndex: number, defKey: DefinitionKey, checked: boolean) => {
    console.log('DEBUG_MINING 🔧 handleDictionaryCheck called:', { layerIndex, defKey, checked });
    setCheckedByLayer(prev => {
      const layerState = { ...(prev[layerIndex] || {}) } as Record<DefinitionKey, number | false>;
      const clearedKeys: string[] = [];

      if (checked) {
        // Extract the termGroupIndex from the defKey being checked
        const { termGroupIndex: checkedTermGroupIndex } = parseDefinitionKey(defKey);

        // Clear all checkboxes for OTHER term groups
        Object.keys(layerState).forEach(key => {
          const { termGroupIndex } = parseDefinitionKey(key as DefinitionKey);
          if (termGroupIndex !== checkedTermGroupIndex && typeof layerState[key as DefinitionKey] === 'number') {
            clearedKeys.push(key);
            layerState[key as DefinitionKey] = false;
          }
        });

        if (clearedKeys.length > 0) {
          console.log('DEBUG_MINING 🔧 Cleared checkboxes from other termGroups:', clearedKeys);
        }

        // Find the max order number across checked dictionaries IN THIS TERM GROUP ONLY
        const termGroupEntries = Object.entries(layerState)
          .filter(([key, v]) => {
            if (typeof v !== 'number') return false;
            const { termGroupIndex } = parseDefinitionKey(key as DefinitionKey);
            return termGroupIndex === checkedTermGroupIndex;
          }) as [DefinitionKey, number][];
        const maxOrder = Math.max(0, ...termGroupEntries.map(([_, v]) => v));

        // Set the new checked state
        const nextLayerState = { ...layerState, [defKey]: maxOrder + 1 } as Record<DefinitionKey, number | false>;
        console.log('DEBUG_MINING 🔧 Checked:', defKey);
        return { ...prev, [layerIndex]: nextLayerState };
      } else {
        // When unchecking, just set this dictionary to false
        const nextLayerState = { ...layerState, [defKey]: false } as Record<DefinitionKey, number | false>;
        console.log('DEBUG_MINING 🔧 Unchecked:', defKey);
        return { ...prev, [layerIndex]: nextLayerState };
      }
    });
  }, []);


  // Function to handle opening mined card in Anki
  const handleOpenInAnki = useCallback((ankiNoteId: string) => {
    let extensionResponded = false;

    // Listen for response from extension
    const handleExtensionResponse = (event: MessageEvent) => {
      if (event.data?.type === EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_OPEN_NOTE_RESPONSE) {
        extensionResponded = true;
        window.removeEventListener('message', handleExtensionResponse);

        if (event.data.success) {
          toast.success('Card opened in Anki!');
        } else {
          toast.error('Failed to open card in Anki', {
            description: event.data.error || 'Unknown error occurred'
          });
        }
      }
    };

    // Add listener for extension response
    window.addEventListener('message', handleExtensionResponse);

    // Send message to extension
    const message = {
      type: EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_OPEN_NOTE,
      noteId: ankiNoteId
    };

    window.postMessage(message, window.location.origin);

    // Show immediate feedback
    toast.info('Opening card in Anki...');

    // Set a timeout to show fallback if extension doesn't respond
    setTimeout(() => {
      window.removeEventListener('message', handleExtensionResponse);

      if (!extensionResponded) {
        // Extension didn't respond - show fallback
        toast.info('To open this card in Anki, install the JReader extension', {
          description: 'The extension allows you to open mined cards directly in Anki.',
          action: {
            label: 'Install Extension',
            onClick: () => {
              // For now, show a placeholder link
              window.open('https://chrome.google.com/webstore/detail/jreader-extension/placeholder', '_blank');
            }
          }
        });
      }
    }, 1000);
  }, []);

  // Create a stable hash of search results to prevent infinite loops for mined cards check
  const minedCardsSearchHash = useMemo(() => {
    if (!searchResult?.dictionaryResults) return null;

    // Create a simple hash based on the terms and readings
    const terms = searchResult.dictionaryResults.flatMap(result =>
      result.entries.map(entry => `${entry.text}|${entry.reading || ''}`)
    ).sort().join('|');

    return terms;
  }, [searchResult]);

  // Set loading state when search results change
  useEffect(() => {
    if (searchResult?.dictionaryResults && isAuthenticated) {
      // Use extension status from context
      const extensionAvailable = extensionStatus.available === true;
      console.log(`🔍 Extension availability from context, extensionAvailable=${JSON.stringify(extensionAvailable)}`);

      if (!extensionAvailable) {
        // Extension not available, stop checking and show appropriate icons
        console.log('🚫 Extension not available, stopping mined cards check');
        setIsCheckingMinedCards(false);
      } else {
        console.log('✅ Extension available, continuing with mined cards check');
        setIsCheckingMinedCards(true);
      }
    }
  }, [searchResult, isAuthenticated, extensionStatus.available]);

  // Effect to check for mined cards when search results change
  useEffect(() => {
    // Debounce the check to prevent excessive API calls
    const timeoutId = setTimeout(async () => {
      if (!searchResult?.dictionaryResults || !isAuthenticated || !minedCardsSearchHash) {
        console.log('Skipping mined cards check:', { hasResults: !!searchResult?.dictionaryResults, isAuthenticated, hasHash: !!minedCardsSearchHash });
        setIsCheckingMinedCards(false);
        return;
      }

      setIsCheckingMinedCards(true);

        const newMinedCards: Record<string, { id: string; anki_note_id: string | null }> = {};

        // First, collect all unique terms
        const uniqueTerms = new Set<string>();
        for (const result of searchResult.dictionaryResults) {
          if (result.entries && result.entries.length > 0) {
            for (const entry of result.entries) {
              const term = entry.text;
              if (term) {
                uniqueTerms.add(term);
              }
            }
          }
        }

        // Check each unique term once
        for (const term of uniqueTerms) {
          try {
            // Debug: Check if user is authenticated
            if (!supabase) {
              console.log('Supabase client not available, skipping mined card check');
              continue;
            }
            const { data: { user } } = await supabase.auth.getUser();
            console.log('Checking if term is mined:', { term, userId: user?.id, isAuthenticated: !!user });

            if (!user) {
              console.log('User not authenticated, skipping mined card check');
              continue;
            }

            const { data, error } = await supabase!
              .from('cards')
              .select('id, anki_note_id, user_id')
              .eq('expression', term)
              .maybeSingle();

            if (error) {
              console.error('Error checking if term is mined:', { term, error, errorCode: error.code, errorMessage: error.message });
              continue;
            }

            console.log('Term check result:', { term, data });

            if (data) {
              // Mark all reading combinations for this term as mined
              for (const result of searchResult.dictionaryResults) {
                if (result.entries && result.entries.length > 0) {
                  for (const entry of result.entries) {
                    if (entry.text === term) {
                      const reading = entry.reading || '';
                      const cardKey = `${term}|${reading}`;

                      newMinedCards[cardKey] = {
                        id: data.id,
                        anki_note_id: data.anki_note_id
                      };
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error checking if term is mined:', error);
          }
        }

      setMinedCards(newMinedCards);
      console.log('📊 Mined cards check completed:', {
        totalCards: Object.keys(newMinedCards).length,
        cards: newMinedCards
      });
      setIsCheckingMinedCards(false);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [minedCardsSearchHash, isAuthenticated]);

  // Function to fetch audio for a term+reading combination
  const fetchAudio = useCallback(async (term: string, reading?: string) => {
    console.log('🎵 fetchAudio called with:', { term, reading });
    const key = `${term}|${reading || ''}`;
    console.log('🎵 Audio key:', key);

    if (audioData[key] || audioLoading[key]) {
      console.log('🎵 Audio already loaded or loading for key:', key);
      return; // Already loaded or loading
    }

    console.log('🎵 Starting audio fetch for:', key);
    setAudioLoading(prev => ({ ...prev, [key]: true }));
    setAudioError(prev => ({ ...prev, [key]: '' }));

    try {
      const params = new URLSearchParams({ term });
      if (reading) {
        params.append('reading', reading);
      }

      const apiUrl = getBackendApiUrl();
      const fullUrl = `${apiUrl}/api/audio?${params.toString()}`;
      console.log('🎵 Making API call to:', fullUrl);

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const response = await fetch(fullUrl, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      console.log('🎵 API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('🎵 Audio API error response:', errorText);

        // Try to parse as JSON for structured error messages
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }

        // Handle 403 errors (though audio should now be available for all users)
        if (response.status === 403) {
          const errorMessage = errorData.error || 'Access denied';
          setAudioError(prev => ({ ...prev, [key]: errorMessage }));
          return;
        }

        throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
      }

      const data: AudioResponse = await response.json();
      console.log('🎵 Audio data received:', data);
      setAudioData(prev => ({ ...prev, [key]: data }));
    } catch (error) {
      console.error('🎵 Failed to fetch audio:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setAudioError(prev => ({ ...prev, [key]: errorMessage }));

      // Show toast for audio loading errors
      toast.error('Failed to load audio', {
        description: errorMessage
      });
    } finally {
      setAudioLoading(prev => ({ ...prev, [key]: false }));
    }
  }, [supabase?.auth, audioData, audioLoading]);

  // Use default preferences if propUserPreferences is not loaded yet
  const effectivePreferences = useMemo(() => propUserPreferences || {
    dictionaryOrder: [],
    disabledDictionaries: [],
    spoilerDictionaries: [],
    freqDictionaryOrder: [],
    shouldHighlightKanjiInSearch: true
  }, [propUserPreferences]);

  // Track the previous search query AND position to detect when a new base search occurs
  const prevSearchRef = React.useRef<{ query: string; position: number }>({ query: searchQuery, position: propClickedPosition ?? -1 });

  // Memoize the searchResult to prevent unnecessary rerenders
  const memoizedSearchResult: LookupTermResponse | null = useMemo(() => {
    return searchResult;
  }, [
    // Use a more stable comparison that only changes when the actual content changes
    searchResult ? JSON.stringify({
      dictLength: searchResult.dictionaryResults?.length,
      pitchKeys: Object.keys(searchResult.pitchAccentResults || {}),
      freqKeys: Object.keys(searchResult.frequencyDataLists || {}),
      // Add a hash of the actual content to prevent re-renders when same data comes back
      contentHash: searchResult.dictionaryResults?.map(r => r.entries?.length).join(',') || ''
    }) : null
  ]);

  // Get the clicked character position from prop or from the most recent stack entry
  const clickedPosition = propClickedPosition ?? searchStack[searchStack.length - 1]?.position ?? -1;

  // Sync input state with parent's searchQuery prop
  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  // Arrow key pagination
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Only handle arrow keys
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      e.preventDefault();

      setLayerSlideIndices(prev => {
        const current = prev[currentLayerIndex] ?? 0;
        const visibleResults = searchStack.length > 0
          ? (searchStack[currentLayerIndex]?.results ?? memoizedSearchResult)
          : memoizedSearchResult;
        const termGroups = visibleResults?.dictionaryResults
          ? groupByTerm(visibleResults.dictionaryResults, effectivePreferences.dictionaryOrder)
          : [];
        const total = termGroups.length;

        if (total <= 1) return prev;

        if (e.key === 'ArrowLeft') {
          return { ...prev, [currentLayerIndex]: (current - 1 + total) % total };
        } else {
          return { ...prev, [currentLayerIndex]: (current + 1) % total };
        }
      });
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentLayerIndex, searchStack, memoizedSearchResult, effectivePreferences.dictionaryOrder]);

  // Simplified behavior: whenever this component renders new inputs (stack/results),
  // reset all checkboxes for all visible layers to unchecked
  useEffect(() => {
    console.log('DEBUG_MINING 🔄 Checkbox init effect triggered');
    const resetByLayer: Record<number, Record<DefinitionKey, number | false>> = {};
    searchStack.forEach((entry, i) => {
      const layerResults = entry.results ?? (i === searchStack.length - 1 ? memoizedSearchResult : null);
      if (!layerResults?.dictionaryResults) return;
      const init: Record<DefinitionKey, number | false> = {};

      // Get term groups for this layer to extract term group indices
      const termGroupsForLayer = groupByTerm(layerResults.dictionaryResults, effectivePreferences.dictionaryOrder);

      // Initialize checkboxes for each term group and dictionary combination
      termGroupsForLayer.forEach((termGroup, termGroupIdx) => {
        termGroup.dictEntries.forEach(de => {
          const defKey = makeDefinitionKey({
            dictionaryTitle: de.title,
            revision: de.revision,
            termGroupIndex: termGroupIdx,
            layerIndex: i
          });
          init[defKey] = false;
          console.log(`DEBUG_MINING 🔄 Resetting checkbox to false: layer=${i}, termGroupIdx=${termGroupIdx}, defKey=${defKey}, dictTitle=${de.title}`);
        });
      });
      resetByLayer[i] = init;
    });

    console.log('DEBUG_MINING 🔄 About to reset checkedByLayer state');
    console.log('DEBUG_MINING 🔄 Previous checkedByLayer:', checkedByLayer);
    console.log('DEBUG_MINING 🔄 New resetByLayer:', resetByLayer);

    setCheckedByLayer(resetByLayer);
    // Also reset the "show selected only" toggle(s)
    setShowOnlyCheckedByLayer({});
    // Also reset audio selection when new results are loaded
    setSelectedAudioByLayer({});
    // Reset all pagination to 0 when rendering new results
    setLayerSlideIndices({});
    // Reset spoiler states when new results are loaded
    setSpoilerRevealed({});
  }, [searchStack, memoizedSearchResult, effectivePreferences.dictionaryOrder]);

  // Memoize termGroups to prevent unnecessary recalculations
  const termGroups = useMemo(() => {
    if (!memoizedSearchResult?.dictionaryResults) return [];
    return groupByTerm(memoizedSearchResult.dictionaryResults, effectivePreferences.dictionaryOrder);
  }, [memoizedSearchResult?.dictionaryResults, effectivePreferences.dictionaryOrder]);

  // Memoize pitch accent data to prevent unnecessary recalculations
  const pitchAccentData = useMemo(() => {
    if (!memoizedSearchResult?.pitchAccentResults) return {};

    const data: Record<string, PitchAccentEntryList> = {};
    Object.entries(memoizedSearchResult.pitchAccentResults).forEach(([term, result]) => {
      Object.entries(result.entries).forEach(([reading, entryList]) => {
        data[reading] = entryList;
      });
    });
    return data;
  }, [memoizedSearchResult?.pitchAccentResults]);
  // Expose a prepare function for parent to collect current selection as card data
  useEffect(() => {
    if (!prepareDataRef) return;
    prepareDataRef.current = async () => {
      const results: LookupTermResponse | null = searchStack.length > 0
        ? (searchStack[searchStack.length - 1].results ?? null)
        : memoizedSearchResult;

      // Use the latest layer for data preparation (matches how results are chosen above)
      const currentLayerIndex = Math.max(0, searchStack.length - 1);
      const layerChecked = checkedByLayer[currentLayerIndex] || {};

      console.log('DEBUG_MINING 🐛 PrepareData Debug:', {
        currentLayerIndex,
        checkedByLayer,
        layerChecked,
        searchStackLength: searchStack.length
      });

      if (!results?.dictionaryResults || results.dictionaryResults.length === 0) {
        return {
          term: searchQuery,
          reading: undefined,
          definitions: [],
          frequencyPairs: [],
          pitchAccent: '',
          expressionAudio: null,
        };
      }

      // Use the first term group like the create-card path
      const currentTermGroups = groupByTerm(results.dictionaryResults, effectivePreferences.dictionaryOrder);
      const termGroup = currentTermGroups[0];
      const term = termGroup.term;
      const reading = termGroup.dictEntries[0]?.entries[0]?.reading;

      // Gather definitions based on checked order
      const definitionsByOrder: Array<{ order: number; definitions: Array<{ type: string; content: string; dictionary_title?: string; dictionary_origin?: string }> }> = [];

      // Find the correct term group index by matching the term being edited
      const editingTerm = term;
      let termGroupIndex = 0;
      for (let idx = 0; idx < currentTermGroups.length; idx++) {
        if (currentTermGroups[idx].term === editingTerm) {
          termGroupIndex = idx;
          break;
        }
      }

      for (const dictEntry of termGroup.dictEntries) {
        // Use the correct term group index for this editing session
        const defKey = makeDefinitionKey({
          dictionaryTitle: dictEntry.title,
          revision: dictEntry.revision,
          termGroupIndex: termGroupIndex,
          layerIndex: currentLayerIndex
        });
        const order = layerChecked[defKey];

        console.log('DEBUG_MINING 🐛 Dict Check:', {
          defKey,
          order,
          termGroupIndex,
          editingTerm,
          layerCheckedKeys: Object.keys(layerChecked),
          layerCheckedValues: Object.values(layerChecked)
        });

        if (typeof order === 'number') {
          const dictDefinitions: Array<{ type: string; content: string; dictionary_title?: string; dictionary_origin?: string }> = [];
          for (const entry of dictEntry.entries) {
            for (const definition of entry.definitions) {
              if (definition.type === 'simple') {
                dictDefinitions.push({ type: 'simple', content: definition.content, dictionary_title: dictEntry.title, dictionary_origin: dictEntry.origin });
              } else if (definition.type === 'structured') {
                dictDefinitions.push({ type: 'structured', content: definition.content, dictionary_title: dictEntry.title, dictionary_origin: dictEntry.origin });
              } else if (definition.type === 'deinflection') {
                dictDefinitions.push({ type: 'simple', content: `Base form: ${definition.baseForm}`, dictionary_title: dictEntry.title, dictionary_origin: dictEntry.origin });
              }
            }
          }
          definitionsByOrder.push({ order, definitions: dictDefinitions });
        }
      }
      definitionsByOrder.sort((a, b) => a.order - b.order);
      const definitions = definitionsByOrder.flatMap(d => d.definitions);

      // Frequency pairs
      const freqInfo = getAllFrequencyInfo(term, reading, results, effectivePreferences.freqDictionaryOrder);
      const frequencyPairs = freqInfo.map(info => [info.dictionaryName, info.frequency] as [string, string | number]);

      // Pitch accent string
      const pa = pitchAccentData[reading || ''];
      let pitchAccent = '';
      if (pa && pa.entries && pa.entries.length > 0) {
        const positions = pa.entries.map(entry => entry.position);
        pitchAccent = positions.join(', ');
      }

      // Audio - reuse loaded audio if available
      const audioKey = `${term}|${reading || ''}`;
      let expressionAudio: string | null = null;
      if (audioData[audioKey]?.audioSources?.length > 0) {
        const selectedAudioSource = getSelectedAudioSource(
          audioData[audioKey].audioSources,
          selectedAudioByLayer,
          0,
          currentLayerIndex
        );
        if (selectedAudioSource) {
          const mediaPath = selectedAudioSource.url.replace('/audio/', '/media/');
          expressionAudio = extractAudioUrlWithoutParams(mediaPath);
        }
      } else {
        // Attempt direct fetch like in create path
        try {
          const params = new URLSearchParams({ term });
          if (reading) params.append('reading', reading);
          const apiUrl = getBackendApiUrl();
          const fullUrl = `${apiUrl}/api/audio?${params.toString()}`;
          const supabaseClient = await ensureSupabaseClient();
          const response = await fetch(fullUrl, {
            headers: { 'Authorization': `Bearer ${(await supabaseClient.auth.getSession()).data.session?.access_token}` }
          });
          if (response.ok) {
            const audioResponse: AudioResponse = await response.json();
            if (audioResponse.audioSources?.length > 0) {
              const selectedAudioSource = getSelectedAudioSource(
                audioResponse.audioSources,
                selectedAudioByLayer,
                0,
                currentLayerIndex
              );
              if (selectedAudioSource) {
                const mediaPath = selectedAudioSource.url.replace('/audio/', '/media/');
                expressionAudio = extractAudioUrlWithoutParams(mediaPath);
              }
            }
          }
        } catch {}
      }

      return { term, reading, definitions, frequencyPairs, pitchAccent, expressionAudio };
    };
  }, [prepareDataRef, searchStack, memoizedSearchResult, effectivePreferences.dictionaryOrder, effectivePreferences.freqDictionaryOrder, checkedByLayer, pitchAccentData, audioData, selectedAudioByLayer, ensureSupabaseClient, searchQuery]);

  useEffect(() => {
    console.log('🔄 Effect running with:', {
      isLoading,
      hasResults: !!memoizedSearchResult,
      stackLength: searchStack.length,
      termGroups: termGroups.map(g => g.term)
    });

    if (!isLoading && memoizedSearchResult && searchStack.length > 0) {
      const lastEntry = searchStack[searchStack.length - 1];
      const firstTerm = termGroups[0]?.term;

      // Only update if the results are actually different
      const currentResults = lastEntry.results;
      console.log('🔄 Checking results changed:', {
        hasCurrentResults: !!currentResults,
        currentResultsLength: currentResults?.dictionaryResults?.length,
        newResultsLength: memoizedSearchResult.dictionaryResults?.length,
        firstTerm
      });

      // Consider it changed if the clicked position changed or if the results are different
      const resultsChanged = !currentResults ||
        currentResults.dictionaryResults?.length !== memoizedSearchResult.dictionaryResults?.length ||
        JSON.stringify(currentResults.pitchAccentResults) !== JSON.stringify(memoizedSearchResult.pitchAccentResults) ||
        lastEntry.position !== clickedPosition;

      // If we never set firstTerm on the last entry, do it now even if results are unchanged
      const needsFirstTerm = !lastEntry.firstTerm && !!firstTerm;

      console.log('🔄 Results changed?', {
        resultsChanged,
        lastEntry,
        firstTerm
      });

      if (resultsChanged || needsFirstTerm) {
        console.log('🔄 Updating searchStack with new results');
        console.log('First term group:', termGroups[0]);
        console.log('Current search stack:', searchStack);

        // Always set firstTerm to the first term in the results
        const newFirstTerm = termGroups[0]?.term;
        if (newFirstTerm) {
          markKanjiAsEncountered(newFirstTerm);
        }

        setSearchStack(prev => {
          const updated = prev.map((entry, i) =>
            i === prev.length - 1 ? {
              ...entry,
              results: memoizedSearchResult,
              firstTerm: newFirstTerm || entry.query
            } : entry
          );
          console.log('Updated search stack:', updated);
          return updated;
        });
      } else {
        console.log('🔄 Skipping searchStack update - results unchanged');
      }
    }
  }, [memoizedSearchResult, isLoading, searchStack.length, markKanjiAsEncountered, setSearchStack, termGroups]);

  // Pagination state: indexed by layer (stack index)
  const [layerSlideIndices, setLayerSlideIndices] = React.useState<Record<number, number>>({});

  // Helper function to update pagination in both local state and stack
  const updateLayerSlideIndex = useCallback((layerIndex: number, slideIndex: number) => {
    setLayerSlideIndices(prev => ({ ...prev, [layerIndex]: slideIndex }));
    // Also update the stack entry to persist this pagination state
    setSearchStack(prev => {
      const updated = [...prev];
      if (updated[layerIndex]) {
        updated[layerIndex] = { ...updated[layerIndex], slideIndex };
      }
      return updated;
    });
  }, []);

  // Track previous stack to detect when new searches are added (not breadcrumb navigation)
  const prevStackLengthRef = React.useRef<number>(searchStack.length);
  const prevLastEntryIdRef = React.useRef<string>('');

  // Reset pagination and spoilers based on whether this is a new base search or recursive search
  useEffect(() => {
    const lastEntry = searchStack[searchStack.length - 1];
    const stackGrew = searchStack.length > prevStackLengthRef.current;
    const stackShrunk = searchStack.length < prevStackLengthRef.current;

    // Create a unique ID for the last entry to detect actual changes (not just reference changes)
    const lastEntryId = lastEntry ? `${lastEntry.query}|${lastEntry.position}|${lastEntry.isBaseSearch}` : '';
    const lastEntryChanged = lastEntryId !== prevLastEntryIdRef.current;

    // console.log('[SS] Effect triggered:', {
    //   stackLength: searchStack.length,
    //   lastEntry: lastEntry ? { query: lastEntry.query, isBaseSearch: lastEntry.isBaseSearch, position: lastEntry.position } : null,
    //   isLoading,
    //   hasSearchResult: !!memoizedSearchResult,
    //   prevStackLength: prevStackLengthRef.current,
    //   stackGrew,
    //   stackShrunk,
    //   lastEntryChanged,
    //   lastEntryId
    // });

    if (searchStack.length === 0) {
      // No search active
    } else if (lastEntryChanged && lastEntry?.isBaseSearch === true && stackGrew) {
      // New base search from TextPane - reset everything only when stack grows (not breadcrumb)
      console.log('[SS] New base search, resetting pagination and spoilers');
      setSpoilerRevealed({});
      setSelectedAudioByLayer({});
      setLayerSlideIndices({});
    } else if (lastEntryChanged && lastEntry?.isBaseSearch === true && !stackGrew && !stackShrunk && searchStack.length === 1) {
      // Base search entry replaced on same stack level (same sentence, different word in TextPane)
      // Only reset if stack didn't shrink (shrinking = breadcrumb navigation)
      console.log('[SS] Base search entry replaced, resetting pagination and spoilers');
      setSpoilerRevealed({});
      setSelectedAudioByLayer({});
      setLayerSlideIndices({});
    } else if (!isLoading && memoizedSearchResult && stackGrew && !lastEntry?.isBaseSearch) {
      // New recursive search added to stack - reset only new layer pagination
      console.log('[SS] New recursive search added to stack');
      const newLayerIdx = searchStack.length - 1;
      setLayerSlideIndices(prev => ({ ...prev, [newLayerIdx]: 0 }));
    }

    // Restore pagination from stack entries (for breadcrumb navigation)
    // Build layerSlideIndices from current stack slideIndex values
    const restoredIndices: Record<number, number> = {};
    searchStack.forEach((entry, index) => {
      if (entry.slideIndex !== undefined) {
        restoredIndices[index] = entry.slideIndex;
      }
    });
    if (Object.keys(restoredIndices).length > 0) {
      setLayerSlideIndices(prev => ({ ...prev, ...restoredIndices }));
    }
    prevStackLengthRef.current = searchStack.length;
    prevLastEntryIdRef.current = lastEntryId;
  }, [searchStack, isLoading, memoizedSearchResult?.dictionaryResults?.length]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="bg-muted/80 border-b border-border p-4">
        <div className="flex items-center justify-between mb-3 gap-3">
          <div className="flex-1 min-w-0">
            <Breadcrumb
              searchStack={searchStack}
              stackPosition={stackPosition}
              onBack={onBack}
              onNavigate={(steps?: number) => {
                if (steps !== undefined && searchStack[searchStack.length - steps - 1]) {
                  const targetEntry = searchStack[searchStack.length - steps - 1];
                  setSearchStack(searchStack.slice(0, searchStack.length - steps));
                }
              }}
              isLoading={isLoading}
            />
          </div>
        </div>

        <div className="relative flex items-center gap-2">
          {isStandalone ? (
            <>
            <div className="flex-1 max-w-[calc(100%-8.5rem)] relative rounded-lg border border-border bg-background">
              <div className="w-full px-4 py-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    // Ignore Enter presses during IME composition
                    if (e.isComposing || e.keyCode === 229) return;

                    if (e.key === 'Enter' && inputValue.trim()) {
                      e.preventDefault();
                      onSearch(inputValue.trim(), 0, 'searchpane');
                    }
                  }}
                  placeholder="Search Japanese words..."
                  className="w-full bg-transparent outline-none text-foreground"
                  autoFocus
                />
                {inputValue.trimStart() && (
                  <button
                    onClick={() => {
                      setInputValue('');
                      onSearch('', 0, 'searchpane');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-muted text-muted-foreground hover:bg-muted/80 rounded-md"
                    title="Clear search"
                  >
                    <svg
                      className="w-4 h-4 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <circle cx="12" cy="12" r="10" strokeWidth={2} />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 9l-6 6M9 9l6 6" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <Button
              onClick={() => {
                if (inputValue.trim()) {
                  onSearch(inputValue.trim(), 0, 'searchpane');
                }
              }}
              className="h-7 px-3"
            >
              Search
            </Button>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="sm" className="h-7 px-1.5 min-w-[2.5rem]" onClick={() => setCommandJumpOpen(true)}>
                <Kbd className="bg-transparent px-1">⌘J</Kbd>
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-1.5 min-w-[2.5rem]" onClick={() => setCommandActionsOpen(true)}>
                <Kbd className="bg-transparent px-1">⌘K</Kbd>
              </Button>
            </div>
            </>) : (
            <>
            <div className="flex-1 max-w-[calc(100%-5.5rem)] relative rounded-lg border border-border bg-background">
              <div className="w-full px-4 py-2 overflow-x-auto whitespace-nowrap">
                {(() => {
                  const trimmedText = searchQuery.trimStart();
                  const leadingSpaces = searchQuery.length - trimmedText.length;
                  return [...trimmedText].map((char, i) => (
                    <span
                      key={i}
                      className={i + leadingSpaces === clickedPosition ? 'text-purple-500 dark:text-purple-400' : ''}
                    >
                      {i + leadingSpaces === clickedPosition ? `[${char}]` : char}
                    </span>
                  ));
                })()}
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearch(e.target.value, 0, 'searchpane')}
                placeholder="Search Japanese words..."
                className="absolute inset-0 opacity-0 z-10"
              />
            </div>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="sm" className="h-7 px-1.5 min-w-[2.5rem]" onClick={() => setCommandJumpOpen(true)}>
                <Kbd className="bg-transparent px-1">⌘J</Kbd>
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-1.5 min-w-[2.5rem]" onClick={() => setCommandActionsOpen(true)}>
                <Kbd className="bg-transparent px-1">⌘K</Kbd>
              </Button>
            </div>
            </>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative">
        {/* Jump palette (Cmd/Ctrl-J) */}
        <CommandDialog open={commandJumpOpen} onOpenChange={setCommandJumpOpen}>
          <CommandInput placeholder="Type a command..." readOnly={true} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Jump to term">
              {(() => {
                const visibleResults = searchStack.length > 0 ? (searchStack[currentLayerIndex]?.results ?? memoizedSearchResult) : memoizedSearchResult;
                if (!visibleResults?.dictionaryResults) return null;
                const groups = groupByTerm(visibleResults.dictionaryResults, effectivePreferences.dictionaryOrder);
                return groups.map((g, i) => {
                  const reading = g.dictEntries[0]?.entries[0]?.reading;
                  // Use carousel slide index instead of page scroll
                  return (
                    <CommandItem
                      key={`${g.term}-${reading || ''}-${i}`}
                      value={`jump-${g.term}-${reading || ''}`}
                      onSelect={() => {
                        setCommandJumpOpen(false);
                        updateLayerSlideIndex(currentLayerIndex, i);
                      }}
                    >
                      <div className="leading-tight">
                        <ruby className="text-sm">
                          {g.term}
                          {reading && containsKanji(g.term) && (
                            <rt className="text-xs text-muted-foreground">{reading}</rt>
                          )}
                        </ruby>
                      </div>
                    </CommandItem>
                  );
                });
              })()}
            </CommandGroup>
          </CommandList>
        </CommandDialog>

        {/* Actions palette (Cmd/Ctrl-K) */}
        <CommandDialog open={commandActionsOpen} onOpenChange={setCommandActionsOpen}>
          <CommandInput placeholder="Type a command..." readOnly={true} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Filter">
              <CommandItem
                value="toggle-show-selected"
                onSelect={() => {
                  setShowOnlyCheckedByLayer(prev => ({ ...prev, [currentLayerIndex]: !prev[currentLayerIndex] }));
                  setCommandActionsOpen(false);
                }}
              >
                Toggle show selected only
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Selection">
              <CommandItem
                value="clear-all"
                onSelect={() => {
                  setCheckedByLayer({});
                  setCommandActionsOpen(false);
                }}
              >
                Clear all selections
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
                {searchStack.length === 0 ? (
          // Show explanation when search stack is empty
          <DictionaryExplanation />
        ) : (
          searchStack.map((stackEntry: SearchStackEntry, index: number) => {
          const [current] = stackPosition.split('/').map(Number);

          const results: LookupTermResponse | null = stackEntry.results ?? null;
          const currentTermGroups = results?.dictionaryResults
            ? groupByTerm(results.dictionaryResults, effectivePreferences.dictionaryOrder)
            : [];

          // console.log('Rendering layer:', {
          //   index,
          //   stackPosition,
          //   isCurrentLayer: current === index + 1,
          //   hasResults: !!results?.dictionaryResults,
          //   termGroupsLength: currentTermGroups.length,
          //   stackEntry,
          //   usingStackResults: true,
          //   results: results?.dictionaryResults?.length,
          //   currentTermGroups: currentTermGroups,
          //   visible: current === index + 1
          // });

          // Get current slide index for this layer
          const currentSlideIndex = layerSlideIndices[index] ?? 0;

          // Render ALL slides but only show the current one - this prevents SignedImage components from unmounting/remounting
          const content = (results?.dictionaryResults && searchStack.length > 0 && currentTermGroups.length > 0) ? (
            <div className="space-y-0">
              {currentTermGroups.map((termGroup, slideIndex) => (
                <div
                  key={slideIndex}
                  style={{ display: currentSlideIndex === slideIndex ? 'block' : 'none' }}
                  className="relative">
                    <div className="sticky top-0 bg-muted/80 backdrop-blur-sm z-[30] border-b border-border">
                      <div className="px-4 pt-4">
                        <div className="flex items-baseline gap-3">
                          {effectivePreferences.shouldHighlightKanjiInSearch && containsKanji(termGroup.term) && (() => {
                            // Check if there are any unknown kanji in the term
                            const hasUnknownKanji = [...termGroup.term].some(char =>
                              containsKanji(char) && !knownKanji.includes(char)
                            );

                            return (
                              <button
                                onClick={async () => {
                                  // Only mark unknown/encountered kanji as known
                                  for (const char of termGroup.term) {
                                    if (containsKanji(char) && !knownKanji.includes(char)) {
                                      try {
                                        await cycleKanjiState(char, true); // true = mark as known
                                      } catch (error) {
                                        console.error('Failed to mark kanji as known:', error);
                                      }
                                    }
                                  }
                                }}
                                className={`kanji-mark-known-btn ${
                                  !hasUnknownKanji ? 'disabled' : ''
                                }`}
                                title={hasUnknownKanji ? "Mark all kanji in this term as known" : "All kanji already known"}
                                disabled={!hasUnknownKanji}
                              >
                                <CheckCheck className="w-3 h-3" />
                              </button>
                            );
                          })()}

                          {/* Audio button and dropdown */}
                                            <DropdownMenu>
           <DropdownMenuTrigger asChild>
             <button
               onClick={() => {
                 console.log('🎵 Audio button clicked for:', termGroup.term, termGroup.reading);
                 fetchAudio(termGroup.term, termGroup.reading);
               }}
               className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground focus:outline-none focus:ring-0"
               title="Play audio pronunciation"
               disabled={audioLoading[`${termGroup.term}|${termGroup.reading || ''}`]}
             >
               {audioLoading[`${termGroup.term}|${termGroup.reading || ''}`] ? (
                 <div className="w-4 h-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
               ) : (
                 <Volume2 className="w-4 h-4" />
               )}
             </button>
           </DropdownMenuTrigger>

           {audioData[`${termGroup.term}|${termGroup.reading || ''}`] && (
             <DropdownMenuContent align="start" className="w-64">
               <div className="text-xs text-muted-foreground px-2 py-1.5">Select audio source:</div>
               {audioData[`${termGroup.term}|${termGroup.reading || ''}`].audioSources.map((source, sourceIndex) => {
                 // Extract source name from the URL path (e.g., "/audio/jpod_files/..." -> "jpod")
                 const sourceFromUrl = source.url.split('/')[2]?.replace('_files', '') || 'unknown';

                 // Display format: "source - name" if different, or just "source" if same
                 const displayName = sourceFromUrl === source.name ? sourceFromUrl : `${sourceFromUrl} - ${source.name}`;

                 const audioSelectionKeyStr = makeAudioSelectionKey({
                   termGroupIndex: currentSlideIndex,
                   layerIndex: index
                 });
                 const layerAudio = selectedAudioByLayer[index] || {};
                 // Default to 0 if not explicitly set
                 const selectedIndex = layerAudio[audioSelectionKeyStr] ?? 0;
                 const isSelected = selectedIndex === sourceIndex;

                 return (
                   <div key={sourceIndex} className="flex items-center justify-between px-2 py-2 hover:bg-muted rounded-md cursor-pointer gap-3"
                     onClick={(e) => {
                       e.preventDefault();
                       setSelectedAudioByLayer(prev => ({
                         ...prev,
                         [index]: {
                           ...prev[index] || {},
                           [audioSelectionKeyStr]: sourceIndex
                         }
                       }));
                     }}>
                     <button
                       className="flex-1 text-left text-sm hover:underline min-w-0"
                       onClick={async (e) => {
                         e.stopPropagation();
                         try {
                           console.log('🎵 Playing audio:', source.url);
                           const result = await playAudioFromUrl(source.url, isAuthenticated);

                           if (result.requiresAuth) {
                             toast.info('Please log in to listen to audio');
                           } else if (result.success) {
                             console.log('🎵 Audio started playing successfully');
                           }
                         } catch (error) {
                           console.error('🎵 Audio play failed:', error);
                           toast.error('Failed to play audio', {
                             description: error instanceof Error ? error.message : 'Unknown error'
                           });
                         }
                       }}
                       title="Click to play audio"
                     >
                       <Volume2 className="w-3 h-3 inline mr-2" />
                       {displayName}
                     </button>
                     <Checkbox
                       checked={isSelected}
                       onCheckedChange={(checked) => {
                         if (checked) {
                           setSelectedAudioByLayer(prev => ({
                             ...prev,
                             [index]: {
                               ...prev[index] || {},
                               [audioSelectionKeyStr]: sourceIndex
                             }
                           }));
                         }
                       }}
                     />
                   </div>
                 );
               })}
             </DropdownMenuContent>
           )}
         </DropdownMenu>

                          <h2 id={makeAnchorId(termGroup.term, termGroup.dictEntries[0]?.entries[0]?.reading)} className="text-xl font-bold">
                            <ruby>
                              <DefinitionText
                                text={termGroup.term}
                                knownKanji={effectivePreferences.shouldHighlightKanjiInSearch ? knownKanji : []}
                                encounteredKanji={effectivePreferences.shouldHighlightKanjiInSearch ? encounteredKanji : []}
                                preserveClickHandlers={false}
                              />
                                                                {termGroup.dictEntries[0].entries[0].reading &&
                              containsKanji(termGroup.term) && (
                                <rt className="text-sm text-muted-foreground">
                                  {termGroup.dictEntries[0].entries[0].reading}
                                </rt>
                              )}
                            </ruby>
                          </h2>
                          {(() => {
                            const reading = termGroup.dictEntries[0]?.entries[0]?.reading;
                            const pitchData = pitchAccentData[reading || ''];

                            if (reading && pitchData) {
                              return (
                                <div className="flex items-center gap-3">
                                  <PitchAccentGraphs result={pitchData} />
                                </div>
                              );
                            }
                            return null;
                          })()}

                          {/* Anki card button - shows different icons based on mined/synced status */}
                          {(() => {
                            const term = termGroup.term;
                            const reading = termGroup.dictEntries[0]?.entries[0]?.reading;
                            const cardKey = `${term}|${reading}`;
                            const minedCard = minedCards[cardKey];

                            // Show skeleton while checking for mined cards
                            if (isCheckingMinedCards && !minedCard) {
                              return (
                                <div className="ml-auto">
                                  <Skeleton className="w-4 h-4 rounded" />
                                </div>
                              );
                            }


                            if (minedCard) {
                              // Card is mined - show different icons based on sync status
                              const isSyncedToAnki = minedCard.anki_note_id !== null;

                              return (
                                <button
                                  onClick={() => {
                                    if (isSyncedToAnki) {
                                      // Card is synced to Anki - open it
                                      handleOpenInAnki(String(minedCard.anki_note_id!));
                                    } else {
                                      // Card is mined but not synced to Anki
                                      toast.info('Card is mined but not yet synced to Anki', {
                                        description: 'Use the extension to sync this card to Anki, then you can open it directly.'
                                      });
                                    }
                                  }}
                                  className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground focus:outline-none focus:ring-0 ml-auto"
                                  title={isSyncedToAnki ? "Open in Anki" : "Card mined but not synced to Anki"}
                                >
                                  {isSyncedToAnki ? (
                                    <BookOpenCheck className="w-4 h-4" />
                                  ) : (
                                    <BookOpenText className="w-4 h-4" />
                                  )}
                                </button>
                              );
                            } else {
                              // Show plus icon for unmined cards
                              return (
                                <button
                                  onClick={async () => {
                                    // Check if user is authenticated
                                    if (!isAuthenticated) {
                                      toast.info('Please log in to create cards', {
                                        description: 'You must be logged in to mine vocabulary cards.'
                                      });
                                      return;
                                    }

                                    try {
                                      // Get the term and reading
                                      const term = termGroup.term;
                                      const reading = termGroup.dictEntries[0]?.entries[0]?.reading;

                                      // Get definitions from checked dictionaries, sorted by selection order
                                      const definitionsByOrder: Array<{
                                        order: number;
                                        definitions: Array<{ type: string; content: string; dictionary_title?: string; dictionary_origin?: string }>;
                                      }> = [];

                                      const layerStateForCreate = checkedByLayer[index] || {};
                                      for (const dictEntry of termGroup.dictEntries) {
                                        const defKey = makeDefinitionKey({
                                          dictionaryTitle: dictEntry.title,
                                          revision: dictEntry.revision,
                                          termGroupIndex: currentSlideIndex,
                                          layerIndex: index
                                        });
                                        const order = layerStateForCreate[defKey];

                                        // Only include definitions from checked dictionaries
                                        if (typeof order === 'number') {
                                          const dictDefinitions: Array<{ type: string; content: string; dictionary_title?: string; dictionary_origin?: string }> = [];

                                          for (const entry of dictEntry.entries) {
                                            for (const definition of entry.definitions) {
                                              // Preserve the definition structure and type, and include both dictionary title and origin
                                              if (definition.type === 'simple') {
                                                dictDefinitions.push({
                                                  type: 'simple',
                                                  content: definition.content,
                                                  dictionary_title: dictEntry.title,
                                                  dictionary_origin: dictEntry.origin
                                                });
                                              } else if (definition.type === 'structured') {
                                                dictDefinitions.push({
                                                  type: 'structured',
                                                  content: definition.content,
                                                  dictionary_title: dictEntry.title,
                                                  dictionary_origin: dictEntry.origin
                                                });
                                              } else if (definition.type === 'deinflection') {
                                                dictDefinitions.push({
                                                  type: 'simple',
                                                  content: `Base form: ${definition.baseForm}`,
                                                  dictionary_title: dictEntry.title,
                                                  dictionary_origin: dictEntry.origin
                                                });
                                              }
                                            }
                                          }

                                          definitionsByOrder.push({ order, definitions: dictDefinitions });
                                        }
                                      }

                                      // Sort by order and flatten
                                      definitionsByOrder.sort((a, b) => a.order - b.order);
                                      const definitions = definitionsByOrder.flatMap(d => d.definitions);

                                      // Check if we have any definitions
                                      if (definitions.length === 0) {
                                        toast.error('No definitions selected', {
                                          description: 'Please check at least one dictionary to create an Anki card.'
                                        });
                                        return;
                                      }

                                      // Get frequency data as ordered pairs
                                      const freqInfo = getAllFrequencyInfo(
                                        term,
                                        reading,
                                        results,
                                        effectivePreferences.freqDictionaryOrder
                                      );
                                      const frequencyPairs = freqInfo.map(info => [info.dictionaryName, info.frequency]);

                                      // Get pitch accent data as comma-separated numbers
                                      const pitchData = pitchAccentData[reading || ''];
                                      let pitchAccent = '';
                                      if (pitchData && pitchData.entries && pitchData.entries.length > 0) {
                                        const positions = pitchData.entries.map(entry => entry.position);
                                        pitchAccent = positions.join(', ');
                                      }

                                      // Get sentence context (only if not in standalone mode)
                                      const sentence = isStandalone ? null : searchQuery;

                                      // Get the first available audio URL (without query params) for storage
                                      let expressionAudio = null;
                                      const audioKey = `${term}|${reading || ''}`;
                                      console.log('🎵 DEBUG: Checking for audio data:', {
                                        audioKey,
                                        hasAudioData: !!audioData[audioKey],
                                        audioSources: audioData[audioKey]?.audioSources,
                                        audioSourcesLength: audioData[audioKey]?.audioSources?.length
                                      });

                                      // Check if audio data is already available in state
                                      if (audioData[audioKey]?.audioSources?.length > 0) {
                                        // Get the selected audio source for this term, or use first if none selected
                                        const selectedAudioSource = getSelectedAudioSource(
                                          audioData[audioKey].audioSources,
                                          selectedAudioByLayer,
                                          currentSlideIndex,
                                          index
                                        );
                                        if (selectedAudioSource) {
                                          const mediaPath = selectedAudioSource.url.replace('/audio/', '/media/');
                                          expressionAudio = extractAudioUrlWithoutParams(mediaPath);
                                          console.log('🎵 DEBUG: Using selected audio data:', {
                                            originalUrl: selectedAudioSource.url,
                                            mediaPath,
                                            finalExpressionAudio: expressionAudio
                                          });
                                        }
                                      } else {
                                        // Audio data not available, fetch it now
                                        console.log('🎵 DEBUG: Audio data not loaded, fetching now...');
                                        try {
                                          // Fetch audio directly instead of using the state-based fetchAudio function
                                          const params = new URLSearchParams({ term });
                                          if (reading) {
                                            params.append('reading', reading);
                                          }

                                          const apiUrl = getBackendApiUrl();
                                          const fullUrl = `${apiUrl}/api/audio?${params.toString()}`;
                                          console.log('🎵 DEBUG: Making direct API call to:', fullUrl);

                                          const supabaseClient = await ensureSupabaseClient();
                                          const response = await fetch(fullUrl, {
                                            headers: {
                                              'Authorization': `Bearer ${(await supabaseClient.auth.getSession()).data.session?.access_token}`
                                            }
                                          });

                                          if (response.ok) {
                                            const audioResponse: AudioResponse = await response.json();
                                            console.log('🎵 DEBUG: Direct audio fetch successful:', audioResponse);

                                            // Use the selected audio source or first if none selected
                                            if (audioResponse.audioSources?.length > 0) {
                                              const selectedAudioSource = getSelectedAudioSource(
                                                audioResponse.audioSources,
                                                selectedAudioByLayer,
                                                currentSlideIndex,
                                                index
                                              );
                                              if (selectedAudioSource) {
                                                const mediaPath = selectedAudioSource.url.replace('/audio/', '/media/');
                                                expressionAudio = extractAudioUrlWithoutParams(mediaPath);
                                                console.log('🎵 DEBUG: Audio URL processed from direct fetch:', {
                                                  originalUrl: selectedAudioSource.url,
                                                  mediaPath,
                                                  finalExpressionAudio: expressionAudio
                                                });
                                              }
                                            }
                                          } else {
                                            console.error('🎵 DEBUG: Direct audio fetch failed:', response.status, response.statusText);
                                          }
                                        } catch (error) {
                                          console.error('🎵 DEBUG: Failed to fetch audio directly:', error);
                                        }
                                      }

                                      if (!expressionAudio) {
                                        console.log('🎵 DEBUG: No audio data found for key after all attempts:', audioKey);
                                      }

                                      // Insert into database
                                      // Use the database client factory which checks for test mode and returns MockDatabaseClient if needed
                                      const dbClient = createDatabaseClient();
                                      const cardData = {
                                        expression: term,
                                        reading: reading || '',
                                        definitions: definitions,
                                        sentence: sentence,
                                        pitch_accent: pitchAccent,
                                        frequency: frequencyPairs,
                                        expression_audio: expressionAudio,
                                        anki_note_id: null, // Will be populated when synced to Anki
                                        anki_model: null, // Will be populated when synced to Anki
                                        anki_deck: null, // Will be populated when synced to Anki
                                        sync_status: 'local_only', // Card created but not yet synced to Anki
                                        synced_at: null // Will be populated when synced to Anki
                                      };

                                      console.log('🎵 DEBUG: Inserting card with data:', cardData);

                                      const result = await createCardInDatabaseWithClient(dbClient, {
                                        term,
                                        reading: reading || '',
                                        definitions,
                                        sentence: sentence || undefined,
                                        pitchAccent: pitchAccent || undefined,
                                        frequencyPairs,
                                        expressionAudio: expressionAudio || undefined,
                                        documentTitle: bookTitle || undefined
                                      });

                                      if (!validateCardCreationResult(result)) {
                                        throw new Error(result.error || 'Failed to create card');
                                      }

                                      const { data, error } = { data: result.data, error: null };

                                      if (error) {
                                        console.error('Error inserting card:', error);
                                        toast.error('Failed to create Anki card');
                                      } else {
                                        console.log('✅ Anki card created successfully:', data);

                                        // Reset all dictionary checkboxes after successful card creation
                                        const resetCheckedState: Record<string, number | false> = {};
                                        memoizedSearchResult?.dictionaryResults?.forEach(dictResult => {
                                          const dKey = `${dictResult.title}#${dictResult.revision}`;
                                          resetCheckedState[dKey] = false;
                                        });
                                        setCheckedByLayer(prev => ({ ...prev, [index]: resetCheckedState }));

                                        // Update the mined cards state
                                        if (data && data.length > 0) {
                                          if (!data[0].id) {
                                            console.error('🚨 CRITICAL: Card insert returned no ID!', data[0]);
                                            toast.error('Card created but missing ID - sync may not work');
                                          }

                                          setMinedCards(prev => ({
                                            ...prev,
                                            [cardKey]: {
                                              id: data[0].id,
                                              anki_note_id: data[0].anki_note_id
                                            }
                                          }));

                                          // If auto-sync is enabled and extension is available, automatically sync to Anki
                                          if (autoSyncEnabled) {
                                            console.log('🔄 Auto-sync enabled, checking extension availability...');
                                            try {
                                            // Check if extension is available by sending a test message
                                            let extensionResponded = false;
                                            const handleExtensionResponse = (event: MessageEvent) => {
                                              console.log('📥 Received message from extension:', event.data);
                                              if (event.data?.type === CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK_RESPONSE) {
                                                extensionResponded = true;
                                                window.removeEventListener('message', handleExtensionResponse);
                                                console.log('✅ Extension check response:', event.data);

                                                match(event.data.extensionAvailability)
                                                  .with({ kind: 'AVAILABLE_AUTH' }, () => {
                                                    // Extension is authenticated, proceed with sync
                                                    if (!data[0].id) {
                                                      console.error('🚨 CRITICAL: Cannot auto-sync - card has no ID!', data[0]);
                                                      toast.error('Card created but cannot sync - missing ID');
                                                      return;
                                                    }

                                                    const syncMessage = {
                                                      type: EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_SYNC_CARDS,
                                                      cardIds: [data[0].id]
                                                    };

                                                    console.log('📤 Sending sync card message:', syncMessage);
                                                    window.postMessage(syncMessage, window.location.origin);
                                                    toast.success('Card created and syncing to Anki...');
                                                  })
                                                  .with({ kind: 'AVAILABLE_UNAUTH' }, (availability) => {
                                                    console.log('⚠️ Extension available but not authenticated', availability.error);
                                                    toast.success('Card created! Log in via the extension to sync to Anki.');
                                                  })
                                                  .with({ kind: 'UNAVAILABLE' }, (availability) => {
                                                    console.log('🚫 Extension not available:', availability.reason);
                                                    toast.success('Card created! Install or enable the extension to sync to Anki.');
                                                  })
                                                  .exhaustive();
                                              }
                                            };

                                            window.addEventListener('message', handleExtensionResponse);

                                            // Send extension availability check message (must match extension constant)
                                            const checkMessage = { type: CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK };
                                            console.log('📤 Sending extension check message:', checkMessage);
                                            window.postMessage(checkMessage, window.location.origin);

                                            // Fallback if extension doesn't respond
                                            setTimeout(() => {
                                              window.removeEventListener('message', handleExtensionResponse);
                                              if (!extensionResponded) {
                                                console.log('⏰ Extension check timeout - no response received');
                                                toast.success('Card created! Install the extension to sync to Anki.');
                                              }
                                            }, 1000);

                                            // Listen for sync response
                                            const handleSyncResponse = (syncEvent: MessageEvent) => {
                                              console.log('📥 Received sync response message:', syncEvent.data);
                                              if (syncEvent.data?.type === EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_SYNC_CARDS_RESPONSE) {
                                                console.log('✅ Processing anki.syncCardsResponse:', syncEvent.data);
                                                window.removeEventListener('message', handleSyncResponse);
                                                if (syncEvent.data.success) {
                                                  // results is an array of Anki note IDs (numbers), not objects
                                                  const returnedNoteId = Array.isArray(syncEvent.data.results) ? syncEvent.data.results[0] : null;
                                                  console.log('🔄 Updating mined cards state with Anki note ID:', returnedNoteId);
                                                  setMinedCards(prev => ({
                                                    ...prev,
                                                    [cardKey]: {
                                                      id: data[0].id,
                                                      anki_note_id: returnedNoteId
                                                    }
                                                  }));
                                                  toast.success('Card created and synced to Anki!');
                                                } else {
                                                  console.log('❌ Sync failed:', syncEvent.data.error);
                                                  const error = syncEvent.data.error || 'Unknown error occurred';
                                                  const isConnectivityError = error.includes('Failed to fetch') ||
                                                                              error.includes('Network error') ||
                                                                              error.includes('Connection refused') ||
                                                                              error.includes('timeout') ||
                                                                              error.includes('ECONNREFUSED');
                                                  if (isConnectivityError) {
                                                    console.log('🔄 Auto-disabling auto-sync due to AnkiConnect connectivity issue');
                                                    setAutoSyncEnabled(false);
                                                    checkAnkiHealth();
                                                    toast.error('Card created but failed to sync to Anki', {
                                                      description: error
                                                    });
                                                    setTimeout(() => {
                                                      if (shouldShowExtensionToasts()) {
                                                        toast.warning('Auto-sync disabled', {
                                                          description: 'AnkiConnect appears to be unavailable. Auto-sync has been disabled.'
                                                        });
                                                      }
                                                    }, 1000);
                                                  } else {
                                                    toast.error('Card created but failed to sync to Anki', {
                                                      description: error
                                                    });
                                                  }
                                                }
                                              }
                                            };

                                            window.addEventListener('message', handleSyncResponse);

                                            // Add timeout for sync response
                                            setTimeout(() => {
                                              window.removeEventListener('message', handleSyncResponse);
                                              console.log('⏰ Sync response timeout - no response received after 10 seconds');
                                            }, 10000);

                                            } catch (syncError) {
                                              console.error('Error checking extension availability:', syncError);
                                              toast.success('Card created! Use the extension to sync to Anki.');
                                            }
                                          } else {
                                            toast.success('Card created! Use the extension to sync to Anki.');
                                          }
                                        }
                                      }
                                    } catch (error) {
                                      console.error('Error creating Anki card:', error);
                                      toast.error('Failed to create Anki card');
                                    }
                                  }}
                                  className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground focus:outline-none focus:ring-0 ml-auto"
                                  title="Create Anki card"
                                >
                                  <CirclePlus className="w-4 h-4" />
                                </button>
                              );
                            }
                          })()}

                          {/* Toolbar moved to page header */}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 mt-2 px-2">
                        {(() => {
                          const freqInfo = getAllFrequencyInfo(
                            termGroup.term,
                            termGroup.dictEntries[0].entries[0].reading,
                            results,
                            effectivePreferences.freqDictionaryOrder
                          );
                          // console.log('Frequency info:', freqInfo);

                          if (freqInfo.length === 0) return null;
                          if (freqInfo.length <= 3) {
                            return freqInfo.map((info, idx) => (
                                                              <Badge key={idx} variant="secondary" className="text-xs">
                                  {info.dictionaryName}: {info.frequency.toLocaleString()}
                                </Badge>
                            ));
                          }

                          return (
                            <ScrollArea className="w-full whitespace-nowrap" type="scroll">
                              <div className="flex w-max gap-1 pb-2">
                                {freqInfo.map((info, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs shrink-0">
                                    {info.dictionaryName}: {info.frequency.toLocaleString()}
                                  </Badge>
                                ))}
                              </div>
                              <ScrollBar orientation="horizontal" className="h-1.5 bg-muted" />
                            </ScrollArea>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="px-4" data-testid={`search-results-definitions-${index}`}>
                      {(showOnlyCheckedByLayer[index]
                        ? termGroup.dictEntries.filter(de => {
                            const defKey = makeDefinitionKey({
                              dictionaryTitle: de.title,
                              revision: de.revision,
                              termGroupIndex: currentSlideIndex,
                              layerIndex: index
                            });
                            const layerState = checkedByLayer[index] || {};
                            return typeof layerState[defKey] === 'number';
                          })
                        : termGroup.dictEntries
                      ).map((dictEntry, dictIndex) => {
                        const defKey = makeDefinitionKey({
                          dictionaryTitle: dictEntry.title,
                          revision: dictEntry.revision,
                          termGroupIndex: currentSlideIndex,
                          layerIndex: index
                        });
                        const layerIndex = index; // align layer with stack index
                        const layerState = checkedByLayer[layerIndex] || {};
                        const content = (
                          <div key={`dict-${dictIndex}`}>
                            <div className="flex items-center justify-between mb-2 mt-2">
                              <h3 className="text-md font-semibold text-foreground">
                                {dictEntry.title}
                              </h3>
                              <div className="flex items-center gap-2">
                                {typeof layerState[defKey] === 'number' && (
                                  <Badge variant="secondary" className="text-xs font-semibold min-w-[1.5rem] h-5 flex items-center justify-center">
                                    {layerState[defKey]}
                                  </Badge>
                                )}
                                <Checkbox
                                  checked={typeof layerState[defKey] === 'number'}
                                  onCheckedChange={(checked) => handleDictionaryCheck(layerIndex, defKey, !!checked)}
                                />
                              </div>
                            </div>

                            <div className="space-y-4">
                              {dictEntry.entries.map((entry: TermEntry, index: number) => {
                                return (
                                  <div
                                    key={`${entry.text}-${index}`}
                                    className="p-4 border border-border rounded-lg"
                                  >
                                    <div className="flex flex-col gap-2">

                                      {(entry.tags.length > 0 || entry.termTags.length > 0) && (
                                        <div className="mb-3 flex gap-1 flex-wrap">
                                          {[...entry.tags, ...entry.termTags].map((tag, i) => (
                                            <span
                                              key={i}
                                              className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground"
                                            >
                                              {tag}
                                            </span>
                                          ))}
                                        </div>
                                      )}



                                      <div className="space-y-2">
                                        {entry.definitions.map((def, i) => (
                                          <div key={i} className="flex gap-2">
                                            <span className="text-muted-foreground flex-shrink-0">{i + 1}.</span>
                                            <DefinitionView
                                              definition={def}
                                              dictionaryOrigin={dictEntry.origin}
                                              knownKanji={effectivePreferences.shouldHighlightKanjiInSearch ? knownKanji : []}
                                              encounteredKanji={effectivePreferences.shouldHighlightKanjiInSearch ? encounteredKanji : []}
                                            />
                                          </div>
                                        ))}
                                      </div>

                                      {/* <div className="mt-2 text-xs text-muted-foreground flex gap-2">
                                        <span>Score: {entry.score.toFixed(2)}</span>
                                        {entry.sequenceNumber > 0 && (
                                          <span> Seq: {entry.sequenceNumber}</span>
                                        )}
                                      </div> */}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );

                        const spoilerDictKey = `${dictEntry.title}#${dictEntry.revision}`;
                        // Create a unique key for this spoiler state using layer, slide, and dict info
                        const spoilerStateKey = makeDefinitionKey({
                          dictionaryTitle: dictEntry.title,
                          revision: dictEntry.revision,
                          termGroupIndex: currentSlideIndex,
                          layerIndex: index
                        });
                        const isRevealed = spoilerRevealed[spoilerStateKey] || false;

                        return effectivePreferences.spoilerDictionaries.includes(spoilerDictKey) ? (
                          <SpoilerContent
                            key={spoilerStateKey}
                            title={dictEntry.title}
                            isRevealed={isRevealed}
                            onToggleReveal={(revealed) => {
                              setSpoilerRevealed(prev => ({
                                ...prev,
                                [spoilerStateKey]: revealed
                              }));
                            }}
                          >
                            {content}
                          </SpoilerContent>
                        ) : content;
                      })}
                    </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6 text-muted-foreground max-w-xl mx-auto">
            </div>
          );

          return (
            <div
              key={`search-layer-${index}`}
              className={`absolute inset-0 flex flex-col ${
                current !== index + 1 ? 'hidden' : ''
              }`}
            >
              <div className="flex-1 overflow-y-auto">
                {content}
              </div>
              {/* Global controls and dots anchored to bottom for the visible layer */}
              {current === index + 1 && currentTermGroups.length > 1 && (
                <div className="z-40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t border-border">
                  <div className="flex items-center justify-between px-4 py-2">
                    <button
                      className={cn(
                        "h-8 w-8 rounded-full border inline-flex items-center justify-center",
                        currentSlideIndex === 0 && "opacity-50 cursor-not-allowed"
                      )}
                      onClick={() => {
                        if (currentSlideIndex > 0) {
                          updateLayerSlideIndex(index, currentSlideIndex - 1);
                        }
                      }}
                      disabled={currentSlideIndex === 0}
                      aria-label="Previous slide"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>

                    <div className="flex justify-center gap-2">
                      {Array.from({ length: currentTermGroups.length }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => updateLayerSlideIndex(index, i)}
                          className={cn(
                            "h-2 w-2 rounded-full",
                            i === currentSlideIndex ? "bg-foreground" : "bg-muted-foreground/30"
                          )}
                          aria-label={`Go to slide ${i + 1}`}
                        />
                      ))}
                    </div>

                    <button
                      className={cn(
                        "h-8 w-8 rounded-full border inline-flex items-center justify-center",
                        currentSlideIndex === currentTermGroups.length - 1 && "opacity-50 cursor-not-allowed"
                      )}
                      onClick={() => {
                        if (currentSlideIndex < currentTermGroups.length - 1) {
                          updateLayerSlideIndex(index, currentSlideIndex + 1);
                        }
                      }}
                      disabled={currentSlideIndex === currentTermGroups.length - 1}
                      aria-label="Next slide"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
        )}
      </div>
    </div>
  );
}
