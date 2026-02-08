"use client";

import { useTheme } from 'next-themes';
import { useEffect, useState, useRef, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';

import { loadBookContent, type LoadBookContentCallbacks, type LoadBookContentParams } from './LoadBookContent';
import { PaginationColumns } from './PaginationColumns';
import { applySettings, injectSettings } from './Settings';
import { useKanjiStates, KanjiQueryEnabled, SubscriptionCheck } from '../../hooks/useKanjiStates';
import { createKanjiHighlighter } from '../../utils/kanjiHighlighter';

import { useEinkMode } from '@/contexts/EinkModeContext';
import { useKanjiMode } from '@/contexts/KanjiModeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { attachIframeAltKeyHandler } from '@/handlers/iframeAltKeyHandler';
import { createTextPaneClickHandler } from '@/handlers/textPaneClickHandler';
import { useBookmarkManager } from '@/hooks/useBookmarkManager';
import { useDeviceDetect } from '@/hooks/useDeviceDetect';
import type { KanjiStateChangeEvent } from '@/types/events';
import type { Bookmark } from '@/utils/BookmarkManager';
import { isIOS } from '@/utils/deviceDetection';
import { KanjiCycler } from '@/utils/kanjiCycler';
import { kanjiStateToClass } from '@/utils/kanjiState';


export interface TextPaneProps {
  onBookUpdate: (bookInfo: {
    supabase_upload_id: string;
    currentPage: number;
    totalPages: number;
  } | null) => void;
  onBookmarkChange: (isAtBookmark: boolean) => void;
  currentBook: {
    supabase_upload_id: string;
    currentPage: number;
    totalPages: number;
    isWebnovel?: boolean;
  } | null;
  initialPage?: number;
  userPreferences?: {
    shouldHighlightKanjiInText?: boolean;
  } | null;
}

const TextPane = forwardRef<{ scroll: (direction: 'left' | 'right') => void }, TextPaneProps>(({
  onBookUpdate,
  onBookmarkChange,
  currentBook,
  initialPage,
  userPreferences
}, ref) => {
  const { fontSize, verticalMargin } = useSettings();
const { isEinkMode } = useEinkMode();
  const { knownKanji, encounteredKanji, isLoading: kanjiLoading, cycleKanjiState, error: kanjiError } = useKanjiStates(KanjiQueryEnabled.ENABLED, SubscriptionCheck.DONT_CHECK);
  const { theme, resolvedTheme } = useTheme();
  if (kanjiError) {
    console.error('💥 TextPane: Kanji states error:', kanjiError);
    return <div className="text-red-500">Failed to load kanji states: {kanjiError.message}</div>;
  }
  const { isKanjiMode } = useKanjiMode();
  // console.log('TextPane render - isKanjiMode:', isKanjiMode);

  // All state declarations
  const [content, setContent] = useState<{ content: string; contentType: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLayoutReady, setIsLayoutReady] = useState(false);

  // Single ref declaration
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Add this effect to handle iframe load events
  const kanjiCycler = useMemo(() => new KanjiCycler(iframeRef), []);

  // Update kanji cycler highlighting setting when user preferences change
  useEffect(() => {
    const shouldHighlight = userPreferences?.shouldHighlightKanjiInText ?? true;
    kanjiCycler.setShouldHighlight(shouldHighlight);
  }, [userPreferences?.shouldHighlightKanjiInText, kanjiCycler]);

  const {
    getBookmark,
    restoreBookmark,
    isAtBookmark,
    manager
  } = useBookmarkManager({
    currentBook: currentBook ? {
      filename: currentBook.supabase_upload_id,
      currentPage: currentBook.currentPage,
      totalPages: currentBook.totalPages,
      isWebnovel: currentBook.isWebnovel!
    } : null,
    iframeRef
  });

  const injectSettingsCallback = useCallback((newContent: string) => {
    console.log('🎨 injectSettingsCallback called:', {
      hasIframe: !!iframeRef.current?.contentDocument,
      theme,
      contentLength: newContent.length
    });

    if (iframeRef.current?.contentDocument) {
      console.log('🌙 Theme state:', { theme });
      const transformedContent = injectSettings(newContent, fontSize, verticalMargin, theme);
      setContent({ content: transformedContent, contentType: 'text/html' }); // Fixed type here
    } else {
      console.log('❌ no iframe document found');
    }
    return newContent;
  }, [fontSize, verticalMargin, theme]);

  useEffect(() => {
    console.log('[layout] 📄 Content effect triggered:', {
      hasContent: !!content,
      hasIframe: !!iframeRef.current,
      contentLength: content?.content?.length || 0,
      contentType: content?.contentType,
      isWebnovel: currentBook?.supabase_upload_id ? 'checking...' : 'unknown'
    });

    if (!content || !iframeRef.current) {
      console.log('[layout] 📄 Skipping content effect - no content or iframe');
      return;
    }

    // Add initial margin to content to prevent text under columns (the columns for scrolling backward and forward)
    const modifiedContent = content.content.replace(
      '<body',
      '<body style="margin-right: 4rem;margin-left: 4rem;"'
    );

    console.log('[layout] 📄 Setting iframe src with modified content, length:', modifiedContent.length);
    // Reset layout ready state when new content is loading
    setIsLayoutReady(false);

    const blob = new Blob([modifiedContent], {
      type: `${content.contentType};charset=utf-8`
    });
    const blobUrl = URL.createObjectURL(blob);

    // Set up a load handler to apply settings after content loads
    const handleIframeLoad = () => {
      console.log('[layout] 📄 Iframe content loaded, applying settings and kanji highlighting');
      console.log('[layout] 🎨 Theme state:', { theme, resolvedTheme });
      console.log('[layout] 📖 Book info:', {
        supabase_upload_id: currentBook?.supabase_upload_id,
        currentPage: currentBook?.currentPage,
        totalPages: currentBook?.totalPages
      });
      const isDarkMode = resolvedTheme === 'dark';

      if (iframeRef.current?.contentDocument) {
        const doc = iframeRef.current.contentDocument;

        // Apply initial theme settings and kanji highlighting
        console.log('[layout] Applying settings to iframe');
        applySettings(doc, fontSize, verticalMargin, resolvedTheme || 'light');

        // Apply kanji highlighting styles and content
        if (!kanjiLoading && doc.body) {
          console.log('🎨 Applying kanji highlighting to iframe content');
          console.log('📊 Kanji data:', {
            knownKanji: knownKanji.length,
            encounteredKanji: encounteredKanji.length,
            isEinkMode,
            isDarkMode
          });

          // Use kanjiCycler for styles
          const styleElement = doc.createElement('style');
          styleElement.setAttribute('data-kanji-styles', 'true');
          styleElement.textContent = kanjiCycler.getKanjiStyles();
          doc.head.appendChild(styleElement);

          // Set initial e-ink mode
          kanjiCycler.updateEinkMode(isEinkMode);

          // Update theme colors for kanji highlighting
          kanjiCycler.updateThemeColors(resolvedTheme || 'light', isEinkMode);

          // Debug: Check what CSS variables are actually set
          const iframeDoc = iframeRef.current?.contentDocument;
          if (iframeDoc?.documentElement) {
            const encounteredColor = iframeDoc.documentElement.style.getPropertyValue('--kanji-encountered');
            const notMinedColor = iframeDoc.documentElement.style.getPropertyValue('--kanji-not-mined');
            const knownColor = iframeDoc.documentElement.style.getPropertyValue('--kanji-known');
            console.log('🎨 CSS Variables in iframe:', {
              '--kanji-encountered': encounteredColor,
              '--kanji-not-mined': notMinedColor,
              '--kanji-known': knownColor,
              isDarkMode
            });
          }

          // Apply initial kanji highlighting to create the elements
          // The actual styling will be updated dynamically via kanjistatechange events
          const shouldHighlight = userPreferences?.shouldHighlightKanjiInText ?? true;
          const highlighter = createKanjiHighlighter(knownKanji, encounteredKanji, shouldHighlight);
          const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
          const textNodes: Text[] = [];
          let node;
          while (node = walker.nextNode() as Text) {
            textNodes.push(node);
          }
          console.log('📄 Found', textNodes.length, 'text nodes to process');
          textNodes.forEach(node => highlighter.wrapKanji(node));

          console.log('✅ Kanji highlighting applied to', textNodes.length, 'text nodes');

          // Check if any kanji elements were created
          const kanjiElements = doc.querySelectorAll('[data-kanji]');
          console.log('🔍 Found', kanjiElements.length, 'kanji elements after highlighting');
        } else {
          console.log('⚠️ Skipping kanji highlighting:', { kanjiLoading, hasBody: !!doc.body });
        }

        // Firefox fallback: ensure vertical layout is applied to html element
        if (doc.body) {
          setTimeout(() => {
            try {
              const computedStyle = window.getComputedStyle(doc.documentElement);
              if (computedStyle.writingMode === 'horizontal-tb') {
                console.log('[layout] 🦊 Firefox fallback: applying vertical layout to html element');
                doc.documentElement.style.setProperty('writing-mode', 'vertical-rl', 'important');
                doc.documentElement.style.setProperty('text-orientation', 'mixed', 'important');
              } else {
                console.log('[layout] ✓ Writing mode already correct:', computedStyle.writingMode);
              }
            } catch (error) {
              console.log('[layout] ⚠️ Could not check Firefox writing-mode:', error);
            }
            // Mark layout as ready after all layout operations are complete
            console.log('[layout] ✅ Layout is ready, showing iframe');
            setIsLayoutReady(true);
          }, 50);
        } else {
          // If no body, mark ready immediately
          setIsLayoutReady(true);
        }

        // Add scroll detection and event handlers
        const handleScroll = () => {
          console.log('📜 Scroll detected');
          if (!manager.getState().isRestoringBookmark) {
            manager.checkIfAtBookmarkDebounced();
          }
        };

        // Create event handlers inside the effect
        const handleIframeClick = (event: MouseEvent) => {
          if (handleClick) {
            handleClick(event);
          }
        };

        const handleIframeMouseDown = (event: MouseEvent) => {
          if (handleMouseDown) {
            handleMouseDown(event);
          }
        };

        // Add handlers in capture phase
        doc.addEventListener('mousedown', handleIframeMouseDown, true);
        doc.addEventListener('click', handleIframeClick, true);
        doc.addEventListener('scroll', handleScroll, { passive: true });
        doc.documentElement?.addEventListener('scroll', handleScroll, { passive: true });
        console.log('🎭 Added click, mousedown, and scroll handlers with capture');
        console.log('🎭 Handler functions:', {
          hasClickHandler: !!handleClick,
          hasMouseDownHandler: !!handleMouseDown,
          bookId: currentBook?.supabase_upload_id
        });
      }
    };

    if (!iframeRef.current) {
      URL.revokeObjectURL(blobUrl);
      return;
    }

    iframeRef.current.addEventListener('load', handleIframeLoad);
    iframeRef.current.src = blobUrl;

    return () => {
      iframeRef.current?.removeEventListener('load', handleIframeLoad);
      URL.revokeObjectURL(blobUrl);
    };
  }, [content, fontSize, verticalMargin, kanjiLoading, kanjiCycler, manager, userPreferences?.shouldHighlightKanjiInText, theme, resolvedTheme, isEinkMode, currentBook?.supabase_upload_id, currentBook?.currentPage, currentBook?.totalPages]);

  // Separate effect to handle kanji state changes and theme changes without reloading content
  useEffect(() => {
    if (!iframeRef.current?.contentDocument?.body || kanjiLoading) return;

    const doc = iframeRef.current.contentDocument;

    // Update theme settings when theme changes
    applySettings(doc, fontSize, verticalMargin, resolvedTheme || 'light');

    // Update kanji highlighting styles when kanji state arrays or theme change
    const styleElement = doc.querySelector('style[data-kanji-styles]');
    if (styleElement) {
      styleElement.textContent = kanjiCycler.getKanjiStyles();
    }

    // Update e-ink mode when it changes
    kanjiCycler.updateEinkMode(isEinkMode);

    // Update theme colors for kanji highlighting
    kanjiCycler.updateThemeColors(resolvedTheme || 'light', isEinkMode);

    // Update all existing kanji elements with current state
    const shouldHighlight = userPreferences?.shouldHighlightKanjiInText ?? true;
    const kanjiElements = doc.querySelectorAll('[data-kanji]');
    kanjiElements.forEach(element => {
      const kanji = element.getAttribute('data-kanji');
      if (kanji) {
        let state: number;
        if (knownKanji.includes(kanji)) {
          state = 1; // KNOWN
        } else if (encounteredKanji.includes(kanji)) {
          state = 0; // ENCOUNTERED
        } else {
          state = -1; // NOT_MINED
        }

        // Always remove existing classes to ensure clean state
        element.classList.remove('kanji-known', 'kanji-encountered', 'kanji-not-mined');

        // Only add highlighting classes if highlighting is enabled
        if (shouldHighlight) {
          element.classList.add(`kanji-${kanjiStateToClass(state)}`);
        }
        // Note: The data-kanji attribute and click functionality remain regardless of highlighting setting
      }
    });

    console.log('🔄 Updated theme and kanji highlighting for', kanjiElements.length, 'elements (highlighting enabled:', shouldHighlight, ')');
  }, [knownKanji, encounteredKanji, resolvedTheme, fontSize, verticalMargin, isEinkMode, kanjiLoading, kanjiCycler, userPreferences?.shouldHighlightKanjiInText]);

  // Effect to ensure e-ink mode is applied immediately when content loads
  useEffect(() => {
    if (!iframeRef.current?.contentDocument?.body) return;

    // Apply e-ink mode immediately to prevent flash of normal highlighting
    kanjiCycler.updateEinkMode(isEinkMode);
    kanjiCycler.updateThemeColors(resolvedTheme || 'light', isEinkMode);

    console.log('⚡ Applied e-ink mode immediately:', isEinkMode);
  }, [isEinkMode, resolvedTheme, kanjiCycler]);

  // Define the callback at component level
  const restorePosition = useCallback(async (bookmarkToRestore: Bookmark) => {
    console.log('Attempting to restore position...');

    // Wait for iframe to be ready
    const waitForIframe = () => {
      if (iframeRef.current?.contentDocument?.readyState === 'complete') {
        console.log('Iframe ready, restoring bookmark');
        restoreBookmark(bookmarkToRestore);
        // Only check bookmark position once after restoration
        setTimeout(() => {
          manager.checkIfAtBookmark();
        }, 100);
      } else {
        console.log('Iframe not ready, retrying in 100ms');
        setTimeout(waitForIframe, 100);
      }
    };

    waitForIframe();
  }, [restoreBookmark, iframeRef, manager]);

  // 3. Finally loadBookContent which depends on both
  const loadBookContentCallback = useCallback(async (supabase_upload_id: string, page?: number) => {
    const pageToUse = page !== undefined ? page : (initialPage ?? 0);
    const params: LoadBookContentParams = {
      supabase_upload_id,
      iframeRef,
      injectSettingsCallback,
      page: pageToUse
    };

    const callbacks: LoadBookContentCallbacks = {
      getBookmark,
      restorePosition,
      setIsLoading,
      setError,
      setContent,
      setCurrentBook: onBookUpdate
    };

    loadBookContent(params, callbacks);
  }, [injectSettingsCallback, getBookmark, restorePosition, onBookUpdate, initialPage]);

  // Effects
  useEffect(() => {
    const handleBookSelect = async (e: CustomEvent<{
      supabase_upload_id: string;
      currentPage: number;
      totalPages: number;
    }>) => {
      try {
        const book = e.detail;
        await loadBookContentCallback(book.supabase_upload_id, book.currentPage);
      } catch (error) {
        console.error('Failed to load book content:', error);
        setError(error instanceof Error ? error.message : 'Failed to load book content');
      }
    };

    window.addEventListener('bookselect', handleBookSelect as unknown as EventListener);
    return () => {
      window.removeEventListener('bookselect', handleBookSelect as unknown as EventListener);
    };
  }, [loadBookContentCallback]);

  // Add this handler back
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (event.altKey) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }, []);

  // OLD EFFECT - REMOVED: Kanji highlighting is now handled in the content effect
  // useEffect(() => {
  //   if (!iframeRef.current) return;

  //   const handleIframeLoad = () => {
  //     const doc = iframeRef.current?.contentDocument;
  //     if (!doc?.body || kanjiLoading) return;

  //     // Use kanjiCycler for styles
  //     const styleElement = doc.createElement('style');
  //     styleElement.setAttribute('data-kanji-styles', 'true');
  //     styleElement.textContent = kanjiCycler.getKanjiStyles();
  //     doc.head.appendChild(styleElement);

  //     // Set initial e-ink mode
  //     kanjiCycler.updateEinkMode(isEinkMode);

  //     // Always apply kanji highlighting to create the elements, but styling will be controlled by CSS
  //     const highlighter = createKanjiHighlighter(knownKanji, encounteredKanji);
  //     const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  //     const textNodes: Text[] = [];
  //     let node;
  //     while (node = walker.nextNode() as Text) {
  //       textNodes.push(node);
  //     }
  //     textNodes.forEach(node => highlighter.wrapKanji(node));

  //     // Add scroll detection
  //     const handleScroll = () => {
  //       console.log('📜 Scroll detected');
  //       if (!manager.getState().isRestoringBookmark) {
  //         manager.checkIfAtBookmarkDebounced();
  //       }
  //     };

  //     // Remove any existing handlers
  //     doc.removeEventListener('click', handleClick, true);
  //     doc.removeEventListener('mousedown', handleMouseDown, true);
  //     doc.removeEventListener('scroll', handleScroll);

  //     // Add handlers in capture phase
  //     doc.addEventListener('mousedown', handleMouseDown, true);
  //     doc.addEventListener('click', handleClick, true);
  //     doc.addEventListener('scroll', handleScroll, { passive: true });
  //     doc.documentElement?.addEventListener('scroll', handleScroll, { passive: true });
  //     console.log('🎭 Added click, mousedown, and scroll handlers with capture');
  //   };

  //   iframeRef.current.addEventListener('load', handleIframeLoad);

  //   return () => {
  //     iframeRef.current?.removeEventListener('load', handleIframeLoad);
  //   };
  // }, [kanjiLoading, kanjiCycler, manager, isEinkMode]);

  // Handle e-ink mode changes
  useEffect(() => {
    kanjiCycler.updateEinkMode(isEinkMode);
  }, [isEinkMode, kanjiCycler]);

  // Handle theme changes
  useEffect(() => {
    const theme = resolvedTheme || 'light';
    kanjiCycler.updateThemeColors(theme, isEinkMode);
  }, [resolvedTheme, isEinkMode, kanjiCycler]);

  // Create a ref to hold the current mode
  const kanjiModeRef = useRef(isKanjiMode);

  // Keep the ref updated
  useEffect(() => {
    kanjiModeRef.current = isKanjiMode;
  }, [isKanjiMode]);

  const handleClick = useMemo(
    () => createTextPaneClickHandler(
      () => kanjiModeRef.current,
      kanjiCycler,
      cycleKanjiState
    ),
    [kanjiCycler, cycleKanjiState]
  );

  useEffect(() => {
    const cleanup = attachIframeAltKeyHandler(iframeRef);
    return cleanup;
  }, []);

  useEffect(() => {
    console.log('[layout] 🎭 Setting up kanjistatechange listener');
    const handleKanjiStateChange = (event: KanjiStateChangeEvent) => {
      const { kanji, newState } = event.detail;
      console.log('[layout] 👂 Received kanjistatechange event:', { kanji, newState });

      const doc = iframeRef.current?.contentDocument;
      if (!doc) {
        console.log('[layout] ❌ No iframe document available');
        return;
      }

      // Check current writing mode before making changes
      const computedStyle = window.getComputedStyle(doc.documentElement);
      console.log('[layout] Current writing-mode before update:', computedStyle.writingMode);

      // Preserve vertical layout by ensuring writing-mode is maintained
      if (doc.documentElement) {
        const currentWritingMode = doc.documentElement.style.writingMode;
        if (!currentWritingMode || currentWritingMode === 'horizontal-tb') {
          console.log('[layout] 🔧 Re-applying vertical-rl writing mode during kanji state change');
          doc.documentElement.style.setProperty('writing-mode', 'vertical-rl', 'important');
          doc.documentElement.style.setProperty('text-orientation', 'mixed', 'important');
        } else {
          console.log('[layout] ✓ Writing mode preserved:', currentWritingMode);
        }
      }

      const elements = doc.querySelectorAll(`[data-kanji="${kanji}"]`);
      console.log(`[layout] 🔍 Found ${elements.length} elements to update`);

      elements.forEach(element => {
        element.classList.remove('kanji-known', 'kanji-encountered', 'kanji-not-mined');
        element.classList.add(`kanji-${kanjiStateToClass(newState)}`);
      });

      // Verify writing mode after DOM updates
      const computedStyleAfter = window.getComputedStyle(doc.documentElement);
      console.log('[layout] Writing-mode after update:', computedStyleAfter.writingMode);
    };

    window.addEventListener('kanjistatechange', handleKanjiStateChange as EventListener);
    return () => {
      window.removeEventListener('kanjistatechange', handleKanjiStateChange as EventListener);
      console.log('🧹 TextPane: Cleaned up kanjistatechange listener');
    };
  }, [iframeRef]);

  useEffect(() => {
    const handleSearchUpdate = async (e: CustomEvent<{ text: string; position: number }>) => {
      console.log('🔍 TextPane: Search triggered for:', e.detail.text);
      // Log the current iframe content state
      // console.log('📄 TextPane: Current iframe content:', iframeRef.current?.contentDocument?.body?.innerHTML);
    };

    window.addEventListener('searchupdate', handleSearchUpdate as unknown as EventListener);
    return () => {
      window.removeEventListener('searchupdate', handleSearchUpdate as unknown as EventListener);
    };
  }, []);

  useEffect(() => {
    onBookmarkChange(isAtBookmark);
  }, [isAtBookmark, onBookmarkChange]);

  // Add navigation handler
  useEffect(() => {
    const handleBookNavigate = (e: CustomEvent<{ page: number }>) => {
      loadBookContentCallback(currentBook?.supabase_upload_id || '', e.detail.page);
    };

    window.addEventListener('booknavigate', handleBookNavigate as EventListener);
    return () => {
      window.removeEventListener('booknavigate', handleBookNavigate as EventListener);
    };
  }, [currentBook, loadBookContentCallback]);

  const isMobile = useDeviceDetect();
  const isPortraitMode = typeof window !== 'undefined' && window.innerWidth < window.innerHeight;


  // Touch handling effect - only prevent scrolling on iOS
  useEffect(() => {
    if (!isIOS()) return;

    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;

    // Only prevent scrolling/swiping on iOS, not clicks
    const preventScroll = (e: TouchEvent) => {
      if (e.type === 'touchstart') {
        const doc = iframe.contentDocument;
        if (!doc) return;

        const startX = e.touches[0]!.clientX;
        const startY = e.touches[0]!.clientY;

        const checkForScroll = (moveEvent: TouchEvent) => {
          const moveX = moveEvent.touches[0]!.clientX;
          const moveY = moveEvent.touches[0]!.clientY;

          if (Math.abs(moveX - startX) > 5 || Math.abs(moveY - startY) > 5) {
            moveEvent.preventDefault();
          }

          doc.removeEventListener('touchmove', checkForScroll);
        };

        doc.addEventListener('touchmove', checkForScroll, { passive: false });
      }
    };

    const handleLoad = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;

      doc.addEventListener('touchstart', preventScroll, { passive: true });
    };

    iframe.addEventListener('load', handleLoad);
    return () => {
      const doc = iframe.contentDocument;
      if (doc) {
        doc.removeEventListener('touchstart', preventScroll);
      }
      iframe.removeEventListener('load', handleLoad);
    };
  }, [isMobile]);

  // For manual navigation buttons
  const handleScroll = useCallback((direction: 'left' | 'right') => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc?.body || !iframe) return;

    manager.startScroll();

    const viewportWidth = iframe.clientWidth;
    const columnWidth = 24; // w-6 = 24px
    const scrollableWidth = viewportWidth - (2 * columnWidth);
    const currentScroll = doc.documentElement.scrollLeft;
    const scrollAmount = scrollableWidth * 0.9;

    doc.documentElement.scrollTo({
      left: currentScroll + (direction === 'right' ? scrollAmount : -scrollAmount),
      behavior: isEinkMode ? 'auto' : 'smooth'
    });

    // Wait for scroll to complete (shorter timeout for e-ink mode)
    setTimeout(() => {
      manager.endScroll();
    }, isEinkMode ? 50 : 500); // Much faster for e-ink mode
  }, [manager, isEinkMode]);

  // For scroll event detection
  useEffect(() => {
    if (!iframeRef.current?.contentDocument) return;

    const doc = iframeRef.current.contentDocument;
    const handleScrollEvent = () => {
      console.log('📜 Scroll detected');
      manager.startScroll();

      if (!manager.getState().isRestoringBookmark) {
        manager.checkIfAtBookmarkDebounced();
      }
    };

    doc.addEventListener('scroll', handleScrollEvent, { passive: true });
    doc.documentElement?.addEventListener('scroll', handleScrollEvent, { passive: true });

    return () => {
      doc.removeEventListener('scroll', handleScrollEvent);
      doc.documentElement?.removeEventListener('scroll', handleScrollEvent);
    };
  }, [iframeRef, manager]);

  // Expose scroll method to parent
  useImperativeHandle(ref, () => ({
    scroll: handleScroll
  }), [handleScroll]);

  return (
    <div className="h-full flex flex-col">
      {isLoading && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
        </div>
      )}

      {error && (
        <div className="absolute top-0 left-0 right-0 p-4 text-red-500">
          {error}
        </div>
      )}

      <div
        className="flex-1 relative overflow-visible bg-background"
        style={{
          paddingTop: `${verticalMargin}vh`,
          paddingBottom: `${verticalMargin}vh`
        }}
      >
        {/* Wrapper to maintain scroll column positions */}
        <div className="absolute inset-0 bg-background">
          {!isLayoutReady && (
            <div className="w-full h-full bg-background animate-pulse" />
          )}
          <iframe
            ref={iframeRef}
            className="w-full h-full bg-background"
            src="about:blank"
            title="Reader content"
            scrolling={isIOS() ? "no" : "auto"}
            style={{
              backgroundColor: 'transparent',
              visibility: isLayoutReady ? 'visible' : 'hidden'
            }}
          />
        </div>

        {/* Pagination columns for landscape mode */}
        {!isPortraitMode && (
          <PaginationColumns
            onScrollLeft={() => handleScroll('left')}
            onScrollRight={() => handleScroll('right')}
          />
        )}
      </div>
    </div>
  );
});

export default TextPane;
