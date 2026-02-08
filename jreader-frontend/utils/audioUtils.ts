/**
 * Utility functions for audio-related operations
 * 
 * NOTE: This file has a copy in the browser extension at:
 * jreader-extension/src/lib/utils.ts
 * 
 * The getSignedAudioUrl and extractRelativePath functions should be kept in sync
 * between both locations.
 * 
 * UPDATE: The extension version now calls a proxy API (/api/extension/sign-audio-url)
 * while the frontend version calls the direct API (/api/sign-audio-url) for security reasons.
 */

/**
 * Generates a signed URL for an audio file
 * 
 * SYNC: This function is duplicated in jreader-extension/src/lib/utils.ts
 * Keep in sync with the extension version.
 * 
 * @param relativePath - The relative path to the audio file (e.g., "jpod_files/media/track.opus")
 * @returns Promise<string> - The signed URL for the audio file
 * @throws Error if the signed URL generation fails
 */
export async function getSignedAudioUrl(relativePath: string): Promise<string> {
  const response = await fetch(`/api/sign-audio-url?path=${encodeURIComponent(relativePath)}`);
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = 'Failed to get signed URL';
    
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.error || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    
    throw new Error(errorMessage);
  }
  
  const { url: signedUrl } = await response.json();
  return signedUrl;
}

/**
 * Plays an audio file using a signed URL
 * @param relativePath - The relative path to the audio file
 * @param isAuthenticated - Whether the user is authenticated (optional, defaults to true for backward compatibility)
 * @returns Promise<{ success: boolean; requiresAuth?: boolean }> - Returns success status and whether auth is required
 * @throws Error if audio playback fails (but not for authentication issues)
 */
export async function playAudio(relativePath: string, isAuthenticated: boolean = true): Promise<{ success: boolean; requiresAuth?: boolean }> {
  // Return a result instead of throwing for auth issues
  if (!isAuthenticated) {
    return { success: false, requiresAuth: true };
  }

  const signedUrl = await getSignedAudioUrl(relativePath);

  // Create audio element and play directly
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.src = signedUrl;

  // Play the audio (call in user gesture context for Safari)
  await audio.play();
  return { success: true };
}

/**
 * Plays an audio file from a full audio URL (extracts relative path automatically)
 * @param audioUrl - The full audio URL (e.g., "/audio/jpod_files/media/track.opus")
 * @param isAuthenticated - Whether the user is authenticated (optional, defaults to true for backward compatibility)
 * @returns Promise<{ success: boolean; requiresAuth?: boolean }> - Returns success status and whether auth is required
 * @throws Error if audio playback fails (but not for authentication issues)
 */
export async function playAudioFromUrl(audioUrl: string, isAuthenticated: boolean = true): Promise<{ success: boolean; requiresAuth?: boolean }> {
  const relativePath = extractRelativePath(audioUrl);
  return await playAudio(relativePath, isAuthenticated);
}

/**
 * Extracts the relative path from a full audio URL
 * 
 * SYNC: This function is duplicated in jreader-extension/src/lib/utils.ts
 * Keep in sync with the extension version.
 * 
 * @param audioUrl - The full audio URL (e.g., "/audio/jpod_files/media/track.opus")
 * @returns The relative path (e.g., "jpod_files/media/track.opus")
 */
export function extractRelativePath(audioUrl: string): string {
  return audioUrl.replace('/audio/', '');
}

/**
 * Extracts the audio URL without query parameters for storage
 * @param signedUrl - The signed URL (e.g., "/media/jpod_files/media/track.opus?exp=123&sig=abc")
 * @returns The URL without query parameters (e.g., "/media/jpod_files/media/track.opus")
 */
export function extractAudioUrlWithoutParams(signedUrl: string): string {
  return signedUrl.split('?')[0];
}
