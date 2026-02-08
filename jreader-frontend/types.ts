export type PaneType = 'none' | 'dictionary' | 'settings' | 'debug' | 'library' | 'toc' | 'kanjiGrid';

export interface VerticalMenuProps {
  activePane: PaneType;
  onPaneChange: (pane: PaneType) => void;
}

export type BookSelectEvent = CustomEvent<{
  supabase_upload_id: string;
  title?: string;
  currentPage: number;
  totalPages: number;
  toc?: Array<{
    label: string;
    contentSrc: string;
    playOrder: number;
    pageNumber: number;
  }>;
}>;

export type SearchUpdateEvent = CustomEvent<{
  text: string;
  position: number;
  shouldOpenDictionary?: boolean;
  fromTextPane?: boolean;
}>;

export interface Book {
  filename: string;
  title?: string;
  author?: string;
  totalPages: number;
  currentPage?: number;
  toc?: Array<{
    label: string;
    contentSrc: string;
    playOrder: number;
    pageNumber: number;
  }>;
} 