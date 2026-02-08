import type { SyosetuApiResponse } from './syosetuApi';
import { fetchSyosetuMetadata } from './syosetuApi';
import { extractNcodeFromUrl } from './syosetuGenres';

export interface ImportProgress {
  id: string;
  user_id: string;
  url: string;
  status: string | { Failed: string };
  logs: string[];
  started_at: string;
  updated_at: string;
  process_id?: number;
  total_chapters?: number;
  current_chapter?: number;
}

export interface DisplayInfo {
  title: string;
  ncode: string | null;
  originalUrl: string;
  isLoading: boolean;
}

/**
 * Format the display title for an import with metadata, ncode, and loading states
 */
export function formatDisplayTitle(
  importItem: ImportProgress,
  bookMetadata: Map<string, SyosetuApiResponse>,
  fetchingMetadata: Set<string>
): DisplayInfo {
  const metadata = bookMetadata.get(importItem.id);
  const ncode = extractNcodeFromUrl(importItem.url);
  const isLoading = fetchingMetadata.has(importItem.id);
  
  if (metadata && metadata.title) {
    // Truncate title if it's too long (more than 50 characters)
    const truncatedTitle = metadata.title.length > 50 
      ? metadata.title.substring(0, 50) + '...' 
      : metadata.title;
    
    return {
      title: truncatedTitle,
      ncode: ncode,
      originalUrl: importItem.url,
      isLoading: false
    };
  }
  
  // Show loading state if we're fetching metadata
  if (isLoading) {
    return {
      title: 'Loading...',
      ncode: ncode,
      originalUrl: importItem.url,
      isLoading: true
    };
  }
  
  // Fallback to URL if no metadata available and not loading
  return {
    title: importItem.url,
    ncode: ncode,
    originalUrl: importItem.url,
    isLoading: false
  };
}

/**
 * Fetch book metadata for new imports only
 */
export async function fetchBookMetadataForNewImports(
  newImports: ImportProgress[],
  bookMetadata: Map<string, SyosetuApiResponse>,
  fetchingMetadata: Set<string>,
  setBookMetadata: (updater: (prev: Map<string, SyosetuApiResponse>) => Map<string, SyosetuApiResponse>) => void,
  setFetchingMetadata: (updater: (prev: Set<string>) => Set<string>) => void
): Promise<void> {
  for (const imp of newImports) {
    // Skip if we already have metadata for this import
    if (bookMetadata.has(imp.id)) {
      continue;
    }
    
    // Skip if we're already fetching metadata for this import
    if (fetchingMetadata.has(imp.id)) {
      continue;
    }
    
    const ncode = extractNcodeFromUrl(imp.url);
    if (ncode) {
      // Mark as fetching
      setFetchingMetadata(prev => new Set(prev).add(imp.id));
      
      try {
        const metadata = await fetchSyosetuMetadata(ncode);
        if (metadata) {
          setBookMetadata(prev => {
            const updated = new Map(prev);
            updated.set(imp.id, metadata);
            return updated;
          });
        }
      } catch (error) {
        console.warn(`Failed to fetch metadata for import ${imp.id}:`, error);
      } finally {
        // Remove from fetching set
        setFetchingMetadata(prev => {
          const newSet = new Set(prev);
          newSet.delete(imp.id);
          return newSet;
        });
      }
    }
  }
}
