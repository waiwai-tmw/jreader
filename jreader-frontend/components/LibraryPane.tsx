'use client'

import { formatDistanceToNow } from 'date-fns';
import { LayoutGrid, List, X, Infinity as InfinityIcon, ExternalLink } from "lucide-react";
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import ImportProgressViewer from './ImportProgressViewer';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSubscription } from '@/hooks/useSubscription';
import type { BookSelectEvent } from '@/types';
import { getBackendApiUrl } from '@/utils/api';
import { debug } from '@/utils/debug';
import { encodeFilename } from '@/utils/filename';
import { createClient, getMetadata } from '@/utils/supabase/client';
import { type SyosetuApiResponse } from '@/utils/syosetuApi';
import { getGenreName } from '@/utils/syosetuGenres';


// Helper function to handle Next.js API upload when import is complete
const handleCompletedImport = async (importId: string, url: string) => {
  try {
    debug('=== Handling completed import ===');
    debug('Import ID:', importId);
    debug('URL:', url);

    // Get auth metadata
    const metadata = await getMetadata();

    // Call GET endpoint to fetch the completed import data
    const apiUrl = `${getBackendApiUrl()}/api/webnovel?url=${encodeURIComponent(url)}`;
    debug('Fetching completed import from:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${metadata.accessToken}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      debug('Failed to fetch completed import:', errorText);
      throw new Error(`Failed to fetch completed import: ${response.statusText}`);
    }

    // Parse the response to get metadata and filename
    debug('Parsing completed import response');
    const result = await response.json();
    debug('Completed import result keys:', Object.keys(result));
    debug('Metadata:', result.metadata);
    debug('Filename:', result.filename);

    // Create form data for the Next.js API
    debug('Creating form data for Next.js API');
    const formData = new FormData();
    formData.append('bookMetadata', JSON.stringify(result.metadata));
    formData.append('originalUrl', url); // Add original syosetu URL for webnovel storage
    formData.append('importId', result.import_id); // Add import ID for progress tracking
    formData.append('authToken', metadata.accessToken); // Add auth token for progress updates
    formData.append('epubFilename', result.filename); // Add EPUB filename for server-side fetching
    debug('Form data created with metadata:', result.metadata);
    debug('Original URL added:', url);
    debug('Import ID added:', result.import_id);
    debug('Auth token added:', !!metadata.accessToken);
    debug('EPUB filename added:', result.filename);

    // Send to our Next.js API route
    debug('Sending to Next.js API');
    const uploadResponse = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    debug('Next.js API response status:', uploadResponse.status);
    debug('Next.js API response ok:', uploadResponse.ok);

    const uploadResponseText = await uploadResponse.text();
    debug('Next.js API response text length:', uploadResponseText.length);

    let uploadResult;
    try {
      uploadResult = JSON.parse(uploadResponseText);
      debug('Next.js API parsed result:', uploadResult);
    } catch (e) {
      debug('Failed to parse Next.js API response:', e);
      throw new Error(`Server returned invalid JSON: ${uploadResponseText.slice(0, 200)}...`);
    }

    if (!uploadResponse.ok) {
      const errorMessage = uploadResult.error || `Upload failed: ${uploadResponse.statusText}`;
      debug('Next.js API error:', errorMessage);
      throw new Error(errorMessage);
    }

    debug('Next.js API upload successful');
    debug('=== Completed import handling finished successfully ===');

    return true;
  } catch (error: any) {
    debug('=== Completed import handling failed ===');
    debug('Error:', error);
    debug('Error message:', error.message);
    debug('Error stack:', error.stack);
    console.error('Completed import handling error:', error);
    toast.error(`Failed to process completed import: ${error.message}`);
    return false;
  }
};

// Component for displaying syosetu tags with expand/collapse functionality
function SyosetuTagsDisplay({ keywords }: { keywords: string }) {
  const [showAllTags, setShowAllTags] = useState(false);

  const tags = keywords
    .split(' ')
    .filter(tag => tag.trim().length > 0);

  const maxVisibleTags = 6;
  const visibleTags = showAllTags ? tags : tags.slice(0, maxVisibleTags);
  const remainingCount = tags.length - maxVisibleTags;

  return (
    <div className="max-w-80">
      <div className="flex flex-wrap gap-1">
        {visibleTags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 whitespace-nowrap"
          >
            {tag.trim()}
          </span>
        ))}
        {!showAllTags && remainingCount > 0 && (
          <button
            onClick={() => setShowAllTags(true)}
            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border whitespace-nowrap hover:bg-muted/80 transition-colors cursor-pointer"
            title={`Click to show ${remainingCount} more tags`}
          >
            +{remainingCount}
          </button>
        )}
        {showAllTags && remainingCount > 0 && (
          <button
            onClick={() => setShowAllTags(false)}
            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border whitespace-nowrap hover:bg-muted/80 transition-colors cursor-pointer"
            title="Click to show fewer tags"
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
}

type UploadStatus = {
  filename: string;
  status: 'uploading' | 'success' | 'error';
  message?: string;
}

type RecentWebnovel = {
  id: string;
  title: string;
  author: string;
  url: string;
  created_at: string;
  userHasIt?: boolean;
  syosetuMetadata?: SyosetuApiResponse;
  syosetu_metadata?: SyosetuApiResponse; // Stored metadata from database
}

interface Book {
  supabase_upload_id: string;
  filename: string;
  title?: string;
  author?: string;
  totalPages: number;
  coverUrl?: string;
  isWebnovel?: boolean;
  webnovelUrl?: string | null;
}

type PaneType = 'none' | 'library' | 'toc' | 'search' | 'dictionary';

interface LibraryPaneProps {
  setActivePane: (pane: PaneType) => void;
  isAuthenticated?: boolean;
  isAuthLoading?: boolean;
}

async function uploadToAxumServer(file: File) {
  try {
    const metadata = await getMetadata();
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${getBackendApiUrl()}/api/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${metadata.accessToken}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || `Upload failed: ${response.statusText}`;
      } catch (e) {
        errorMessage = `Upload failed: ${response.statusText}`;
      }

      // Add file size information for payload size errors
      if (response.status === 413) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        errorMessage = `File too large (${fileSizeMB}MB). Current limit: 250MB.`;
      }

      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('Axum server upload error:', error);
    throw error;
  }
}

interface TableOfContentsEntry {
  label: string;
  content_src: string;
  play_order: number;
  page_number: number;
}

interface AxumUploadResponse {
  message: string;
  title: string;
  author: string;
  total_pages: number;
  cover_path: string | null;
  toc: TableOfContentsEntry[];
  spine: string[];
}

export default function LibraryPane({ setActivePane, isAuthenticated = true, isAuthLoading = false }: LibraryPaneProps) {
  useEffect(() => {
    debug('LibraryPane component initialized');

    // Check for active imports on component mount - only for authenticated users
    if (isAuthenticated) {
      checkActiveImports();
    }

    // Add global error handler for this component
    const handleUnhandledError = (event: ErrorEvent) => {
      console.error('=== Unhandled error caught:', event.error);
      console.error('=== Error message:', event.message);
      console.error('=== Error stack:', event.error?.stack);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('=== Unhandled promise rejection:', event.reason);
      console.error('=== Promise rejection stack:', event.reason?.stack);
    };

    window.addEventListener('error', handleUnhandledError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleUnhandledError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [isAuthenticated]);

  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [syosetuUrl, setSyosetuUrl] = useState('');
  const [recentWebnovels, setRecentWebnovels] = useState<RecentWebnovel[]>([]);
  const [triggerImportPolling, setTriggerImportPolling] = useState(false);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  // Removed dynamic metadata fetching - now using stored metadata from database
  const [importingWebnovelId, setImportingWebnovelId] = useState<string | null>(null);
  const [isImportingSyosetu, setIsImportingSyosetu] = useState(false);
  const [showDetailedView, setShowDetailedView] = useState(false);
  const [hideBooksInLibrary, setHideBooksInLibrary] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalWebnovelCount, setTotalWebnovelCount] = useState(0);
  const [hasActiveImports, setHasActiveImports] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'bookmarks'>('bookmarks');
  const [accordionValue, setAccordionValue] = useState<string>('');

  // Memoized callback to prevent excessive re-renders
  const handleImportComplete = useCallback(() => {
    fetchBooks();
    fetchRecentWebnovels();
    checkActiveImports();
    // Clear the input field when import completes successfully
    setSyosetuUrl('');
  }, []);

  // Callback when polling is complete
  const handlePollingComplete = useCallback(() => {
    setTriggerImportPolling(false);
  }, []);

  // Callback when an import is cancelled
  const handleImportCancelled = useCallback(() => {
    checkActiveImports();
    // Clear the input field when import is cancelled
    setSyosetuUrl('');
  }, []);

  // Get user subscription data
  const { data: subscriptionData, isLoading: subscriptionLoading, error: subscriptionError } = useSubscription();

  // Helper function to get book limit based on subscription tier
  const getBookLimit = () => {
    // If subscription is still loading, default to free tier to be safe
    if (subscriptionLoading) {
      return 5;
    }

    const tier = subscriptionData?.tier || 0;

    switch (tier) {
      case 0: // Free tier
        return 5;
      case 1: // Supporter tier
        return 25;
      default:
        return 5; // Default to free tier limit
    }
  };

  // Helper function to normalize status to string (same as ImportProgressViewer)
  const getStatusString = (status: any): string => {
    if (typeof status === 'string') {
      return status;
    } else if (typeof status === 'object' && 'Failed' in status) {
      return 'Failed';
    }
    return 'Unknown';
  };

  // Helper function to check for active imports
  const checkActiveImports = async () => {
    try {
      const metadata = await getMetadata();
      const apiUrl = `${getBackendApiUrl()}/api/import-progress`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${metadata.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const activeImports = data.imports?.filter((imp: any) =>
          ['Starting', 'Downloading', 'EpubGenerated', 'Processing', 'Unpacking', 'Uploading', 'Finalizing'].includes(getStatusString(imp.status))
        ) || [];
        setHasActiveImports(activeImports.length > 0);
      } else {
        console.error('Failed to check active imports:', response.status, response.statusText);
        setHasActiveImports(false);
      }
    } catch (error) {
      console.error('Failed to check active imports:', error);
      setHasActiveImports(false);
    }
  };

  // Pagination helper functions
  const getFilteredWebnovels = () => {
    const filtered = recentWebnovels.filter(webnovel => !hideBooksInLibrary || !webnovel.userHasIt);

    // Sort based on the selected sort option
    return filtered.sort((a, b) => {
      if (sortBy === 'bookmarks') {
        const aBookmarks = a.syosetuMetadata?.fav_novel_cnt || a.syosetu_metadata?.fav_novel_cnt || 0;
        const bBookmarks = b.syosetuMetadata?.fav_novel_cnt || b.syosetu_metadata?.fav_novel_cnt || 0;
        return bBookmarks - aBookmarks; // Sort by bookmarks descending
      } else {
        // Sort by most recent (default)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  };

  const getTotalPages = () => {
    const filteredWebnovels = getFilteredWebnovels();
    return Math.ceil(filteredWebnovels.length / itemsPerPage);
  };

  const getPaginatedWebnovels = () => {
    const filteredWebnovels = getFilteredWebnovels();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredWebnovels.slice(startIndex, endIndex);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [hideBooksInLibrary]);

  // Expand accordion on page load if user is not authenticated
  useEffect(() => {
    if (!isAuthenticated && !isAuthLoading) {
      setAccordionValue('recent-imports');
    }
  }, [isAuthenticated, isAuthLoading]);

  // Fetch recent webnovel imports
  const fetchRecentWebnovels = async (page: number = 1, limit: number = 100) => {
    setIsLoadingRecent(true);
    try {
      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`/api/webnovels/recent?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data) {
        const allRecentWebnovels = data.webnovels || [];

        // Check which webnovels the user already has
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        let webnovelsWithStatus: RecentWebnovel[] = [];

        if (user) {
          // Get user's webnovel IDs
          const { data: userWebnovels, error: userWebnovelError } = await supabase
            .from('user_webnovel')
            .select('webnovel_id')
            .eq('user_id', user.id);

          if (!userWebnovelError && userWebnovels) {
            const userWebnovelIds = new Set(userWebnovels.map(uw => uw.webnovel_id));
            // Add a flag to indicate if user already has each webnovel
            webnovelsWithStatus = allRecentWebnovels.map((webnovel: RecentWebnovel) => ({
              ...webnovel,
              userHasIt: userWebnovelIds.has(webnovel.id)
            }));
          } else {
            // If error fetching user webnovels, show all recent webnovels without status
            webnovelsWithStatus = allRecentWebnovels;
          }
        } else {
          // If no user, show all recent webnovels without status
          webnovelsWithStatus = allRecentWebnovels;
        }

        setRecentWebnovels(webnovelsWithStatus);
        setTotalWebnovelCount(data.pagination?.totalCount || 0);

        // Use stored metadata from database
        const webnovelsWithMetadata = webnovelsWithStatus.map(webnovel => ({
          ...webnovel,
          syosetuMetadata: webnovel.syosetu_metadata || undefined
        }));
        setRecentWebnovels(webnovelsWithMetadata);
      } else {
        console.error('Failed to fetch recent webnovels');
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('Request timed out while fetching recent webnovels');
        } else {
          console.error('Error fetching recent webnovels:', error.message);
        }
      } else {
        console.error('Unknown error fetching recent webnovels:', error);
      }
    } finally {
      setIsLoadingRecent(false);
    }
  };

  // No longer needed - metadata is now fetched as part of the webnovel query

  const handleImportWebnovel = async (webnovelId: string) => {
    setImportingWebnovelId(webnovelId);
    try {
      const response = await fetch('/api/webnovels/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ webnovelId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import webnovel');
      }

      toast.success(result.message);

      // Refresh the book list to show the newly imported webnovel
      await fetchBooks();

      // Update only the specific webnovel's status instead of refreshing the entire list
      // This preserves the Syosetu metadata cache and avoids losing Genre/Keyword data
      setRecentWebnovels(prevWebnovels =>
        prevWebnovels.map(webnovel =>
          webnovel.id === webnovelId
            ? { ...webnovel, userHasIt: true }
            : webnovel
        )
      );
    } catch (error: any) {
      console.error('Import webnovel error:', error);
      toast.error(error.message);
    } finally {
      setImportingWebnovelId(null);
    }
  };

  const fetchBooks = async () => {
    setIsLoading(true);
    setLoadingProgress(0);
    setLoadingMessage('Fetching book data...');
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch regular uploaded books
      const { data: books, error } = await supabase
        .from('User Uploads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Fetch user's webnovels
      const { data: userWebnovels, error: webnovelError } = await supabase
        .from('user_webnovel')
        .select(`
          webnovel_id,
          created_at,
          webnovel:webnovel_id (
            id,
            title,
            author,
            total_pages,
            directory_name,
            cover_path,
            url,
            source
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (webnovelError) {
        console.error('Error fetching webnovels:', webnovelError);
        // Don't throw, just log the error and continue with regular books
      }

      // Combine regular books and webnovels
      const allBooks = [];

      // Add regular uploaded books
      if (books) {
        const regularBooks = books.map(book => ({
          supabase_upload_id: book.id,
          filename: book.directory_name,
          title: book.title,
          author: book.author,
          totalPages: book.total_pages,
          coverPath: book.cover_path ? `${user.id}/${encodeFilename(book.id)}/${encodeFilename(book.cover_path)}` : null,
          isWebnovel: false,
          webnovelUrl: null
        }));
        allBooks.push(...regularBooks);
      }

      // Add webnovels
      if (userWebnovels) {
        const webnovelBooks = userWebnovels.map(uw => ({
          supabase_upload_id: (uw as any).webnovel.id,
          filename: (uw as any).webnovel.directory_name,
          title: (uw as any).webnovel.title,
          author: (uw as any).webnovel.author,
          totalPages: (uw as any).webnovel.total_pages,
          coverPath: (uw as any).webnovel.cover_path ? `${encodeFilename((uw as any).webnovel.id)}/${encodeFilename((uw as any).webnovel.cover_path)}` : null,
          isWebnovel: true,
          webnovelUrl: (uw as any).webnovel.url
        }));
        allBooks.push(...webnovelBooks);
      }

      // Sort all books by creation date (most recent first)
      allBooks.sort((a, b) => {
        // For regular books, we don't have the creation date in the current structure
        // For webnovels, we can use the user_webnovel.created_at
        // For now, just put webnovels first, then regular books
        if (a.isWebnovel && !b.isWebnovel) return -1;
        if (!a.isWebnovel && b.isWebnovel) return 1;
        return 0;
      });

      if (allBooks.length > 0) {
        // First, create all the basic book objects without cover URLs
        const basicBooks = allBooks;

        setLoadingMessage(`Loading book covers for ${basicBooks.length} books...`);
        setLoadingProgress(25);

        // Generate all cover URLs in parallel
        const coverUrlPromises = basicBooks.map(async (book) => {
          if (!book.coverPath) return { supabase_upload_id: book.supabase_upload_id, coverUrl: undefined };

          try {
            // Use different bucket for webnovels vs regular books
            const bucketName = book.isWebnovel ? 'webnovel' : 'uploads';
            const { data: signedUrl, error: urlError } = await supabase.storage
              .from(bucketName)
              .createSignedUrl(book.coverPath, 3600, { // 1 hour expiry
                transform: {
                  width: 192,  // 2x the display size for crisp images on high-DPI displays
                  height: 256, // 2x the display size for crisp images on high-DPI displays
                  resize: 'cover',
                  quality: 80
                }
              });

            if (urlError) {
              console.error('Error creating signed URL for cover:', urlError);
              return { supabase_upload_id: book.supabase_upload_id, coverUrl: undefined };
            } else {
              return { supabase_upload_id: book.supabase_upload_id, coverUrl: signedUrl.signedUrl };
            }
          } catch (error) {
            console.error('Error generating cover URL:', error);
            return { supabase_upload_id: book.supabase_upload_id, coverUrl: undefined };
          }
        });

        // Wait for all cover URLs to be generated in parallel
        const coverResults = await Promise.all(coverUrlPromises);
        setLoadingProgress(75);
        setLoadingMessage('Preparing your library...');

        // Combine the basic book data with the cover URLs
        const booksWithCovers = basicBooks.map(book => {
          const coverResult = coverResults.find(result => result.supabase_upload_id === book.supabase_upload_id);
          return {
            ...book,
            coverUrl: coverResult?.coverUrl
          };
        });

        setBooks(booksWithCovers);
        setLoadingProgress(100);
        setLoadingMessage('Done!');
      }
    } catch (error: any) {
      setError(error.message);
      debug(`Failed to fetch books: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      try {
        await Promise.all([
          fetchBooks(),
          fetchRecentWebnovels()
        ]);
      } catch (error) {
        console.error('Error initializing library data:', error);
        // Set a user-friendly error message
        setError('Failed to load library data. Please refresh the page.');
      }
    };

    initializeData();
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    debug('Dropped items:', e.dataTransfer.items);
    debug('Dropped files:', e.dataTransfer.files);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      await handleFiles(files);
    }
  };

  const handleFiles = async (files: File[]) => {
    debug(`Processing ${files.length} files`);

    try {
      for (const file of files) {
        console.log('=== Starting upload for file:', file.name);
        debug('Original file:', {
          name: file.name,
          type: file.type,
          size: file.size,
          lastModified: new Date(file.lastModified).toISOString()
        });

        if (!file.name.toLowerCase().endsWith('.epub')) {
        setError(`File ${file.name} is not an epub file`);
          continue;
        }

        try {
          // Check book count before starting upload
          console.log('=== Checking book count before upload');
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Not authenticated');

          // Count regular uploaded books
          const { data: existingBooks, error: countError } = await supabase
            .from('User Uploads')
            .select('id');

          if (countError) {
            console.log('Error checking book count:', countError);
            throw new Error('Failed to check book count');
          }

          // Count user's webnovels
          const { data: userWebnovels, error: webnovelCountError } = await supabase
            .from('user_webnovel')
            .select('webnovel_id')
            .eq('user_id', user.id);

          if (webnovelCountError) {
            console.log('Error checking webnovel count:', webnovelCountError);
            // Don't throw, just log and continue with regular book count
          }

          const regularBookCount = existingBooks?.length || 0;
          const webnovelCount = userWebnovels?.length || 0;
          const bookCount = regularBookCount + webnovelCount;
          const bookLimit = getBookLimit();

          if (bookCount >= bookLimit) {
            const tier = subscriptionData?.tier || 0;
            if (tier === 0) {
              toast.error('You have reached the maximum number of books (5). Become a Supporter for up to 25 books and more features.');
            } else {
              toast.error('You have reached the maximum number of books for your current plan.');
            }
            return; // Exit early, no need to show upload status
          }

          // Only show upload status after confirming user is under limit
          setUploadStatuses(prev => [...prev, {
            filename: file.name,
            status: 'uploading'
          }]);
          console.log('=== About to upload to Axum server');
          // Upload to Axum backend
          const rustResponse: AxumUploadResponse = await uploadToAxumServer(file);
          console.log('Axum upload response:', rustResponse);

          // Create form data for the Supabase upload
          const formData = new FormData();
          formData.append('file', file);
          formData.append('bookMetadata', JSON.stringify({
            title: rustResponse.title,
            author: rustResponse.author,
            total_pages: rustResponse.total_pages,
            cover_path: rustResponse.cover_path,
            toc: rustResponse.toc,
            spine: rustResponse.spine,
          }));

          console.log('=== About to send to Next.js API');
          // Send to our Next.js API route
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          const responseText = await response.text();
          let result;
          try {
            result = JSON.parse(responseText);
          } catch (e) {
            throw new Error(`Server returned invalid JSON: ${responseText.slice(0, 200)}...`);
          }

          if (!response.ok) {
            const errorMessage = result.error || `Upload failed: ${response.statusText}`;
            console.log('Upload failed:', errorMessage);
            throw new Error(errorMessage);
          }

          setUploadStatuses(prev => prev.map(status =>
            status.filename === file.name
              ? { ...status, status: 'success', message: result.message }
              : status
          ));

          // Refresh book list after successful upload
          try {
            await fetchBooks();
          } catch (fetchError) {
            console.error('Error refreshing book list:', fetchError);
            // Don't throw here, just log the error
          }

          setTimeout(() => {
            setUploadStatuses(prev =>
              prev.filter(status => status.filename !== file.name)
            );
          }, 3000);

        } catch (error: any) {
          console.error('=== Upload error caught:', error);
          console.error('=== Error stack:', error.stack);

          // Show error as toast instead of upload status
          toast.error(error.message);

          // Remove the upload status immediately
          setUploadStatuses(prev =>
            prev.filter(status => status.filename !== file.name)
          );
        }
      }
    } catch (error: any) {
      console.log('=== Unexpected error in handleFiles:', error);
      console.log('=== Error stack:', error.stack);
    }
  };

  const handleBookSelect = async (book: Book) => {
    debug('=== Book Selection Start ===');
    debug(`Selected book: ${book.filename}`);

    try {
      // Get bookmarks from localStorage with more detailed logging
      debug('Checking localStorage for bookmarks');
      const rawBookmarks = localStorage.getItem('reader-bookmarks');
      debug('Raw bookmarks from storage:', rawBookmarks);

      let bookmarks: Record<string, any> = {};
      try {
        bookmarks = JSON.parse(rawBookmarks || '{}');
      } catch (e) {
        debug('Error parsing bookmarks:', e);
        bookmarks = {};
      }

      const currentBookmark = bookmarks[book.filename];

      if (currentBookmark) {
        debug('Found existing bookmark:', {
          filename: book.filename,
          bookmark: currentBookmark
        });
      } else {
        debug('No bookmark found for book:', book.filename);
      }

      const event = new CustomEvent('bookselect', {
        detail: {
          supabase_upload_id: book.supabase_upload_id,
          title: book.title,
          currentPage: 0
        }
      }) as BookSelectEvent;
      window.dispatchEvent(event);

      setActivePane('dictionary');

      debug('=== Book Selection Complete ===');
    } catch (error: any) {
      debug('=== Book Selection Error ===');
      setError(`Failed to load book: ${error.message}`);
      debug('Error loading book:', error);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, book: Book) => {
    e.stopPropagation(); // Prevent book selection
    setBookToDelete(book);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!bookToDelete) return;

    try {
      const response = await fetch('/api/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadId: bookToDelete.supabase_upload_id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete book');
      }

      const result = await response.json();
      console.log('Delete successful:', result);

      // Remove the book from the local state
      setBooks(prev => prev.filter(book => book.supabase_upload_id !== bookToDelete.supabase_upload_id));

      // Refresh the recent webnovels list in case a webnovel was deleted
      fetchRecentWebnovels();

      setDeleteDialogOpen(false);
      setBookToDelete(null);
    } catch (error: any) {
      console.error('Delete error:', error);
      setError(`Failed to delete book: ${error.message}`);
      setDeleteDialogOpen(false);
      setBookToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setBookToDelete(null);
  };

  const handleSyosetuImport = async () => {
    debug('=== Starting syosetu import process ===');
    debug('URL:', syosetuUrl);

    // Set loading state immediately to prevent multiple clicks
    setIsImportingSyosetu(true);

    try {
      // Clean the URL: strip whitespace and trailing slashes
      const cleanedUrl = syosetuUrl.trim().replace(/\/+$/, '');
      debug('Cleaned URL:', cleanedUrl);

      if (!cleanedUrl) {
        debug('Empty URL provided');
        toast.error('Please enter a Narou URL');
        return;
      }

      if (!cleanedUrl.includes('syosetu.com')) {
        debug('Invalid URL format:', cleanedUrl);
        toast.error('Please enter a valid Narou URL');
        return;
      }

      debug('URL validation passed, starting import');

      // Check book count before starting import
      debug('Checking book count before import');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Count regular uploaded books
      const { data: existingBooks, error: countError } = await supabase
        .from('User Uploads')
        .select('id');

      if (countError) {
        debug('Error checking book count:', countError);
        throw new Error('Failed to check book count');
      }

      // Count user's webnovels
      const { data: userWebnovels, error: webnovelCountError } = await supabase
        .from('user_webnovel')
        .select('webnovel_id')
        .eq('user_id', user.id);

      if (webnovelCountError) {
        debug('Error checking webnovel count:', webnovelCountError);
        // Don't throw, just log and continue with regular book count
      }

      const regularBookCount = existingBooks?.length || 0;
      const webnovelCount = userWebnovels?.length || 0;
      const bookCount = regularBookCount + webnovelCount;
      const bookLimit = getBookLimit();
      debug(`Book count: ${bookCount}, Book limit: ${bookLimit}`);

      if (bookCount >= bookLimit) {
        debug('User has reached book limit');
        const tier = subscriptionData?.tier || 0;
        if (tier === 0) {
          toast.error('You have reached the maximum number of books (5). Become a Supporter for up to 25 books and more features.');
        } else {
          toast.error('You have reached the maximum number of books for your current plan.');
        }
        return;
      }

      // Check if webnovel already exists in the database
      debug('Checking if webnovel already exists in database');
      const { data: existingWebnovel, error: webnovelCheckError } = await supabase
        .from('webnovel')
        .select('id, title, author')
        .eq('url', cleanedUrl)
        .maybeSingle();

      if (webnovelCheckError) {
        debug('Error checking for existing webnovel:', webnovelCheckError);
        // Continue with normal flow if there's an error checking
      } else if (existingWebnovel) {
        debug('Webnovel already exists in database:', existingWebnovel);

        // Check if user already has this webnovel
        const { data: existingUserWebnovel, error: userWebnovelCheckError } = await supabase
          .from('user_webnovel')
          .select('webnovel_id')
          .eq('user_id', user.id)
          .eq('webnovel_id', existingWebnovel.id);

        if (userWebnovelCheckError) {
          debug('Error checking existing user webnovel:', userWebnovelCheckError);
          // Continue with normal flow if there's an error checking
        } else if (existingUserWebnovel && existingUserWebnovel.length > 0) {
          debug('User already has this webnovel in their library');
          setSyosetuUrl('');
          toast.success(`"${existingWebnovel.title}" is already in your library!`);
          return;
        } else {
          // User doesn't have this webnovel yet, add it to their library
          debug('Adding existing webnovel to user library');
          const { data: userWebnovel, error: insertError } = await supabase
            .from('user_webnovel')
            .insert({
              user_id: user.id,
              webnovel_id: existingWebnovel.id
            })
            .select()
            .single();

          if (insertError) {
            debug('Error adding webnovel to user library:', insertError);
            toast.error('Failed to add webnovel to your library');
            return;
          }

          setSyosetuUrl('');
          toast.success(`"${existingWebnovel.title}" by ${existingWebnovel.author} has been added to your library`);

          // Refresh the book list
          await fetchBooks();
          fetchRecentWebnovels();
          return;
        }
      }

      // Show initial processing message only if we need to do the full import
      // toast.info('Starting webnovel import. This may take several minutes for large books. You can continue using the app while it processes.');

      // Trigger polling for import progress
      setTriggerImportPolling(true);

      // Update active imports state since we just started one
      setHasActiveImports(true);

      // Call the Rust backend to generate the EPUB and get metadata
      debug('Calling Rust backend webnovel API');
      const metadata = await getMetadata();
      const apiUrl = `${getBackendApiUrl()}/api/webnovel?url=${encodeURIComponent(cleanedUrl)}`;
      debug('API URL:', apiUrl);

      // Show processing message
      // toast.info('Downloading and processing webnovel. This may take a few minutes...');

      // Fire and forget - don't wait for response
      fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${metadata.accessToken}`
        }
      }).catch(error => {
        console.error('Failed to start webnovel import:', error);
      });

      debug('Webnovel import request sent, continuing without waiting for response');

      // Clear the input
      setSyosetuUrl('');
      debug('=== Syosetu import started successfully ===');

      // Note: The import will be handled by polling in ImportProgressViewer
      // When the import reaches "Processing" status, the polling will automatically
      // call the Next.js API to upload the book to the library

    } catch (error: any) {
      debug('=== Syosetu import failed ===');
      debug('Error:', error);
      debug('Error message:', error.message);
      debug('Error stack:', error.stack);
      console.error('Syosetu import error:', error);
      toast.error(error.message);
    } finally {
      debug('Import process finished');
      // Reset the loading state (but keep polling active until import completes)
      setIsImportingSyosetu(false);
      // Don't set triggerImportPolling to false here - let ImportProgressViewer handle it
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      debug('Selected files:', e.target.files);
      handleFiles(Array.from(e.target.files));
    }
  };

  return (
    <div className="flex flex-col h-full w-full p-4 gap-4">
      {/* Welcome Banner for Unauthenticated Users */}
      {!isAuthenticated && (
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-center -mt-4">
          <div className="text-sm font-medium text-primary mb-2">📚 Welcome to JReader's Library!</div>
          <p className="text-xs text-muted-foreground mb-3">
            Browse and read webnovels imported by the community, no login required. Sign in to upload your own books, track progress, and mine Anki cards.
          </p>
          <a href="/login" className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            Sign In with Discord
          </a>
        </div>
      )}

      {/* Upload Zone - only for authenticated users */}
      {isAuthenticated && (
        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${isDragging ? 'border-primary bg-accent' : 'border-border'}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={handleFileSelect}
            multiple
            accept=".epub,.txt,.html"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer text-primary hover:text-primary/80"
          >
            Click to upload
          </label>
          <span className="text-muted-foreground"> or drag files here</span>
          <p className="text-sm text-muted-foreground mt-2">
            Supported file formats: EPUB
          </p>
        </div>
      )}

      {/* Narou Import Section - only for authenticated users */}
      {isAuthenticated && (
        <div className="border rounded-lg p-4 sm:p-6 bg-muted/30">
          <h3 className="text-lg font-semibold mb-4">Import from Narou</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="https://ncode.syosetu.com/n7694kp/"
              value={syosetuUrl}
              onChange={(e) => setSyosetuUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && syosetuUrl.trim() && books.length < getBookLimit() && !hasActiveImports && !isImportingSyosetu) {
                  handleSyosetuImport();
                }
              }}
              className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <Button
              variant="outline"
              className="px-3 sm:px-6 py-2 text-sm sm:text-base whitespace-nowrap"
              onClick={() => handleSyosetuImport()}
              disabled={!syosetuUrl.trim() || books.length >= getBookLimit() || hasActiveImports || isImportingSyosetu}
            >
              {isImportingSyosetu
                ? (
                  <>
                    <span className="hidden sm:inline">Import in progress...</span>
                    <span className="sm:hidden">Importing...</span>
                  </>
                )
                : hasActiveImports
                  ? (
                    <>
                      <span className="hidden sm:inline">Import in progress...</span>
                      <span className="sm:hidden">Importing...</span>
                    </>
                  )
                  : books.length >= getBookLimit()
                    ? (
                      <>
                        <span className="hidden sm:inline">Book limit reached</span>
                        <span className="sm:hidden">Limit reached</span>
                      </>
                    )
                    : 'Import'
              }
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Paste a Shousetsuka ni Narou novel URL to import it to your library
          </p>
          <p className="text-xs text-muted-foreground/80 mt-1">
            If already available on JReader, it will instantly be added
          </p>

          {/* Import Progress Viewer */}
          <div className="mt-4">
            <ImportProgressViewer
              onImportComplete={handleImportComplete}
              triggerPolling={triggerImportPolling}
              onPollingComplete={handlePollingComplete}
              onImportCancelled={handleImportCancelled}
            />
          </div>
        </div>
      )}

      {/* Recent Imports Accordion - visible to all users */}
      <div className="border rounded-lg p-4 sm:p-6 bg-muted/30">
        {isAuthLoading ? (
          // Skeleton loading state while auth is being determined
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        ) : (
        <Accordion
          type="single"
          collapsible
          className="w-full"
          value={accordionValue}
          onValueChange={setAccordionValue}
        >
          <AccordionItem value="recent-imports">
            <AccordionTrigger className="text-sm font-medium hover:no-underline group">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 w-full">
                <div className="flex items-center gap-2">
                  <span>Recently imported by users</span>
                  {isLoadingRecent ? (
                    <Skeleton className="h-5 w-8" />
                  ) : (
                    <span className="text-xs text-muted-foreground">({getFilteredWebnovels().length})</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground sm:ml-auto group-hover:text-primary transition-colors">
                  Click to browse and add to your library
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {isLoadingRecent ? (
                <div className="text-sm text-muted-foreground py-2">
                  Loading recent imports...
                </div>
              ) : recentWebnovels.length === 0 ? (
                <div className="text-sm text-muted-foreground py-2">
                  No recent imports found
                </div>
              ) : (
                <div className="space-y-4">
                    {/* Toggle Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="detailed-view"
                          checked={showDetailedView}
                          onCheckedChange={(checked) => {
                            setShowDetailedView(checked);
                            // Metadata is now included in the webnovel query
                          }}
                        />
                        <Label htmlFor="detailed-view" className="text-sm font-medium">
                          Detailed view
                        </Label>
                      </div>

                      {isAuthenticated && (
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="hide-library"
                          checked={hideBooksInLibrary}
                          onCheckedChange={setHideBooksInLibrary}
                        />
                        <Label htmlFor="hide-library" className="text-sm font-medium">
                          Hide books in library
                        </Label>
                      </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <Label htmlFor="sort-by" className="text-sm font-medium">
                          Sort by:
                        </Label>
                        <Select value={sortBy} onValueChange={(value: 'recent' | 'bookmarks') => setSortBy(value)}>
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="recent">Most Recent</SelectItem>
                            <SelectItem value="bookmarks">Most Bookmarked</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className={showDetailedView ? "w-96" : ""}>Title</TableHead>
                            <TableHead>Author</TableHead>
                            {showDetailedView && <TableHead>Genre</TableHead>}
                            {showDetailedView && <TableHead>Keywords</TableHead>}
                            {showDetailedView && <TableHead className="w-24">Length</TableHead>}
                            <TableHead className="w-24">Bookmarks</TableHead>
                            <TableHead>Imported</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getPaginatedWebnovels().map((webnovel) => (
                            <TableRow key={webnovel.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <span>{webnovel.title}</span>
                                  <a
                                    href={webnovel.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:text-primary/80 transition-colors"
                                    title="View on Narou"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span>{webnovel.author}</span>
                                  {(webnovel.syosetuMetadata?.userid || webnovel.syosetu_metadata?.userid) && (
                                    <a
                                      href={`https://mypage.syosetu.com/${webnovel.syosetuMetadata?.userid || webnovel.syosetu_metadata?.userid}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:text-primary/80 transition-colors"
                                      title="View author's page on Narou"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  )}
                                </div>
                              </TableCell>
                              {showDetailedView && (
                                <TableCell>
                                  {webnovel.syosetuMetadata ? (
                                    <div className="text-xs">
                                      {getGenreName(webnovel.syosetuMetadata.genre)}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-muted-foreground">-</div>
                                  )}
                                </TableCell>
                              )}
                              {showDetailedView && (
                                <TableCell>
                                  {webnovel.syosetuMetadata?.keyword ? (
                                    <SyosetuTagsDisplay keywords={webnovel.syosetuMetadata.keyword} />
                                  ) : (
                                    <div className="text-xs text-muted-foreground">-</div>
                                  )}
                                </TableCell>
                              )}
                              {showDetailedView && (
                                <TableCell>
                                  {webnovel.syosetuMetadata?.length ? (
                                    <div className="text-xs">
                                      {webnovel.syosetuMetadata.length.toLocaleString('en-US')} 文字
                                    </div>
                                  ) : (
                                    <div className="text-xs text-muted-foreground">-</div>
                                  )}
                                </TableCell>
                              )}
                              <TableCell>
                                {webnovel.syosetuMetadata?.fav_novel_cnt || webnovel.syosetu_metadata?.fav_novel_cnt ? (
                                  <div className="text-sm">
                                    {(webnovel.syosetuMetadata?.fav_novel_cnt || webnovel.syosetu_metadata?.fav_novel_cnt || 0).toLocaleString('en-US')}
                                  </div>
                                ) : (
                                  <div className="text-sm text-muted-foreground">-</div>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDistanceToNow(new Date(webnovel.created_at), { addSuffix: true })}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (!isAuthenticated) {
                                      window.location.href = `/library/${webnovel.id}`;
                                      return;
                                    }
                                    handleImportWebnovel(webnovel.id);
                                  }}
                                  disabled={isAuthenticated && (importingWebnovelId === webnovel.id || webnovel.userHasIt || books.length >= getBookLimit())}
                                >
                                  {!isAuthenticated
                                    ? 'Read now'
                                    : importingWebnovelId === webnovel.id
                                      ? 'Adding...'
                                      : webnovel.userHasIt
                                        ? 'Already in library'
                                        : books.length >= getBookLimit()
                                          ? 'Book limit reached'
                                          : 'Add to library'
                                  }
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3">
                      {getPaginatedWebnovels().map((webnovel) => (
                        <Card key={webnovel.id} className="p-4">
                          <div className="space-y-3">
                            {/* Title and External Link */}
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-medium text-sm leading-tight flex-1 min-w-0">
                                {webnovel.title}
                              </h3>
                              <a
                                href={webnovel.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80 transition-colors flex-shrink-0"
                                title="View on Narou"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </div>

                            {/* Author */}
                            <div className="text-sm text-muted-foreground">
                              <span className="font-medium">Author:</span> {webnovel.author}
                            </div>

                            {/* Imported time */}
                            <div className="text-sm text-muted-foreground">
                              <span className="font-medium">Imported:</span> {formatDistanceToNow(new Date(webnovel.created_at), { addSuffix: true })}
                            </div>

                            {/* Bookmarks */}
                            <div className="text-sm text-muted-foreground">
                              <span className="font-medium">Bookmarks:</span>{' '}
                              {webnovel.syosetuMetadata?.fav_novel_cnt || webnovel.syosetu_metadata?.fav_novel_cnt ? (
                                <span className="text-xs">
                                  {(webnovel.syosetuMetadata?.fav_novel_cnt || webnovel.syosetu_metadata?.fav_novel_cnt || 0).toLocaleString('en-US')}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </div>

                            {/* Detailed view content */}
                            {showDetailedView && (
                              <div className="space-y-2 pt-2 border-t">
                                {/* Genre */}
                                <div className="text-sm">
                                  <span className="font-medium text-muted-foreground">Genre:</span>{' '}
                                  {webnovel.syosetuMetadata ? (
                                    <span className="text-xs">
                                      {getGenreName(webnovel.syosetuMetadata.genre)}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </div>

                                {/* Keywords */}
                                <div className="text-sm">
                                  <span className="font-medium text-muted-foreground">Keywords:</span>{' '}
                                  {webnovel.syosetuMetadata?.keyword ? (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {webnovel.syosetuMetadata.keyword
                                        .split(' ')
                                        .filter(tag => tag.trim().length > 0)
                                        .map((tag, index) => (
                                          <span
                                            key={index}
                                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                                          >
                                            {tag.trim()}
                                          </span>
                                        ))}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </div>

                                {/* Length */}
                                <div className="text-sm">
                                  <span className="font-medium text-muted-foreground">Length:</span>{' '}
                                  {webnovel.syosetuMetadata?.length ? (
                                    <span className="text-xs">
                                      {webnovel.syosetuMetadata.length.toLocaleString('en-US')} 文字
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Action Button */}
                            <div className="pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (!isAuthenticated) {
                                    window.location.href = `/library/${webnovel.id}`;
                                    return;
                                  }
                                  handleImportWebnovel(webnovel.id);
                                }}
                                disabled={isAuthenticated && (importingWebnovelId === webnovel.id || webnovel.userHasIt || books.length >= getBookLimit())}
                                className="w-full"
                              >
                                {!isAuthenticated
                                  ? 'Read now'
                                  : importingWebnovelId === webnovel.id
                                    ? 'Adding...'
                                    : webnovel.userHasIt
                                      ? 'Already in library'
                                      : books.length >= getBookLimit()
                                        ? 'Book limit reached'
                                        : 'Add to library'
                                }
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>

                  {/* Pagination */}
                  {getTotalPages() > 1 && (
                    <div className="mt-4">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
                        <div className="text-sm text-muted-foreground text-center sm:text-left">
                          <span className="hidden sm:inline">
                            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, getFilteredWebnovels().length)} of {getFilteredWebnovels().length} books
                          </span>
                          <span className="sm:hidden">
                            Page {currentPage} of {getTotalPages()}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-center">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (currentPage > 1) {
                                    handlePageChange(currentPage - 1);
                                  }
                                }}
                                className={currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                              />
                            </PaginationItem>

                            {/* Page numbers - show fewer on mobile */}
                            {(() => {
                              const totalPages = getTotalPages();
                              const pages = [];
                              let lastPageAdded = 0;

                              for (let page = 1; page <= totalPages; page++) {
                                // Show first page, last page, current page, and pages around current page
                                const shouldShow =
                                  page === 1 ||
                                  page === totalPages ||
                                  Math.abs(page - currentPage) <= 1;

                                if (shouldShow) {
                                  // Add ellipsis if there's a gap
                                  if (page - lastPageAdded > 1) {
                                    pages.push(
                                      <PaginationItem key={`ellipsis-${page}`}>
                                        <PaginationEllipsis />
                                      </PaginationItem>
                                    );
                                  }

                                  pages.push(
                                    <PaginationItem key={page}>
                                      <PaginationLink
                                        href="#"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          handlePageChange(page);
                                        }}
                                        isActive={page === currentPage}
                                        className="cursor-pointer"
                                      >
                                        {page}
                                      </PaginationLink>
                                    </PaginationItem>
                                  );

                                  lastPageAdded = page;
                                }
                              }

                              return pages;
                            })()}

                            <PaginationItem>
                              <PaginationNext
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (currentPage < getTotalPages()) {
                                    handlePageChange(currentPage + 1);
                                  }
                                }}
                                className={currentPage >= getTotalPages() ? "pointer-events-none opacity-50" : "cursor-pointer"}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        )}
      </div>

      {/* Upload Status Messages */}
      {uploadStatuses.length > 0 && (
        <div className="space-y-2">
          {uploadStatuses.map((status, index) => (
            <div
              key={`${status.filename}-${index}`}
              className={`
                px-4 py-2 rounded-lg flex items-center gap-2
                ${status.status === 'uploading' ? 'bg-accent' : ''}
                ${status.status === 'success' ? 'bg-green-100 dark:bg-green-900/20' : ''}
                ${status.status === 'error' ? 'bg-destructive/10' : ''}
              `}
            >
              {status.status === 'uploading' && <span className="animate-spin">⏳</span>}
              {status.status === 'success' && <span>✅</span>}
              {status.status === 'error' && <span>❌</span>}

              <div className="flex-1">
                <div className="text-sm font-medium">{status.filename}</div>
                {status.message && (
                  <div className="text-xs text-muted-foreground">
                    {status.message}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Book List */}
      {isAuthenticated && (
      <div className="flex-1">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Your Books</h3>
            <span className={`text-sm ${subscriptionLoading ? 'text-gray-400' : books.length >= getBookLimit() ? 'text-blue-500 dark:text-blue-400' : books.length >= Math.max(4, getBookLimit() - 1) ? 'text-green-500 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
              ({books.length}/{subscriptionLoading ? '...' : getBookLimit() === Infinity ? <InfinityIcon className="inline-block w-4 h-4" /> : getBookLimit()})
            </span>
          </div>
          <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as 'grid' | 'list')}>
            <ToggleGroupItem value="grid" aria-label="Grid view">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {books.length >= Math.max(4, getBookLimit() - 1) && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            books.length >= getBookLimit()
              ? 'bg-muted text-foreground border border-border'
              : 'bg-muted text-foreground border border-border'
          }`}>
            {books.length >= getBookLimit()
              ? (() => {
                  const tier = subscriptionData?.tier || 0;
                  if (tier === 0) {
                    return <>You've reached the free plan limit of 5 books. 🚀 <a href="/supporter" className="underline font-medium hover:text-primary">Become a Supporter</a> for up to 25 books and more features!</>;
                  } else {
                    return <>You've reached the maximum number of books for your current plan.</>;
                  }
                })()
              : (() => {
                  const tier = subscriptionData?.tier || 0;
                  const limit = getBookLimit();
                  if (tier === 0) {
                    return <>Great! You're almost at the free plan limit. 🎉 Consider <a href="/supporter" className="underline font-medium hover:text-primary">becoming a Supporter</a> for up to 25 books and premium features.</>;
                  } else {
                    return <>You have {limit - books.length} books remaining! 🎉</>;
                  }
                })()
            }
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-2">
                {loadingMessage}
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {loadingProgress}%
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="text-red-500 dark:text-red-400">
            Error: {error}
          </div>
        ) : books.length > 0 ? (
          <div className={viewMode === 'grid'
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            : "flex flex-col gap-4"
          }>
            {books.map((book) => (
              <Card
                key={book.filename}
                className={`overflow-hidden hover:bg-muted transition-colors cursor-pointer relative group
                  ${viewMode === 'list' ? 'w-full' : ''}`}
                onClick={() => handleBookSelect(book)}
              >
                {/* Delete Button */}
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 h-8 w-8 p-0"
                  onClick={(e) => handleDeleteClick(e, book)}
                >
                  <X className="h-4 w-4" />
                </Button>

                <div className={`flex p-4 gap-4 ${viewMode === 'list' ? 'items-center' : ''}`}>
                  <div className="flex-shrink-0">
                    {book.coverUrl ? (
                      <img
                        src={book.coverUrl}
                        alt={`Cover for ${book.title || book.filename}`}
                        className="w-24 h-32 object-cover rounded-md"
                        style={{ width: '96px', height: '128px' }}
                        loading="eager"
                      />
                    ) : (
                      <div
                        className="w-24 h-32 bg-muted rounded-md flex items-center justify-center"
                        style={{ width: '96px', height: '128px' }}
                      >
                        <span className="text-muted-foreground text-xs text-center px-2">
                          No Cover
                        </span>
                      </div>
                    )}
                  </div>
                  <div className={`flex flex-col ${viewMode === 'list' ? 'flex-1' : ''} justify-between`}>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium line-clamp-2">{book.title || book.filename}</h4>
                        {book.isWebnovel && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                            Narou
                          </span>
                        )}
                      </div>
                      {book.author && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          by {book.author}
                        </p>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {(() => {
                        const chapterCount = book.isWebnovel ? Math.max(0, book.totalPages - 2) : book.totalPages;
                        return `${chapterCount} chapter${chapterCount === 1 ? '' : 's'}`;
                      })()}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground italic">
            No books uploaded yet
          </p>
        )}
      </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Book</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{bookToDelete?.title || bookToDelete?.filename}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDeleteCancel}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
