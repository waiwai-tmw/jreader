import type { LookupTermResponse } from '@/types/backend-types';
import { getBackendApiUrl } from '@/utils/api';
import { getMetadata } from '@/utils/supabase/client';

export const backendService = {
  lookupTerm: async (term: string, position: number): Promise<LookupTermResponse | null> => {
    console.log(`📤 Sending lookup request for term: "${term}" at position ${position}`);
    const metadata = await getMetadata();

    try {
      // Build headers - only include Authorization if we have a token
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (metadata.accessToken) {
        headers['Authorization'] = `Bearer ${metadata.accessToken}`;
      }

      const response = await fetch(`${getBackendApiUrl()}/api/lookup`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          term,
          position
        })
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`🔍 No results found for "${term}"`);
          return null;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📥 Got response:', result);

      if (!result.dictionaryResults?.length) {
        console.log('❌ No dictionary results found');
        return null;
      }

      return result;
    } catch (error: any) {
      console.error('Full error object:', error);
      console.log(`❌ Request failed for "${term}":`, error.message);
      return null;
    }
  }
}; 