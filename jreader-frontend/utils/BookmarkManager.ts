import { safeStorage } from '@/utils/safeStorage';
import { createClient } from '@/utils/supabase/client';

export interface Book {
  filename: string;
  currentPage: number;
  totalPages: number;
  title?: string;
  isWebnovel?: boolean;
}

export interface Bookmark {
  filename: string;
  page: number;
  visibleText: string;
  timestamp: number;
  paragraphIndex: number;
}

interface BookmarkStorage {
  [key: string]: Bookmark;
}

export class BookmarkManager {
  private STORAGE_KEY = 'reader-bookmarks';
  private isRestoringBookmark: boolean = false;
  private isNavigating: boolean = false;
  private isInitialLoad: boolean = true;
  private isAtBookmark: boolean = false;
  private stateChangeCallback?: () => void;
  private lastParagraphIndex: number = -1;
  private supabase = createClient();
  private bookmarkCache: Map<string, { bookmark: Bookmark | null, timestamp: number }> = new Map();
  private scrollDebounceTimeout?: NodeJS.Timeout;
  private CACHE_TTL = 5000; // 5 seconds
  private checkInProgress: boolean = false;
  private isScrolling: boolean = false;

  constructor(
    private currentBook: Book | null,
    private iframeRef: React.RefObject<HTMLIFrameElement>,
    onStateChange?: () => void
  ) {
    this.stateChangeCallback = onStateChange;
  }

  private notifyStateChange() {
    if (this.stateChangeCallback) {
      this.stateChangeCallback();
    }
  }

  public updateProps(currentBook: Book | null, iframeRef: React.RefObject<HTMLIFrameElement>) {
    this.currentBook = currentBook;
    this.iframeRef = iframeRef;
    if (currentBook) {
      this.checkIfAtBookmark();
    }
  }

  public async getBookmark(filename: string): Promise<Bookmark | null> {
    // Check cache first
    const cached = this.bookmarkCache.get(filename);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      // console.log('getBookmark: Cache hit', cached.bookmark);
      return cached.bookmark;
    }

    try {
      // Get current user session
      const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();
      if (sessionError || !session) {
        console.log('getBookmark: No active session, skipping bookmark operations');
        this.bookmarkCache.set(filename, { bookmark: null, timestamp: Date.now() });
        return null;
      }

      // Add timeout for mobile browsers
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Bookmark fetch timeout after 8 seconds')), 8000);
      });
      
      const fetchPromise = this.supabase
        .from('Bookmarks')
        .select('page_number, visible_text')
        .eq('user_id', session.user.id)
        .eq('upload_id', filename)
        .maybeSingle();
      
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (error) {
        console.log('getBookmark: Supabase error, falling back to localStorage', error);
        const localBookmark = this.getLocalBookmark(filename);
        this.bookmarkCache.set(filename, { bookmark: localBookmark, timestamp: Date.now() });
        return localBookmark;
      } else {
        console.log('getBookmark: Supabase bookmark found', data);
      }

      const bookmark = data ? {
        filename,
        page: data.page_number,
        visibleText: data.visible_text ?? '',
        timestamp: Date.now()
      } : null;

      this.bookmarkCache.set(filename, { bookmark, timestamp: Date.now() });
      return bookmark;

    } catch (error) {
      console.log('getBookmark: Error getting bookmark, falling back to localStorage', error);
      const localBookmark = this.getLocalBookmark(filename);
      this.bookmarkCache.set(filename, { bookmark: localBookmark, timestamp: Date.now() });
      return localBookmark;
    }
  }

  private getLocalBookmark(filename: string): Bookmark | null {
    try {
      const bookmarks: BookmarkStorage = JSON.parse(safeStorage.getItem(this.STORAGE_KEY) || '{}');
      return bookmarks[filename] || null;
    } catch (error) {
      console.log('getLocalBookmark: Failed to get local bookmark', error);
      return null;
    }
  }

  public getRightmostVisibleText(): string | null {
    const doc = this.iframeRef.current?.contentDocument;
    if (!doc || !doc.body) {
      console.log('getRightmostVisibleText: No iframe document or body available');
      return null;
    }

    try {
      let maxRight = -1;
      let rightmostNode = null;
      const iframe = this.iframeRef.current;
      const iframeRect = iframe?.getBoundingClientRect();

      // Just get text nodes
      const walker = document.createTreeWalker(
        doc.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
          }
        }
      );

      let node = walker.nextNode();
      while (node) {
        const range = doc.createRange();
        range.selectNodeContents(node);
        const rects = range.getClientRects();

        for (const rect of rects) {
          const isVisible = 
            rect.top >= 0 && 
            rect.left >= 0 && 
            rect.bottom <= (iframeRect?.height || 0) &&
            rect.right <= (iframeRect?.width || 0);

          if (isVisible && rect.right > maxRight) {
            maxRight = rect.right;
            rightmostNode = node;
          }
        }
        node = walker.nextNode();
      }

      if (rightmostNode) {
        // Find the containing paragraph
        const paragraph = rightmostNode.parentElement?.closest('p');
        if (paragraph) {
          // Get all text from the paragraph
          const text = paragraph.textContent?.trim() || '';
          
          // Get the index of this paragraph
          const paragraphs = doc.body.getElementsByTagName('p');
          const paragraphIndex = Array.from(paragraphs).indexOf(paragraph);
          
          // console.log('getRightmostVisibleText: Found rightmost paragraph', { 
          //   text,
          //   paragraphIndex,
          //   maxRight 
          // });

          // Store the paragraph index when saving the bookmark
          this.lastParagraphIndex = paragraphIndex;
          
          return text;
        }
      }
      return null;
    } catch (error) {
      console.log('getRightmostVisibleText: Error getting text', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        hasIframe: !!this.iframeRef.current,
        hasContentDoc: !!this.iframeRef.current?.contentDocument
      });
      return null;
    }
  }

  private isScrolledAwayFromBookmark(): boolean {
    if (!this.iframeRef.current?.contentDocument || this.lastParagraphIndex === -1) {
      return false;
    }

    const paragraphs = this.iframeRef.current.contentDocument.getElementsByTagName('p');
    const bookmarkedParagraph = paragraphs[this.lastParagraphIndex];
    
    if (!bookmarkedParagraph) return true;

    const rect = bookmarkedParagraph.getBoundingClientRect();
    const iframeRect = this.iframeRef.current.getBoundingClientRect();
    
    // Consider "scrolled away" if the paragraph is more than 100px outside the viewport
    const threshold = 100;
    const isOutOfView = 
      rect.bottom < -threshold || 
      rect.top > iframeRect.height + threshold;

    return isOutOfView;
  }

  public async checkIfAtBookmark(): Promise<boolean> {
    if (!this.currentBook || this.checkInProgress) return false;
    
    this.checkInProgress = true;
    try {
      const bookmark = await this.getBookmark(this.currentBook.filename);
      const currentText = this.getRightmostVisibleText();
      
      console.log('Checking bookmark position, called from:', new Error().stack?.split('\n').slice(0, 6).join('\n'));
      console.log('Current state:', {
        currentText: currentText?.slice(0, 50) + '...',
        bookmarkText: bookmark?.visibleText?.slice(0, 50) + '...',
        isAtBookmark: this.isAtBookmark,
        isRestoring: this.isRestoringBookmark,
        isNavigating: this.isNavigating,
        caller: new Error().stack?.split('\n')[2]?.trim()
      });

      if (!currentText) return false;

      // If we're not at the bookmark and we've stopped scrolling, save new position
      if (!this.isScrolling && currentText !== bookmark?.visibleText) {
        await this.saveBookmark();
        console.log('📚 Saved new bookmark position');
        
        // After saving, we should be at the bookmark position
        this.isAtBookmark = true;
        this.notifyStateChange();
        return true;
      }

      // Check if we're at the bookmark position
      const isAt = bookmark ? 
        (bookmark.page === this.currentBook.currentPage && 
         currentText.includes(bookmark.visibleText)) : 
        false;
      
      if (this.isAtBookmark !== isAt) {
        console.log('Bookmark state changing:', { wasAt: this.isAtBookmark, nowAt: isAt });
        this.isAtBookmark = isAt;
        this.notifyStateChange();
      }
      
      return isAt;
    } catch (error) {
      console.log('checkIfAtBookmark: Error checking bookmark', error);
      return false;
    } finally {
      setTimeout(() => {
        this.checkInProgress = false;
      }, 100);
    }
  }

  public async checkIfAtBookmarkDebounced(): Promise<void> {
    if (this.isRestoringBookmark) {
      console.log('Skipping check during bookmark restoration');
      return;
    }

    // Clear any existing timeout
    if (this.scrollDebounceTimeout) {
      clearTimeout(this.scrollDebounceTimeout);
    }

    // Set isAtBookmark to false immediately when scrolling starts
    this.isAtBookmark = false;
    this.notifyStateChange();

    // Then debounce the actual position check
    this.scrollDebounceTimeout = setTimeout(async () => {
      console.log('Scroll stopped, checking bookmark position...');
      await this.checkIfAtBookmark();
    }, 300);
  }

  public async saveBookmark(): Promise<void> {
    if (!this.currentBook) {
      console.log('saveBookmark: No current book available');
      return;
    }

    // Get current user session
    const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();
    if (sessionError || !session) {
      console.log('saveBookmark: No active session, skipping bookmark save');
      return;
    }

    const visibleText = this.getRightmostVisibleText();
    if (!visibleText) {
      console.log('saveBookmark: No visible text to save');
      return;
    }

    console.log('saveBookmark: Saving bookmark with text:', visibleText.slice(0, 100) + '...');

    try {
      const bookmark = {
        user_id: session!.user.id,
        upload_id: this.currentBook.filename,
        page_number: this.currentBook.currentPage,
        visible_text: visibleText,
        book_type: this.currentBook.isWebnovel ? 'WEBNOVEL' : 'REGULAR'
      };

      // Add timeout for mobile browsers that might have slower network connections
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Bookmark save timeout after 10 seconds')), 10000);
      });

      const upsertPromise = this.supabase
        .from('Bookmarks')
        .upsert(bookmark, { onConflict: 'user_id,upload_id' });

      const { error } = await Promise.race([upsertPromise, timeoutPromise]) as any;

      if (error) throw error;
      console.log('saveBookmark: Successfully saved to Supabase');
    } catch (error) {
      console.error('saveBookmark: Failed to save bookmark:', error);
    }
  }

  private saveLocalBookmark(bookmark: { user_id: string; upload_id: string; page_number: number; visible_text: string | null; book_type?: string }): void {
    try {
      const bookmarks: BookmarkStorage = JSON.parse(safeStorage.getItem(this.STORAGE_KEY) || '{}');
      bookmarks[bookmark.upload_id] = {
        filename: bookmark.upload_id,
        page: bookmark.page_number,
        visibleText: bookmark.visible_text || '',
        timestamp: Date.now()
      };
      safeStorage.setItem(this.STORAGE_KEY, JSON.stringify(bookmarks));
    } catch (error) {
      console.log('saveLocalBookmark: Failed to save local bookmark', error);
    }
  }

  public startNavigation(): void {
    console.log('BookmarkManager: Starting navigation');
    this.isNavigating = true;
  }

  public endNavigation(page?: number): void {
    console.log('BookmarkManager: Ending navigation');
    this.isNavigating = false;
    if (page !== undefined) {
      this.saveBookmark();
    }
  }

  public async restoreBookmark(bookmark: Bookmark): Promise<void> {
    console.log('restoreBookmark: Starting restoration process', bookmark);
    this.isRestoringBookmark = true;

    try {
      const doc = this.iframeRef.current?.contentDocument;
      if (!doc || !doc.body) {
        console.log('restoreBookmark: No iframe document or body available');
        this.isRestoringBookmark = false;
        return;
      }

      // Find the paragraph containing the bookmarked text
      const paragraphs = doc.body.getElementsByTagName('p');
      let targetParagraph: Element | null = null;

      if (bookmark.visibleText) {
        for (let i = 0; i < paragraphs.length; i++) {
          if (paragraphs[i].textContent?.includes(bookmark.visibleText)) {
            targetParagraph = paragraphs[i];
            this.lastParagraphIndex = i;
            break;
          }
        }
      }

      if (targetParagraph) {
        console.log('restoreBookmark: Found matching paragraph');
        
        // Scroll to paragraph
        targetParagraph.scrollIntoView({
          block: 'start',
          inline: 'nearest',
          behavior: 'auto'
        });

        // Adjust for left column width (24px = 1.5rem = w-6)
        doc.documentElement.scrollLeft += 24;
      }

      setTimeout(() => {
        this.isRestoringBookmark = false;
        this.checkIfAtBookmark();
      }, 100);

    } catch (error) {
      console.log('restoreBookmark: Error during restoration', error);
      this.isRestoringBookmark = false;
    }
  }

  public startScroll(): void {
    if (!this.isScrolling) {
      this.isScrolling = true;
      this.isAtBookmark = false;
      this.notifyStateChange();
    }
  }

  public endScroll(): void {
    if (this.isScrolling) {
      this.isScrolling = false;
      this.checkIfAtBookmark();
    }
  }

  public getState() {
    return {
      isAtBookmark: this.isAtBookmark,
      isNavigating: this.isNavigating,
      isRestoringBookmark: this.isRestoringBookmark,
      isInitialLoad: this.isInitialLoad,
      isScrolling: this.isScrolling,
    };
  }
} 