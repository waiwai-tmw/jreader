import type { Bookmark } from "@/utils/BookmarkManager";

export interface LoadBookContentCallbacks {
  getBookmark: (filename: string) => Promise<Bookmark | null>;
  restorePosition: (bookmark: Bookmark) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
  setContent: (content: string) => void;
  setCurrentBook: (book: BookInfo | null) => void;
} 