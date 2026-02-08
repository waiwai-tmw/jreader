'use client'

import debounce from 'lodash/debounce'
import { use } from 'react'
import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { type Root } from 'react-dom/client'
import { toast } from 'sonner'

import { Header } from "@/components/Header"
import { PageFooter } from "@/components/PageFooter"
import { GuestUserCard } from "@/components/GuestUserCard"
import { useRenderAnalyzer } from '@/components/RenderAnalyzer'
import SearchPane from "@/components/SearchPane/SearchPane"
import { PaginationColumns } from '@/components/TextPane/PaginationColumns';
import TextPane from "@/components/TextPane/TextPane"
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { useSidebar } from "@/components/ui/sidebar"
import { useAuth } from '@/contexts/AuthContext'
import { useEinkMode } from '@/contexts/EinkModeContext'
import { KanjiModeProvider } from "@/contexts/KanjiModeContext"
import { SettingsProvider } from "@/contexts/SettingsContext"
import { useDeviceDetect } from '@/hooks/useDeviceDetect'
import { useKanjiStates, KanjiQueryEnabled, SubscriptionCheck } from '@/hooks/useKanjiStates'
import { usePageTitle } from '@/hooks/usePageTitle'
import { backendService } from '@/services/backendService'
import type { LookupTermResponse } from '@/types/backend-types'
import { safeNumberStorage, safeBooleanStorage, safeJsonStorage, safeStringStorage } from '@/utils/safeStorage'
import { safeHistory, safeDocument } from '@/utils/safeWindow'
import { createClient } from '@/utils/supabase/client'
import { containsKanji } from '@/utils/text'

export default function BookPage({
  params,
  searchParams
}: {
  params: Promise<{ supabase_upload_id: string }>,
  searchParams: Promise<{ page?: string }>
}) {
  const { state } = useSidebar()
  const { user, isLoading: authLoading } = useAuth()
  const resolvedParams = use(params)
  const resolvedSearchParams = use(searchParams)
  const supabase_upload_id = resolvedParams.supabase_upload_id
  const initialPage = resolvedSearchParams.page ? parseInt(resolvedSearchParams.page, 10) : undefined
  const [bookTitle, setBookTitle] = useState<string>('Loading...')

  // Set default title for book page
  usePageTitle('Book - JReader');
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState<LookupTermResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchStack, setSearchStack] = useState<Array<{
    query: string;
    position?: number;
    results?: LookupTermResponse | null;
    isBaseSearch?: boolean;
    slideIndex?: number;
  }>>([])
  const rootRef = useRef<Root | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [dismissedGuestCard, setDismissedGuestCard] = useState(false)

  const [fontSize, setFontSize] = useState(() => {
    return safeNumberStorage.getItem('reader-fontSize', 1);
  });

  const [verticalMargin, setVerticalMargin] = useState(() => {
    const saved = safeNumberStorage.getItem('reader-verticalMargin', 0.5);
    console.log('🔍 Vertical margin:', saved);
    return saved;
  });

  const { isEinkMode } = useEinkMode();

  const [currentBook, setCurrentBook] = useState<{
    supabase_upload_id: string;
    currentPage: number;
    totalPages: number;
    isWebnovel?: boolean;
  } | null>(null)

  const [isAtBookmark, setIsAtBookmark] = useState(false)
  const [currentClickedPosition, setCurrentClickedPosition] = useState<number>(-1)
  const [tocEntries, setTocEntries] = useState<Array<{
    label: string
    page_number: number
    play_order: number
  }>>([])

  // Calculate max page from TOC entries
  const maxPageFromToc = useMemo(() => {
    if (tocEntries.length === 0) return 0;
    return Math.max(...tocEntries.map((entry: any) => entry.page_number));
  }, [tocEntries]);

  // Single function to update page title
  const updatePageTitle = useCallback((currentPage?: number) => {
    if (!bookTitle || bookTitle === 'Loading...') return;

    const page = currentPage ?? initialPage ?? 0;
    const totalPages = maxPageFromToc > 0 ? maxPageFromToc : (currentBook?.totalPages || 0);
    const numberInfo = totalPages > 0 ? `(${page}/${totalPages}) ` : `(${page}) `;
    safeDocument.setTitle(`${numberInfo}${bookTitle} - JReader`);
  }, [bookTitle, maxPageFromToc, currentBook?.totalPages, initialPage]);
  const [userPreferences, setUserPreferences] = useState<{
    dictionaryOrder: string[];
    disabledDictionaries: string[];
    spoilerDictionaries: string[];
    freqDictionaryOrder: string[];
    freqDisabledDictionaries: string[];
    shouldHighlightKanjiInSearch?: boolean;
    shouldHighlightKanjiInText?: boolean;
  } | null>(null)

  const { knownKanji, encounteredKanji, cycleKanjiState } = useKanjiStates(KanjiQueryEnabled.ENABLED, SubscriptionCheck.DONT_CHECK)

  const supabase = createClient()
  const [textPaneRef, setTextPaneRef] = useState<{ scroll: (direction: 'left' | 'right') => void } | null>(null);
  const isMobile = useDeviceDetect();
  const webnovelRegistrationRef = useRef<boolean>(false);

  // Render analyzer for debugging - check admin setting
  const [renderAnalyzerEnabled, setRenderAnalyzerEnabled] = useState(false);

  useEffect(() => {
    // Only enable if explicitly set to 'true' in localStorage
    const saved = safeBooleanStorage.getItem('renderAnalyzerEnabled', false);
    console.log('🔍 Render Analyzer localStorage check:', { saved, willEnable: saved });
    setRenderAnalyzerEnabled(saved);
  }, []);

  const { RenderAnalyzerComponent } = useRenderAnalyzer('SearchPane', renderAnalyzerEnabled);

  // Debug log for render analyzer state
  useEffect(() => {
    console.log('🔍 Render Analyzer final state:', { renderAnalyzerEnabled });
  }, [renderAnalyzerEnabled]);

  const isIPad = typeof window !== 'undefined' &&
    /iPad|Macintosh/.test(navigator.userAgent) &&
    navigator.maxTouchPoints > 1;

  const updateUrl = useCallback((page: number) => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const currentPage = url.searchParams.get('page');

      // Only update URL if the page number is different
      if (currentPage !== page.toString()) {
        if (page === 0) {
          // Remove page parameter if it's 0 (default)
          url.searchParams.delete('page');
        } else {
          // Set page parameter for non-zero pages
          url.searchParams.set('page', page.toString());
        }
        safeHistory.pushState({}, '', url.toString());
      }
    }
  }, []);

  const handleBookUpdate = useCallback((bookInfo: {
    supabase_upload_id: string;
    currentPage: number;
    totalPages: number;
    isWebnovel?: boolean;
  } | null) => {
    setCurrentBook(bookInfo);
    if (bookInfo) {
      updateUrl(bookInfo.currentPage);
      // Update page title
      updatePageTitle(bookInfo.currentPage);
    }
  }, [updateUrl, updatePageTitle]);

  const updateSetting = (type: 'fontSize' | 'verticalMargin', value: number) => {
    if (type === 'fontSize') {
      setFontSize(value);
      safeNumberStorage.setItem('reader-fontSize', value);
    } else {
      setVerticalMargin(value);
      safeNumberStorage.setItem('reader-verticalMargin', value);
    }

    const event = new CustomEvent('settingsupdate', {
      detail: { type, value }
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(event);
    }
  };

  const settingsContext = {
    fontSize,
    verticalMargin,
    preferences: userPreferences,
    updateSetting: (type: 'fontSize' | 'verticalMargin' | 'einkMode', value: number | boolean) => {
      if (type === 'einkMode') {
        // E-ink mode is now handled globally, so we don't need to do anything here
        return;
      } else {
        updateSetting(type as 'fontSize' | 'verticalMargin', value as number);
      }
    },
    onDragEnd: async () => {},
    toggleSpoiler: () => {},
    toggleFrequencyDictionary: async () => {},
    toggleKanjiHighlightingInSearch: async () => {},
    toggleKanjiHighlightingInText: async () => {},
  };

  const debouncedSearch = useCallback(
    debounce(async (text: string, position: number, onComplete: (results: any) => void) => {
      setIsLoading(true)
      try {
        console.log(`🔍 Starting debounced search for: "${text}" at position ${position}`)
        const result = await backendService.lookupTerm(text, position)

        if (result) {
          console.log('📗 Found definition, checking for kanji to cycle')
          console.log('Full result:', result)
          console.log('Dictionary results:', result.dictionaryResults)
          const firstTerm = result.dictionaryResults?.[0]?.entries?.[0]?.text
          console.log('First term extracted:', firstTerm)

          // Always mark kanji as encountered when searching (for learning), regardless of highlighting setting
          if (firstTerm) {
            console.log('📝 First term:', firstTerm)
            for (const char of firstTerm) {
              if (containsKanji(char)) {
                console.log(`Checking kanji: ${char}`)
                if (!knownKanji.includes(char) && !encounteredKanji.includes(char)) {
                  try {
                    console.log('🔄 Cycling kanji state for SEARCH:', char)
                    await cycleKanjiState(char, false)
                  } catch (error) {
                    console.error('Failed to cycle kanji state:', error)
                  }
                } else {
                  console.log(`Skipping ${char} - already known or encountered`)
                }
              }
            }
          } else {
            console.log('❌ No first term found in result structure')
          }
        }

        setSearchResult(result)
        onComplete(result)
        setIsLoading(false)
      } catch (error) {
        console.error('Search failed:', error)
        setSearchResult(null)
        onComplete(null)
        setIsLoading(false)
      }
    }, 300),
    [knownKanji, encounteredKanji, cycleKanjiState]
  )

  const handleSearch = useCallback((
    text: string,
    position: number,
    source: 'textpane' | 'searchpane'
  ) => {
    console.log(`Search from ${source}:`, text)
    setSearchQuery(text)
    setCurrentClickedPosition(position)

    // Open drawer when searching in portrait mode
    if (window.innerWidth < window.innerHeight) {
      setIsDrawerOpen(true);
    }

    debouncedSearch(text, position, (results) => {
      if (source === 'textpane') {
        setSearchStack([{ query: text, position, results, isBaseSearch: true }])
      } else {
        setSearchStack(prev => [...prev, { query: text, position, results, isBaseSearch: false }])
      }
    })
  }, [debouncedSearch])

  useEffect(() => {
    const handleSearchUpdate = (e: CustomEvent<{
      text: string;
      position: number;
      fromTextPane?: boolean;
    }>) => {
      console.log('🔍 Search event received:', {
        text: e.detail.text,
        fromTextPane: e.detail.fromTextPane
      });

      const source = e.detail.fromTextPane ? 'textpane' : 'searchpane';
    //   console.log('📍 Determined source:', source);

      handleSearch(e.detail.text, e.detail.position, source);
    }

    window.addEventListener('searchupdate', handleSearchUpdate as EventListener)
    return () => {
      window.removeEventListener('searchupdate', handleSearchUpdate as EventListener)
    }
  }, [handleSearch])

  // Fetch table of contents data (shared between header and footer)
  useEffect(() => {
    async function fetchToc() {
      if (!supabase_upload_id) {
        console.log('No supabaseUploadId provided for TOC fetch');
        return;
      }

      // Check if we already have TOC data cached for this book
      const cacheKey = `toc-${supabase_upload_id}`;
      let cachedToc = safeJsonStorage.getItem(cacheKey, null);

      if (cachedToc) {
        try {
          const parsed = JSON.parse(cachedToc);
          console.log('Using cached TOC data for:', supabase_upload_id);
          setTocEntries(parsed);
          // Update title with total pages from cached TOC
          updatePageTitle();
          return;
        } catch (e) {
          console.log('Failed to parse cached TOC, fetching fresh data');
        }
      }

      console.log('Fetching TOC data for:', supabase_upload_id);
      const { data, error } = await supabase
        .from('Table of Contents')
        .select('label, page_number, play_order')
        .eq('upload_id', supabase_upload_id)
        .order('play_order');

      if (error) {
        console.error('Error fetching TOC:', error);
        return;
      }

      console.log('TOC entries fetched:', data);
      setTocEntries(data || []);

      // Cache the TOC data
      if (data) {
        safeJsonStorage.setItem(cacheKey, data);

        // Update title with total pages from TOC
        updatePageTitle();
      }
    }

    fetchToc();
  }, [supabase_upload_id, supabase, bookTitle, initialPage]);

  // Load user preferences with localStorage caching
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        // Use the user from AuthContext instead of making another getUser call
        if (!user) {
          console.log('User not authenticated, setting default preferences for guest');
          // Set default preferences for unauthenticated users
          const guestDefaults = {
            dictionaryOrder: [],
            disabledDictionaries: [],
            spoilerDictionaries: [],
            freqDictionaryOrder: [],
            freqDisabledDictionaries: [],
            shouldHighlightKanjiInSearch: false, // Disabled for guests
            shouldHighlightKanjiInText: false,
          };
          setUserPreferences(guestDefaults);
          return;
        }

        // Try to load from localStorage first
        let cachedPreferences = safeJsonStorage.getItem(`user-preferences-${user.id}`, null);
        if (cachedPreferences) {
          console.log('Loaded preferences from cache:', cachedPreferences);
          setUserPreferences(cachedPreferences);
        }

        // Fetch fresh data from database
        const supabase = createClient();
        let { data, error } = await supabase
          .from('User Preferences')
          .select('term_order, term_disabled, term_spoiler, freq_order, freq_disabled, should_highlight_kanji_in_search, should_highlight_kanji_in_text')
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
              freq_disabled: '',
              should_highlight_kanji_in_search: true,
              should_highlight_kanji_in_text: true
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
            freqDisabledDictionaries: data.freq_disabled ? data.freq_disabled.split(',') : [],
            shouldHighlightKanjiInSearch: data.should_highlight_kanji_in_search ?? true,
            shouldHighlightKanjiInText: data.should_highlight_kanji_in_text ?? true
          };

          // Cache in localStorage
          safeJsonStorage.setItem(`user-preferences-${user.id}`, preferences);
          console.log('Cached preferences in localStorage');

          setUserPreferences(preferences);
        }
      } catch (err) {
        console.error('Failed to load dictionary preferences:', err);
      }
    };
    fetchPreferences();
  }, [user?.id]);

  useEffect(() => {
    // Add a small delay to ensure TextPane is ready
    const timer = setTimeout(() => {
      const event = new CustomEvent('bookselect', {
        detail: {
          supabase_upload_id,
          currentPage: initialPage ?? 0
        }
      })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(event)
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [supabase_upload_id, initialPage])

  useEffect(() => {
    const fetchBookContent = async () => {
      try {
        const supabase = createClient();

        let book: any;
        let isWebnovel = false;

        // Try webnovel table first (works for both authenticated and unauthenticated users)
        console.log('Checking webnovel table for:', supabase_upload_id);
        const { data: webnovelBook, error: webnovelError } = await supabase
          .from('webnovel')
          .select('title')
          .eq('id', supabase_upload_id)
          .maybeSingle();

        if (webnovelBook) {
          console.log('Found webnovel, fetching title from webnovel table...');
          book = webnovelBook;
          isWebnovel = true;
        } else if (webnovelError) {
          console.warn('⚠️ Error checking webnovel table:', webnovelError);
        }

        // If not found in webnovel table, try User Uploads (requires authentication)
        if (!book) {
          console.log('Book not in webnovel table, fetching from User Uploads...');
          const { data: regularBook, error: bookError } = await supabase
            .from('User Uploads')
            .select('title')
            .eq('id', supabase_upload_id)
            .single();

          if (bookError) {
            console.error('Regular book title fetch error:', bookError);
            throw bookError;
          }

          book = regularBook;
          console.log('Found regular book title');
        }

        const title = book?.title || "Not Found";
        setBookTitle(title);
        // Update page title - will be called again when TOC loads with total pages
        updatePageTitle();
      } catch (error) {
        console.error('Failed to fetch book title for:', supabase_upload_id, error);
        const title = supabase_upload_id || 'Not Found';
        setBookTitle(title);
        updatePageTitle();
      }
    };

    fetchBookContent();
  }, [supabase_upload_id, updatePageTitle, user]);

  // Handle webnovel registration for authenticated users (only on initial pageload)
  useEffect(() => {
    if (!user || !supabase_upload_id || webnovelRegistrationRef.current) {
      return;
    }

    const registerWebnovel = async () => {
      try {
        const supabase = createClient();

        // Check if this is a webnovel
        const { data: webnovelBook, error: webnovelError } = await supabase
          .from('webnovel')
          .select('id, title')
          .eq('id', supabase_upload_id)
          .maybeSingle();

        if (!webnovelBook) {
          return; // Not a webnovel
        }

        // Mark that we've attempted registration for this webnovel+user
        webnovelRegistrationRef.current = true;

        console.log('[WN-REGISTRATION] User authenticated, adding webnovel to their library...');

        // Check if user already has this webnovel
        const { data: existingUserWebnovel, error: checkError } = await supabase
          .from('user_webnovel')
          .select('webnovel_id')
          .eq('user_id', user.id)
          .eq('webnovel_id', supabase_upload_id)
          .maybeSingle();

        if (checkError) {
          console.warn('[WN-REGISTRATION] Error checking if user has webnovel:', checkError);
          return;
        }

        if (!existingUserWebnovel) {
          // User doesn't have this webnovel yet, add it
          const { error: insertError } = await supabase
            .from('user_webnovel')
            .insert({
              user_id: user.id,
              webnovel_id: supabase_upload_id
            });

          if (insertError) {
            console.warn('[WN-REGISTRATION] Error adding webnovel to user library:', insertError);
          } else {
            console.log('[WN-REGISTRATION] Successfully added webnovel to user library');
            toast.success(`Added "${webnovelBook?.title || 'Webnovel'}" to your library!`);
          }
        } else {
          console.log('[WN-REGISTRATION] User already has this webnovel in their library');
        }
      } catch (error) {
        console.warn('[WN-REGISTRATION] Failed to add webnovel to user library:', error);
      }
    };

    registerWebnovel();
  }, [supabase_upload_id, user?.id]);

  // Update page title when bookTitle changes
  useEffect(() => {
    if (bookTitle && bookTitle !== 'Loading...') {
      updatePageTitle();
    }
  }, [bookTitle, updatePageTitle]);

  const handleTocNavigate = useCallback((pageNumber: number) => {
    const event = new CustomEvent('booknavigate', {
      detail: { page: pageNumber }
    })
    if (typeof window !== 'undefined') {
      window.dispatchEvent(event)
    }

    // Update page title when navigating via TOC
    updatePageTitle(pageNumber);
  }, [updatePageTitle])

  const memoizedTextPane = useMemo(() => (
    <div className="h-full flex">
      <div className="flex-1">
        <TextPane
          ref={setTextPaneRef}
          onSearch={(text, position) => handleSearch(text, position, 'textpane')}
          onBookUpdate={handleBookUpdate}
          onBookmarkChange={setIsAtBookmark}
          currentBook={currentBook}
          initialPage={initialPage}
          userPreferences={userPreferences}
        />
      </div>
    </div>
  ), [handleSearch, handleBookUpdate, currentBook, initialPage, textPaneRef]);

  const isPortraitMode = typeof window !== 'undefined' && window.innerWidth < window.innerHeight;

  const searchPaneContent = (
    <SearchPane
      searchQuery={searchQuery}
      searchResult={searchResult}
      isLoading={isLoading}
      onSearch={(text, position, source) => handleSearch(text, position, source)}
      onBack={(steps = 1) => {
        if (searchStack.length > steps) {
          const newStack = searchStack.slice(0, -steps);
          setSearchStack(newStack);
          const lastSearch = newStack[newStack.length - 1];
          if (lastSearch) {
            setSearchQuery(lastSearch.query);
            setSearchResult(lastSearch.results || null);
            setCurrentClickedPosition(lastSearch.position || -1);
          }
        }
      }}
      stackPosition={`${searchStack.length}/${searchStack.length}`}
      searchStack={searchStack}
      setSearchStack={setSearchStack}
      clickedPosition={currentClickedPosition}
      userPreferences={userPreferences}
      bookTitle={bookTitle}
      isAuthenticated={!!user}
    />
  );


  // Show loading state while authentication is being checked
  if (authLoading) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
        <div className="text-center">
          <div className="text-lg font-medium">Loading...</div>
          <div className="text-sm text-muted-foreground">Please wait while we load your book.</div>
        </div>
      </div>
    );
  }

  // Allow both authenticated and unauthenticated users to read webnovels
  // Auth-gated features (audio, card creation, bookmarks, kanji tracking) will show soft-gate prompts

  return (
    <KanjiModeProvider>
      <SettingsProvider value={settingsContext}>
        <Header
          onNavigate={handleTocNavigate}
          bookTitle={bookTitle}
          isAtBookmark={isAtBookmark}
          isAuthenticated={!!user}
          supabaseUploadId={supabase_upload_id}
          tocEntries={tocEntries}
        />

        {/* Guest user notice card */}
        {!user && !dismissedGuestCard && (
          <GuestUserCard onDismiss={() => setDismissedGuestCard(true)} />
        )}

        <div
          style={{
            paddingLeft: (isPortraitMode && !isIPad) ? '0' : (state === 'collapsed' ? '3rem' : '16rem'),
            paddingTop: '4rem',
            paddingBottom: isPortraitMode ? '0' : '4rem'
          }}
          className="fixed inset-0 transition-all duration-300 overflow-hidden"
        >
          {/* Global scroll columns - positioned at viewport level */}
          {isPortraitMode && (
            <PaginationColumns
              onScrollLeft={() => textPaneRef?.scroll('left')}
              onScrollRight={() => textPaneRef?.scroll('right')}
            />
          )}
          {isPortraitMode ? (
            <>
              <div className="h-[calc(100%-5rem)]">
                {memoizedTextPane}
              </div>
              <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                <DrawerContent>
                  <DrawerTitle className="sr-only">Dictionary Lookup</DrawerTitle>
                  <div className="h-[80vh] overflow-y-auto">
                    {searchPaneContent}
                  </div>
                </DrawerContent>
              </Drawer>
            </>
          ) : (
            <ResizablePanelGroup
              direction="horizontal"
              className="h-[calc(100%-5rem)]"
              onLayout={(sizes) => {
                safeJsonStorage.setItem('reader-panel-sizes', sizes);
              }}
            >
              <ResizablePanel
                defaultSize={(() => {
                  const saved = safeJsonStorage.getItem('reader-panel-sizes', [50, 50]);
                  return saved ? saved[0] : 50;
                })()}
                minSize={20}
              >
                <div className="h-full">
                  {memoizedTextPane}
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel
                defaultSize={(() => {
                  const saved = safeJsonStorage.getItem('reader-panel-sizes', [50, 50]);
                  return saved ? saved[1] : 50;
                })()}
                minSize={20}
              >
                <div className="h-full">
                  {searchPaneContent}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
          {currentBook && (
            <PageFooter
              currentPage={currentBook.currentPage}
              totalPages={currentBook.totalPages}
              tocEntries={tocEntries}
            />
          )}
        </div>

        {/* Render Analyzer for debugging */}
        <RenderAnalyzerComponent />
      </SettingsProvider>
    </KanjiModeProvider>
  )
}
