import { getBackendApiUrl } from '@/utils/api';
import { getCurrentUsername } from '@/lib/client-auth';

export interface ImportProgress {
  id: string;
  user_id: string;
  url: string;
  status: 'Starting' | 'Downloading' | 'EpubGenerated' | 'Processing' | 'Uploading' | 'Finalizing' | 'Completed' | { Failed: string } | 'Cancelled';
  logs: string[];
  started_at: string;
  updated_at: string;
  process_id?: number;
  total_chapters?: number;
  current_chapter?: number;
}

export interface ImportProgressResponse {
  imports: ImportProgress[];
}

export async function fetchImportProgress(): Promise<ImportProgressResponse> {
  const username = getCurrentUsername();

  // If no username, return empty imports
  if (!username) {
    return { imports: [] };
  }

  const apiUrl = `${getBackendApiUrl()}/api/import-progress`;

  // Create an AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-Username': username,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch import progress: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out while fetching import progress');
    }
    throw error;
  }
}

export async function cancelImport(importId: string): Promise<void> {
  const username = getCurrentUsername();

  if (!username) {
    throw new Error('Not authenticated');
  }

  const apiUrl = `${getBackendApiUrl()}/api/import-progress/${importId}/cancel`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'X-Username': username
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to cancel import: ${response.statusText}`);
  }
}

export async function updateImportProgress(importId: string, status: string, log?: string): Promise<void> {
  const username = getCurrentUsername();

  if (!username) {
    throw new Error('Not authenticated');
  }

  const baseUrl = getBackendApiUrl();
  const apiUrl = `${baseUrl}/api/import-progress/${importId}/update`;

  console.log('Updating import progress:', {
    importId,
    status,
    log,
    baseUrl,
    apiUrl,
    hasUsername: !!username,
    isServer: typeof window === 'undefined'
  });

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'X-Username': username,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status,
      log
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to update import progress:', {
      status: response.status,
      statusText: response.statusText,
      errorText
    });
    throw new Error(`Failed to update import progress: ${response.statusText}`);
  }

  console.log('Successfully updated import progress');
}

export async function clearCompletedImports(): Promise<{ removed_count: number }> {
  const username = getCurrentUsername();

  if (!username) {
    throw new Error('Not authenticated');
  }

  const baseUrl = getBackendApiUrl();
  const apiUrl = `${baseUrl}/api/import-progress/clear`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Username': username
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to clear completed imports:', {
      status: response.status,
      statusText: response.statusText,
      errorText
    });
    throw new Error(`Failed to clear completed imports: ${response.statusText}`);
  }

  const result = await response.json();
  return result;
}

