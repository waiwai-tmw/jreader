'use client'

import { debounce } from 'lodash'
import { useState, useCallback, useEffect } from 'react'

import { BaseHeader } from '@/components/BaseHeader'
import { KanjiLegend } from '@/components/KanjiLegend'
import SearchPane from '@/components/SearchPane/SearchPane'
import { useAuth } from '@/contexts/AuthContext'
import { useKanjiStates, KanjiQueryEnabled, SubscriptionCheck } from '@/hooks/useKanjiStates'
import { usePageTitle } from '@/hooks/usePageTitle'
import { backendService } from '@/services/backendService'
import type { LookupTermResponse } from '@/types/backend-types'
import { groupByTerm } from '@/utils/dictionary'
import { createClient } from '@/utils/supabase/client'
import { containsKanji } from '@/utils/text'

type SearchStackEntry = {
  query: string;
  firstTerm?: string;
  results?: LookupTermResponse | null;
  position?: number;
  isBaseSearch?: boolean;
  slideIndex?: number;
};

export default function DictionaryTermsPage({ 
  params 
}: { 
  params: Promise<{ terms: string[] }> 
}) {
  const { user, isLoading: authLoading } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState<LookupTermResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchStack, setSearchStack] = useState<SearchStackEntry[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [userPreferences, setUserPreferences] = useState<{
    dictionaryOrder: string[];
    disabledDictionaries: string[];
    spoilerDictionaries: string[];
    freqDictionaryOrder: string[];
    shouldHighlightKanjiInSearch?: boolean;
  } | null>(null)
  const [preferencesLoading, setPreferencesLoading] = useState(false)
  const [lastSearchKey, setLastSearchKey] = useState<string>('')
  const [isInitializing, setIsInitializing] = useState(false)
  const [searchCache, setSearchCache] = useState<Record<string, any>>({})
  const supabase = createClient()
  usePageTitle('Dictionary - JReader');

  // Only use kanji states if user is authenticated
  const { knownKanji, encounteredKanji, cycleKanjiState } = useKanjiStates(
    user ? KanjiQueryEnabled.ENABLED : KanjiQueryEnabled.DISABLED, 
    SubscriptionCheck.DONT_CHECK
  )

  // Helper function to update URL and tab title
  const updateUrlAndTitle = useCallback((url: string, searchTerm?: string, replace = false) => {
    // Update the URL with proper history entry
    if (replace) {
      window.history.replaceState({}, '', url)
    } else {
      window.history.pushState({}, '', url)
    }
    
    // Update the tab title
    if (searchTerm) {
      document.title = `${searchTerm} - Dictionary | JReader`
    } else {
      document.title = 'Dictionary | JReader'
    }
  }, [])

  // Memoize the kanji marking function to prevent recreation
  const markKanjiAsEncountered = useCallback(async (firstTerm: string) => {
    if (!userPreferences?.shouldHighlightKanjiInSearch) {
      console.log('📝 Skipping kanji marking - highlighting disabled');
      return;
    }
    
    console.log('📝 Marking kanji as encountered for:', firstTerm);
    for (const char of firstTerm) {
      if (containsKanji(char)) {
        console.log(`Checking kanji: ${char}`);
        if (!knownKanji.includes(char) && !encounteredKanji.includes(char)) {
          try {
            console.log('🔄 Cycling kanji state for DICTIONARY SEARCH:', char);
            await cycleKanjiState(char, false);
          } catch (error) {
            console.error('Failed to cycle kanji state:', error);
          }
        } else {
          console.log(`Skipping ${char} - already known or encountered`);
        }
      }
    }
  }, [knownKanji, encounteredKanji, cycleKanjiState, userPreferences?.shouldHighlightKanjiInSearch]);

  const debouncedSearch = useCallback(
    debounce(async (text: string, position: number, onComplete: (results: LookupTermResponse | null) => void) => {
      const searchKey = `${text.trim()}:${position}`;
      
      // Check cache first
      if (searchCache[searchKey]) {
        console.log('🔄 Using cached search result:', searchKey);
        setSearchResult(searchCache[searchKey]);
        onComplete(searchCache[searchKey]);
        return;
      }
      
      // Prevent duplicate searches - even for explicit Enter key presses
      if (searchKey === lastSearchKey && searchResult) {
        console.log('🔄 Skipping duplicate search:', searchKey);
        onComplete(searchResult);
        return;
      }
      
      setLastSearchKey(searchKey);
      setIsLoading(true);
      try {
        const result = await backendService.lookupTerm(text.trim(), position);
        
        // Cache the result
        setSearchCache(prev => ({ ...prev, [searchKey]: result }));
        
        // Mark kanji as encountered if highlighting is enabled
        if (result?.dictionaryResults?.[0]?.entries?.[0]?.text) {
          await markKanjiAsEncountered(result.dictionaryResults[0].entries[0].text);
        }
        
        setSearchResult(result);
        onComplete(result);
        setIsLoading(false);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResult(null);
        onComplete(null);
        setIsLoading(false);
      }
    }, 500),
    [markKanjiAsEncountered, lastSearchKey, searchResult, searchCache]
  )

  // Initialize from URL parameters
  useEffect(() => {
    const initializeFromUrl = async () => {
      // Prevent multiple initialization calls
      if (isInitializing) {
        console.log('🔄 Skipping initialization - already in progress');
        return;
      }
      
      setIsInitializing(true);
      try {
        const { terms } = await params

        // Check if we have a full URL path that might contain more terms than params
        const pathname = window.location.pathname
        const urlTerms = pathname.replace('/dictionary', '').replace(/^\/+/, '').split('/')
        
        // Use the full URL path if it has more terms than the params
        const termsToUse = urlTerms.length > terms.length ? urlTerms : terms
        
        // Filter out empty terms
        const filteredTerms = termsToUse.filter(term => term.trim() !== '')
        
        if (filteredTerms && filteredTerms.length > 0) {
          // Decode URL-encoded terms and parse query:position format
          const decodedTerms = filteredTerms.map(term => decodeURIComponent(term))
          
          // Parse terms into query and position (position 0 is implied when no : is present)
          const parsedTerms = decodedTerms.map(term => {
            const parts = term.split(':')
            if (parts.length === 2) {
              return { query: parts[0], position: parseInt(parts[1]) || 0 }
            } else {
              return { query: term, position: 0 }
            }
          })
          
          // Set the last term's query as the current search query
          const lastTerm = parsedTerms[parsedTerms.length - 1]
          setSearchQuery(lastTerm.query)
          
          // Update tab title with the search term
          updateUrlAndTitle(window.location.pathname, lastTerm.query)

          // Build search stack by looking up each term in sequence
            const newStack: SearchStackEntry[] = []
            
            for (let i = 0; i < parsedTerms.length; i++) {
              const { query, position } = parsedTerms[i]
              const searchKey = `${query}:${position}`
              
              // Check if we already have this search result in cache
              if (searchCache[searchKey]) {
                console.log('🔄 Using cached search result for:', searchKey)
                const cachedResult = searchCache[searchKey]
                // Derive firstTerm from grouped results when available
                let firstTerm = query
                if (cachedResult?.dictionaryResults && cachedResult.dictionaryResults.length > 0) {
                  const groups = groupByTerm(cachedResult.dictionaryResults, [])
                  firstTerm = groups[0]?.term || query
                }
                newStack.push({
                  query: query,
                  position: position,
                  results: cachedResult,
                  firstTerm: firstTerm
                })
                
                // Update the current search result to the last one
                if (i === parsedTerms.length - 1) {
                  setSearchResult(searchCache[searchKey])
                  setLastSearchKey(searchKey)
                }
                continue
              }
              
              try {
                const result = await backendService.lookupTerm(query, position)
                
                // Cache the result
                setSearchCache(prev => ({ ...prev, [searchKey]: result }))
                
                // Derive firstTerm from grouped results when available
                let firstTerm = query
                if (result && result.dictionaryResults && result.dictionaryResults.length > 0) {
                  const groups = groupByTerm(result.dictionaryResults, [])
                  firstTerm = groups[0]?.term || query
                }
                newStack.push({
                  query: query,
                  position: position,
                  results: result,
                  firstTerm: firstTerm
                })
                
                // Update the current search result to the last one
                if (i === parsedTerms.length - 1) {
                  setSearchResult(result)
                  setLastSearchKey(searchKey)
                }
              } catch (error) {
                console.error(`Failed to lookup term: ${query}`, error)
                newStack.push({
                  query: query,
                  position: position,
                  results: null
                })
              }
            }

            setSearchStack(newStack)
        } else {
          // No terms in URL - this is the base /dictionary route
          setSearchQuery('')
          setSearchResult(null)
          setSearchStack([])
        }
      } catch (error) {
        console.error('Failed to initialize from URL params:', error)
      } finally {
        setIsInitializing(false);
        setIsInitialized(true);
      }
    }

    // Only initialize once when auth loading is complete
    if (!authLoading && !isInitialized && !isInitializing) {
      initializeFromUrl()
    }
  }, [user, authLoading, isInitialized, isInitializing])

  const handleSearch = useCallback(async (text: string, position: number, source: 'textpane' | 'searchpane') => {
    setSearchQuery(text)
    
    if (!text.trim()) {
      setSearchResult(null)
      // Clear search stack when input is empty
      setSearchStack([])
      // Update URL to just /dictionary (replace current history entry, don't add new one)
      updateUrlAndTitle('/dictionary', undefined, true)
      return
    }

    // Check if this is a duplicate search for the same text
    const searchKey = `${text.trim()}:${position}`;
    if (searchKey === lastSearchKey && searchResult) {
      console.log('🔄 Skipping duplicate search in handleSearch:', searchKey);
      return;
    }

    debouncedSearch(text, position, (result) => {
      // For manual typing (searchpane source), replace the first item
      // For recursive lookups (textpane source), add to the stack
      if (source === 'searchpane') {
        // Manual typing - replace the first item
        if (result && result.dictionaryResults && result.dictionaryResults.length > 0) {
          // Group the dictionary results to get the first term
          const firstTerm = result?.dictionaryResults ? 
            groupByTerm(result.dictionaryResults, [])[0]?.term || text : 
            text
          setSearchStack([{
            query: text,
            position: position,
            results: result,
            firstTerm: firstTerm
          }])
          updateUrlAndTitle(`/dictionary/${firstTerm}`, firstTerm)
        } else if (text.trim()) {
          // If no results but we have text, still replace the stack
          setSearchStack([{
            query: text,
            position: position,
            results: null,
            firstTerm: text
          }])
          // Update URL to /dictionary/term
          updateUrlAndTitle(`/dictionary/${text}`, text)
        }
      } else {
        // Recursive lookup - add to the stack
        if (result && result.dictionaryResults && result.dictionaryResults.length > 0) {
          setSearchStack(prev => {
            // Group the dictionary results to get the first term
            const firstTerm = result?.dictionaryResults ? 
              groupByTerm(result.dictionaryResults, [])[0]?.term || text : 
              text
            const newStack = [...prev, {
              query: text,
              position: position,
              results: result,
              firstTerm: firstTerm
            }]
            // Update URL with the original search queries and positions (omit :0 for default position)
            const urlTerms = newStack.map(entry => entry.position === 0 ? entry.query : `${entry.query}:${entry.position}`)
            const url = `/dictionary/${urlTerms.join('/')}`
            const lastTerm = urlTerms[urlTerms.length - 1]
            updateUrlAndTitle(url, lastTerm)
            return newStack
          })
        } else if (text.trim()) {
          // If no results but we have text, still add to stack
          setSearchStack(prev => {
            const newStack = [...prev, {
              query: text,
              position: position,
              results: null,
              firstTerm: text
            }]
            // Update URL with the new term and position (omit :0 for default position)
            const urlTerms = newStack.map(entry => entry.position === 0 ? entry.query : `${entry.query}:${entry.position}`)
            const url = `/dictionary/${urlTerms.join('/')}`
            const lastTerm = urlTerms[urlTerms.length - 1]
            updateUrlAndTitle(url, lastTerm)
            return newStack
          })
        }
      }
    })
  }, [debouncedSearch, lastSearchKey, searchResult])

  const handleBack = useCallback((steps = 1) => {
    if (searchStack.length > steps) {
      const newStack = searchStack.slice(0, -steps)
      setSearchStack(newStack)

      const lastSearch = newStack[newStack.length - 1]
      if (lastSearch) {
        setSearchQuery(lastSearch.query)
        setSearchResult(lastSearch.results || null)
        // Clear lastSearchKey when navigating back to allow re-searching the same term
        setLastSearchKey('')
        // Update URL to reflect the new stack with original search queries and positions (omit :0 for default position)
        const urlTerms = newStack.map(entry => entry.position === 0 ? entry.query : `${entry.query}:${entry.position}`)
        const url = `/dictionary/${urlTerms.join('/')}`
        const lastTerm = urlTerms[urlTerms.length - 1]
        updateUrlAndTitle(url, lastTerm)
      } else {
        setSearchQuery('')
        setSearchResult(null)
        // Clear lastSearchKey when navigating back to allow re-searching
        setLastSearchKey('')
        // Update URL to just /dictionary (replace current history entry, don't add new one)
        updateUrlAndTitle('/dictionary', undefined, true)
      }
    }
  }, [searchStack])

  // Listen for searchupdate events from definition clicks
  useEffect(() => {
    const handleSearchUpdate = (e: CustomEvent<{ 
      text: string; 
      position: number;
      fromTextPane?: boolean;
      scrollY?: number;
    }>) => {
      // For events from definition clicks, we want to treat them as recursive lookups
      // The fromTextPane field indicates the original source, but in dictionary context
      // we want definition clicks to be recursive regardless of the original source
      const source = 'textpane'; // Treat definition clicks as recursive
      handleSearch(e.detail.text, e.detail.position, source);
    }

    window.addEventListener('searchupdate', handleSearchUpdate as EventListener)
    return () => {
      window.removeEventListener('searchupdate', handleSearchUpdate as EventListener)
    }
  }, [handleSearch])

  // Listen for browser back/forward buttons
  useEffect(() => {
    const handlePopState = async () => {
      // When user clicks back/forward, re-initialize from the new URL
      console.log('🔄 Popstate event triggered - reinitializing from URL')
      
      try {
        // Extract terms directly from the current URL pathname
        const pathname = window.location.pathname
        console.log('📍 Current pathname:', pathname)
        const urlTerms = pathname.replace('/dictionary', '').replace(/^\/+/, '').split('/')
        console.log('📍 URL terms:', urlTerms)
        
        if (urlTerms.length > 0 && urlTerms[0] !== '') {
          // Decode URL-encoded terms and parse query:position format
          const decodedTerms = urlTerms.map(term => decodeURIComponent(term))
          console.log('📍 Decoded terms:', decodedTerms)
          
          // Parse terms into query and position (position 0 is implied when no : is present)
          const parsedTerms = decodedTerms.map(term => {
            const parts = term.split(':')
            if (parts.length === 2) {
              return { query: parts[0], position: parseInt(parts[1]) || 0 }
            } else {
              return { query: term, position: 0 }
            }
          })
          console.log('📍 Parsed terms:', parsedTerms)
          
          // Set the target term as the current search query (second-to-last)
          const targetTerm = parsedTerms[parsedTerms.length - 2]
          setSearchQuery(targetTerm.query)
          
          // Update tab title
          document.title = `${targetTerm.query} - Dictionary | JReader`

          // Look up the second-to-last term (the one we're navigating to when going back)
            const { query, position } = targetTerm
            
                          try {
                const result = await backendService.lookupTerm(query, position)
              
              // Only try to get firstTerm if we have a valid result
              let firstTerm = query
              if (result && result.dictionaryResults && result.dictionaryResults.length > 0) {
                const groups = groupByTerm(result.dictionaryResults, [])
                firstTerm = groups[0]?.term || query
              }
              
              // Build the search stack excluding the last term (which we're going back from)
              const newStack: SearchStackEntry[] = []
              
              // For the target term (second-to-last), we have the results and can get the proper firstTerm
              // For previous terms, we need to do quick lookups to get their firstTerm for breadcrumb display
              // Process all terms except the last two (last term and target term)
              for (let i = 0; i < parsedTerms.length - 2; i++) {
                const { query: prevQuery, position: prevPosition } = parsedTerms[i]
                
                // Do a quick lookup to get the firstTerm for breadcrumb display
                try {
                  const prevResult = await backendService.lookupTerm(prevQuery, prevPosition)
                  let prevFirstTerm = prevQuery
                  if (prevResult && prevResult.dictionaryResults && prevResult.dictionaryResults.length > 0) {
                    const prevGroups = groupByTerm(prevResult.dictionaryResults, [])
                    prevFirstTerm = prevGroups[0]?.term || prevQuery
                  }
                  
                  newStack.push({
                    query: prevQuery,
                    position: prevPosition,
                    results: null, // We don't need the full results for breadcrumb
                    firstTerm: prevFirstTerm
                  })
                } catch (error) {
                  console.error(`Popstate: Failed to get firstTerm for "${prevQuery}"`, error)
                  // Fallback to using query as firstTerm
                  newStack.push({
                    query: prevQuery,
                    position: prevPosition,
                    results: null,
                    firstTerm: prevQuery
                  })
                }
              }
              
              // Add the target term (second-to-last) with results
              newStack.push({
                query: query,
                position: position,
                results: result,
                firstTerm: firstTerm
              })
              
              setSearchStack(newStack)
              setSearchResult(result)
            } catch (error) {
              console.error(`Popstate: Failed to lookup term: "${query}" at position ${position}`, error)
              // Even if lookup fails, still build the stack for breadcrumb (excluding the last term)
              const newStack: SearchStackEntry[] = []
              
              for (let i = 0; i < parsedTerms.length - 2; i++) {
                const { query: prevQuery, position: prevPosition } = parsedTerms[i]
                newStack.push({
                  query: prevQuery,
                  position: prevPosition,
                  results: null,
                  firstTerm: prevQuery
                })
              }
              
                newStack.push({
                  query: query,
                  position: position,
                  results: null
                })
              
              setSearchStack(newStack)
              setSearchResult(null)
            }
        } else {
          // No terms in URL - this is the base /dictionary route
          setSearchQuery('')
          setSearchResult(null)
          setSearchStack([])
          document.title = 'Dictionary | JReader'
        }
      } catch (error) {
        console.error('Popstate: Failed to re-initialize from URL:', error)
      }
    }

    window.addEventListener('popstate', handlePopState)
    
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [user])

  // Load user preferences with localStorage caching - memoized to prevent multiple loads
  const fetchPreferences = useCallback(async () => {
    if (!user || preferencesLoading) return; // Don't load if already loading or no user
    
    setPreferencesLoading(true);
    try {
      // Use the user from AuthContext instead of making another getUser call
      if (!user) return;

      // Try to load from localStorage first
      const cachedPreferences = localStorage.getItem(`user-preferences-${user.id}`);
      if (cachedPreferences) {
        try {
          const parsed = JSON.parse(cachedPreferences);
          console.log('Loaded preferences from cache in dictionary:', parsed);
          setUserPreferences(parsed);
          return; // Don't fetch from database if we have cached data
        } catch (e) {
          console.log('Failed to parse cached preferences, fetching from database');
        }
      }

      // Fetch fresh data from database
      let { data, error } = await supabase
        .from('User Preferences')
        .select('term_order, term_disabled, term_spoiler, freq_order, should_highlight_kanji_in_search')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        console.log('No user preferences found, creating defaults...');
        
        // Get all dictionaries from Dictionary Index
        const { data: dictIndexData, error: dictIndexError } = await supabase
            .from('Dictionary Index')
            .select('title, revision, type')
            .order('title');

        if (dictIndexError) throw dictIndexError;
        
        // Create default preferences
        const termDicts = dictIndexData
            ?.filter(d => d.type === 0)
            .map(d => `${d.title}#${d.revision}`) || [];
            
        const freqDicts = dictIndexData
            ?.filter(d => d.type === 2)
            .map(d => `${d.title}#${d.revision}`) || [];

        data = {
            term_order: termDicts.join(','),
            term_disabled: '',
            term_spoiler: '',
            freq_order: freqDicts.join(','),
            should_highlight_kanji_in_search: true
        };
        
        console.log('Created default preferences from Dictionary Index:', data);
      } else {
        console.log('Loaded user preferences from database:', data);
      }

      if (data) {
        const preferences = {
          dictionaryOrder: data.term_order ? data.term_order.split(',') : [],
          disabledDictionaries: data.term_disabled ? data.term_disabled.split(',') : [],
          spoilerDictionaries: data.term_spoiler ? data.term_spoiler.split(',') : [],
          freqDictionaryOrder: data.freq_order ? data.freq_order.split(',') : [],
          shouldHighlightKanjiInSearch: data.should_highlight_kanji_in_search ?? true
        };
        
        // Cache in localStorage
        localStorage.setItem(`user-preferences-${user.id}`, JSON.stringify(preferences));
        console.log('Cached preferences in localStorage from dictionary');
        
        setUserPreferences(preferences);
      }
    } catch (err) {
      console.error('Failed to load dictionary preferences:', err);
    } finally {
      setPreferencesLoading(false);
    }
  }, [user, supabase, preferencesLoading]);

  // Load user preferences only once when user changes
  useEffect(() => {
    if (user && !userPreferences) {
      fetchPreferences();
    }
  }, [user, fetchPreferences]);

  // Debug logging for searchStack
  useEffect(() => {
    console.log('Dictionary page - searchStack.length:', searchStack.length);
  }, [searchStack.length]);

  // Don't render until we've initialized from URL and auth is loaded
  if (!isInitialized || authLoading) {
    return (
      <div className="absolute inset-0 flex flex-col">
        <BaseHeader title="Dictionary" />
        <div className="relative flex-1 min-h-0 flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <BaseHeader title="Dictionary">
        <div className="block md:hidden">
          <KanjiLegend mobileOnly={true} />
        </div>
      </BaseHeader>
      <div className="relative flex-1 min-h-0">
        <SearchPane
          searchQuery={searchQuery}
          searchResult={searchResult}
          isLoading={isLoading}
          onSearch={handleSearch}
          onBack={handleBack}
          stackPosition={`${searchStack.length}/${Math.max(1, searchStack.length)}`}
          searchStack={searchStack}
          setSearchStack={setSearchStack}
          isStandalone={true}
          isAuthenticated={!!user}
          userPreferences={userPreferences}
        />
      </div>
    </div>
  )
}
