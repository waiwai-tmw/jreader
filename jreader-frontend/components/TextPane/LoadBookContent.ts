import { toast } from 'sonner';

import { transformEpubContent } from "./EpubContentTransformer";

import type { Bookmark } from "@/utils/BookmarkManager";
import { encodeFilename } from '@/utils/filename';
import { createClient } from '@/utils/supabase/client';



export type LoadBookContentParams = {
  supabase_upload_id: string;
  iframeRef: React.RefObject<HTMLIFrameElement>;
  injectSettingsCallback: (content: string) => string;
  page?: number;
}

export type LoadBookContentCallbacks = {
    setIsLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
    setContent: (content: { content: string; contentType: string }) => void;
    setCurrentBook: (book: { supabase_upload_id: string; currentPage: number; totalPages: number; isWebnovel?: boolean } | null) => void;
    restorePosition: (bookmark: Bookmark) => void;
    getBookmark: (supabase_upload_id: string) => Promise<Bookmark | null>;
  }

interface SignedUrlCache {
  url: string;
  expiresAt: number;
  sessionId: string;
}

export async function loadBookContent(params: LoadBookContentParams, callbacks: LoadBookContentCallbacks) {
    console.log('📖 Starting loadBookContent for:', params.supabase_upload_id);
    callbacks.setIsLoading(true);
    callbacks.setError(null);
    
    try {
      const supabase = createClient();

      // Get user session (optional for webnovels)
      console.log('🔑 Getting user session...');
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('👤 User authenticated:', user.id);
      } else {
        console.log('👤 User not authenticated - will attempt to load webnovel');
      }

      console.log('📚 Checking book type and fetching data from Supabase...');

      let book: any;
      let isWebnovel = false;

      // Try webnovel table first (works for both authenticated and unauthenticated users)
      console.log('📖 Checking webnovel table...');
      const { data: webnovelBook, error: webnovelError } = await supabase
        .from('webnovel')
        .select('spine, total_pages')
        .eq('id', params.supabase_upload_id)
        .maybeSingle();

      if (webnovelBook) {
        // It's a webnovel
        console.log('📖 Book is a webnovel, fetching from webnovel table...');
        book = webnovelBook;
        isWebnovel = true;
        console.log('📖 Found webnovel data');
      } else if (webnovelError) {
        // Error checking webnovel
        console.warn('⚠️ Error checking webnovel:', webnovelError);
      }

      // If not found in webnovel table, try User Uploads (requires authentication)
      if (!book) {
        if (!user) {
          throw new Error('Book not found and user is not authenticated');
        }

        console.log('📖 Book not in webnovel table, fetching from User Uploads...');
        const { data: regularBook, error: bookError } = await supabase
          .from('User Uploads')
          .select('spine, total_pages')
          .eq('id', params.supabase_upload_id)
          .single();

        if (bookError) {
          console.error('❌ Regular book fetch error:', bookError);
          throw new Error('Book not found');
        }
        
        book = regularBook;
        isWebnovel = false;
        console.log('📖 Found regular book data');
      }

      console.log('📖 Book data:', { totalPages: book?.total_pages, spineLength: book?.spine?.length });

      const bookmark = await callbacks.getBookmark(params.supabase_upload_id);
      const pageIndex = params.page !== undefined ? params.page : bookmark?.page ?? 0;

      // Only show toast if:
      // 1. We have a bookmark
      // 2. We're on a different page than the bookmark
      // 3. The current page isn't from pagination (URL params)
      if (bookmark && pageIndex !== bookmark.page && !params.page) {

        toast("Bookmark Found", {
          description: `Jump to page ${bookmark.page}?`,
          action: {
            label: "Go to Bookmark",
            onClick: () => {
              const url = new URL(window.location.href);
              url.searchParams.set('page', bookmark.page.toString());
              window.location.href = url.toString();
            }
          },
          duration: 5000,
          className: "bookmark-toast",
          id: 'bookmark-toast' // Add a unique ID to prevent duplicates
        });
      }

      console.log('🔖 Using page index:', pageIndex, 
        params.page !== undefined ? '(from URL)' : 
        pageIndex > 0 ? '(from bookmark)' : 
        '(default)');

      // Validate page index
      if (pageIndex < 0 || pageIndex >= book.spine.length) {
        throw new Error(`Invalid page index: ${pageIndex}. Book has ${book.spine.length} pages.`);
      }

      // Get the page content
      const pagePath = isWebnovel
        ? `${encodeFilename(params.supabase_upload_id)}/${encodeFilename(book.spine[pageIndex])}`
        : `${user!.id}/${encodeFilename(params.supabase_upload_id)}/${encodeFilename(book.spine[pageIndex])}`;
      console.log('🔍 Constructed page path:', pagePath);
      console.log('🔍 Is webnovel:', isWebnovel);

      // For authenticated users and private uploads, we need a session
      let session = null;
      if (user) {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (!authSession) throw new Error('No active session');
        session = authSession;
        console.log('🔑 Got active session token');
      } else if (!isWebnovel) {
        throw new Error('Authentication required to load private uploads');
      }
      // For public webnovels without auth, we'll fetch directly from public storage

      const ONE_HOUR_IN_SECONDS = 3600;

      async function getSignedUrl(path: string): Promise<string> {
        console.log('🔍 Getting signed URL for:', path);
        let fullPath = path;
        
        if (isWebnovel) {
          // For webnovels, path should be: {webnovelId}/{path}
          if (!path.startsWith(`${params.supabase_upload_id}/`)) {
            fullPath = `${params.supabase_upload_id}/${path}`;
          }
        } else {
          // For regular books, path should be: {userId}/{uploadId}/{path}
          if (!path.startsWith(`${user.id}/${params.supabase_upload_id}/`) && !path.startsWith(`${params.supabase_upload_id}/`)) {
            fullPath = `${user.id}/${params.supabase_upload_id}/${path}`;
          } else if (path.startsWith(`${params.supabase_upload_id}/`)) {
            fullPath = `${user.id}/${path}`;
          }
        }
        
        const cacheKey = `signed_url:${fullPath}`;
        const now = Date.now();

        // Clear any cached URLs for webnovels to ensure we use the correct bucket
        if (isWebnovel) {
          console.log('🧹 Clearing cache for webnovel to ensure correct bucket');
          localStorage.removeItem(cacheKey);
        }

        // Try to get cached URL from localStorage
        const cachedJson = localStorage.getItem(cacheKey);
        let shouldRefreshInBackground = false;

        if (cachedJson) {
          try {
            const cached = JSON.parse(cachedJson) as SignedUrlCache;
            
            // Check if URL exists and matches current session
            if (cached.url && cached.sessionId === session.access_token) {
              const timeUntilExpiry = cached.expiresAt - now;
              
              if (timeUntilExpiry > 0) {
                // URL is still valid
                if (timeUntilExpiry < 15 * 60 * 1000) {
                  // Less than 15 minutes left - use it but refresh in background
                  shouldRefreshInBackground = true;
                }
                console.log('🎯 Using cached signed URL for:', fullPath);
                
                if (shouldRefreshInBackground) {
                  console.log('⏰ URL expires soon, scheduling refresh');
                  setTimeout(() => {
                    refreshSignedUrl(fullPath, cacheKey).catch(e => 
                      console.warn('Failed to refresh URL in background:', e)
                    );
                  }, 0);
                }
                
                return cached.url;
              } else {
                // URL is expired
                localStorage.removeItem(cacheKey);
              }
            }
          } catch (e) {
            console.warn('Failed to parse cached URL:', e);
            localStorage.removeItem(cacheKey);
          }
        }

        // Get new signed URL if no valid cache exists
        return await refreshSignedUrl(fullPath, cacheKey);
      }

      async function refreshSignedUrl(fullPath: string, cacheKey: string): Promise<string> {
        console.log('🔐 Getting new signed URL for:', fullPath);
        console.log('🔐 isWebnovel flag:', isWebnovel);
        console.log('🔐 user.id:', user.id);
        console.log('🔐 params.supabase_upload_id:', params.supabase_upload_id);
        
        // Use the correct bucket based on whether it's a webnovel
        const bucketName = isWebnovel ? 'webnovel' : 'uploads';
        console.log(`🔐 Using ${bucketName} bucket for ${isWebnovel ? 'webnovel' : 'regular book'}`);
        console.log(`🔐 Full URL will be: https://zymtifflnqbwoozwmzip.supabase.co/storage/v1/object/authenticated/${bucketName}/${fullPath}`);
        
        const { data, error } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(fullPath, ONE_HOUR_IN_SECONDS);
        
        if (error) {
          console.error('❌ Failed to get signed URL:', error);
          console.error('   File path:', fullPath);
          console.error('   Bucket:', bucketName);
          console.error('   Error details:', JSON.stringify(error, null, 2));
          throw error;
        }

        // Store the new URL in localStorage
        const cacheEntry: SignedUrlCache = {
          url: data.signedUrl,
          expiresAt: Date.now() + (ONE_HOUR_IN_SECONDS * 1000),
          sessionId: session.access_token
        };

        try {
          localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
          console.log('✅ Cached new signed URL for:', fullPath);
        } catch (e) {
          console.warn('Failed to cache signed URL:', e);
        }
        
        return data.signedUrl;
      }

      let url: string;
      if (isWebnovel) {
        // For webnovels, always use direct public URL (no signed URLs needed)
        const projectUrl = 'zymtifflnqbwoozwmzip.supabase.co';
        url = `https://${projectUrl}/storage/v1/object/public/webnovel/${pagePath}`;
        console.log('🔓 Using public URL for webnovel:', url);
      } else {
        // For private books, use signed URL
        url = await getSignedUrl(pagePath);
      }
      console.log('📡 Fetching content from:', url);

      const response = await fetch(url);

      if (!response.ok) {
        console.error('❌ Content fetch failed:', response.status, response.statusText);
        throw new Error(`Failed to fetch page content: ${response.statusText}`);
      }

      const content = await response.text();
      console.log('📄 Received content length:', content.length);

      console.log('🔄 Transforming content...');

      // For webnovels, use a function that generates public URLs for resources
      // For private books, use signed URLs
      const resourceUrlFunction = isWebnovel
        ? async (resourcePath: string): Promise<string> => {
            const projectUrl = 'zymtifflnqbwoozwmzip.supabase.co';
            const fullPath = `${params.supabase_upload_id}/${resourcePath}`;
            return `https://${projectUrl}/storage/v1/object/public/webnovel/${fullPath}`;
          }
        : getSignedUrl;

      const { content: transformedContent, contentType } = await transformEpubContent(
        content,
        params.supabase_upload_id,
        resourceUrlFunction,
        book.spine[pageIndex]
      );

      callbacks.setContent({ content: transformedContent, contentType });
      callbacks.setCurrentBook({
        supabase_upload_id: params.supabase_upload_id,
        currentPage: pageIndex,
        totalPages: book.total_pages,
        isWebnovel: isWebnovel
      });

      // Handle bookmark restoration
      if (callbacks.getBookmark(params.supabase_upload_id)) {
        console.log('🔖 Restoring bookmark position...');
        if (params.iframeRef.current?.contentDocument?.readyState === 'complete') {
          console.log('📄 Document ready, restoring immediately');
          const bookmark = await callbacks.getBookmark(params.supabase_upload_id);
          if (bookmark) {
            setTimeout(() => callbacks.restorePosition(bookmark), 100);
          }
        } else {
          console.log('⏳ Waiting for document load before restoring position');
          params.iframeRef.current?.addEventListener('load', async () => {
            const bookmark = await callbacks.getBookmark(params.supabase_upload_id);
            if (bookmark) {
              setTimeout(() => callbacks.restorePosition(bookmark), 100);
            }
          }, { once: true });
        }
      }

      console.log('✅ loadBookContent completed successfully');
    } catch (error: any) {
      console.error('❌ loadBookContent failed:', error);
      callbacks.setError(error.message);
    } finally {
      callbacks.setIsLoading(false);
      console.log('🏁 loadBookContent finished');
    }
}