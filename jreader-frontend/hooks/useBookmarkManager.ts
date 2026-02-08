import { useRef, useEffect, useCallback, useState } from 'react';

import { BookmarkManager, type Book, type Bookmark } from '../utils/BookmarkManager';

interface BookmarkManagerProps {
  currentBook: Book | null;
  iframeRef: React.RefObject<HTMLIFrameElement>;
}

export function useBookmarkManager({ currentBook, iframeRef }: BookmarkManagerProps) {
  const [isAtBookmark, setIsAtBookmark] = useState(false);
  const managerRef = useRef<BookmarkManager | null>(null);
  
  // Create or update the manager instance
  if (!managerRef.current) {
    managerRef.current = new BookmarkManager(
      currentBook, 
      iframeRef,
      () => {
        if (managerRef.current) {
          setIsAtBookmark(managerRef.current.getState().isAtBookmark);
        }
      }
    );
  } else {
    managerRef.current.updateProps(currentBook, iframeRef);
  }

  const manager = managerRef.current;

  // Initial state sync and bookmark check
  useEffect(() => {
    if (manager && currentBook) {
      manager.checkIfAtBookmark().then(() => {
        setIsAtBookmark(manager.getState().isAtBookmark);
      });
    }
  }, [manager, currentBook]);

  // Add console.log logging for state changes
  useEffect(() => {
    console.log('Bookmark state changed:', { isAtBookmark });
  }, [isAtBookmark]);

  // Set up scroll listeners
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc || !currentBook) {
      console.log('Bookmark effect: No current book, skipping setup');
      return;
    }

    const handleScroll = () => {
      if (manager.getState().isRestoringBookmark) {
        console.log('Scroll handler: Ignoring scroll during restoration');
        return;
      }
      manager.checkIfAtBookmarkDebounced();
    };

    doc.addEventListener('scroll', handleScroll, { passive: true });
    // console.log('Bookmark effect: Document scroll listeners attached');

    return () => {
      doc.removeEventListener('scroll', handleScroll);
      // console.log('Bookmark effect: Cleaning up scroll listeners');
    };
  }, [currentBook, iframeRef]);

  const getVisibleText = useCallback((doc: Document): string | null => {
    if (!doc?.body) return null;

    // Get all text nodes, including those wrapped in kanji-highlight spans
    const walker = document.createTreeWalker(
      doc.body,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
          if (node.nodeType === Node.ELEMENT_NODE && 
              (node as Element).classList.contains('kanji-highlight')) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    let visibleText = '';
    let node;
    
    while (node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        visibleText += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE && 
                 (node as Element).classList.contains('kanji-highlight')) {
        visibleText += node.textContent;
      }
    }

    // Clean up the text
    visibleText = visibleText.trim().replace(/\s+/g, ' ');
    
    if (visibleText.length > 20) {
      visibleText = visibleText.substring(0, 20);
    }

    console.log('Found visible text:', visibleText);
    return visibleText || null;
  }, []);

  const checkIfAtBookmark = useCallback((bookmark: Bookmark): boolean => {
    if (!iframeRef.current?.contentDocument) return false;
    
    const visibleText = getVisibleText(iframeRef.current.contentDocument);
    if (!visibleText) {
      console.log('checkIfAtBookmark: No visible text found');
      return false;
    }

    // Make the comparison more lenient by trimming and normalizing spaces
    const normalizedVisible = visibleText.trim().replace(/\s+/g, ' ');
    const normalizedBookmark = bookmark.visibleText.trim().replace(/\s+/g, ' ');
    
    return normalizedVisible.includes(normalizedBookmark);
  }, [getVisibleText, iframeRef]);

  // Return memoized methods and current state
  return {
    getBookmark: useCallback((filename: string) => 
      manager.getBookmark(filename), [manager]),
    restoreBookmark: useCallback((bookmark: Bookmark) => 
      manager.restoreBookmark(bookmark), [manager]),
    saveBookmark: useCallback((forcePage?: number) => 
      manager.saveBookmark(forcePage), [manager]),
    startNavigation: useCallback(() => 
      manager.startNavigation()),
    endNavigation: useCallback((page?: number) => 
      manager.endNavigation(page)),
    isAtBookmark,
    manager: managerRef.current
  };
} 