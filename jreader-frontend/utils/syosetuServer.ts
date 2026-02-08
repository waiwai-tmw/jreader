import type { SyosetuApiResponse } from './syosetuApi';
import { extractNcodeFromUrl } from './syosetuGenres';

/**
 * Server-side utility to fetch Syosetu metadata
 * This should only be used in server-side code (API routes, server components)
 * Note: Server-side caching would require a different approach (Redis, database, etc.)
 */
export async function fetchSyosetuMetadataServer(ncode: string): Promise<SyosetuApiResponse | null> {
  try {
    const syosetuUrl = `https://api.syosetu.com/novelapi/api/?ncode=${ncode}&out=json`;
    console.log('Fetching Syosetu metadata from:', syosetuUrl);
    
    const response = await fetch(syosetuUrl);
    if (!response.ok) {
      console.warn('Failed to fetch Syosetu metadata:', response.status);
      return null;
    }
    
    const data = await response.json();
    if (Array.isArray(data) && data.length >= 2 && data[1]) {
      console.log('Successfully fetched Syosetu metadata:', {
        title: data[1].title,
        ncode: data[1].ncode
      });
      return data[1];
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching Syosetu metadata:', error);
    return null;
  }
}

/**
 * Server-side utility to fetch Syosetu metadata from a URL
 * This should only be used in server-side code (API routes, server components)
 */
export async function fetchSyosetuMetadataFromUrl(url: string): Promise<SyosetuApiResponse | null> {
  const ncode = extractNcodeFromUrl(url);
  if (!ncode) {
    console.warn('Could not extract N-code from URL:', url);
    return null;
  }
  
  return fetchSyosetuMetadataServer(ncode);
}
