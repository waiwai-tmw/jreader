import type { Book } from "@/types";


export type NavigationParams = {
    page: number;
    currentBook: Book;
    iframeRef: React.RefObject<HTMLIFrameElement>;
  }
  
export type NavigationCallbacks = {
    injectSettingsCallback: (content: string) => string;
    setIsLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
    setContent: (content: string) => void;
    setCurrentBook: (book: Book | null) => void;
    startNavigation: () => void;
    endNavigation: () => void;
}  
