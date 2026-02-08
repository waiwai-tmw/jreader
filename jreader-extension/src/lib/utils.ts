import { type ClassValue, clsx } from "clsx"

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}

/**
 * NOTE: The audio utility functions below (getSignedAudioUrl and extractRelativePath)
 * are copies of functions from the frontend at:
 * jreader-frontend/utils/audioUtils.ts
 * 
 * These functions should be kept in sync between both locations.
 * 
 * UPDATE: The extension version calls a proxy API (/api/extension/sign-audio-url)
 * while the frontend version calls the direct API (/api/sign-audio-url) for security reasons.
 */

/**
 * Generates a signed URL for an audio file
 * 
 * SYNC: This function is duplicated from jreader-frontend/utils/audioUtils.ts
 * Keep in sync with the frontend version.
 * 
 * @param relativePath - The relative path to the audio file (e.g., "jpod_files/media/track.opus")
 * @returns Promise<string> - The signed URL for the audio file
 * @throws Error if the signed URL generation fails
 */
export async function getSignedAudioUrl(relativePath: string): Promise<string> {
  console.log('🎵 DEBUG: getSignedAudioUrl called with relativePath:', relativePath);

  const apiBaseUrl = process.env['API_BASE_URL'];
  const proxyUrl = `${apiBaseUrl}/api/extension/sign-audio-url?path=${encodeURIComponent(relativePath)}`;
  
  console.log('🎵 DEBUG: Using API base URL:', apiBaseUrl);
  console.log('🎵 Extension requesting signed audio URL from proxy:', proxyUrl);
  
  try {
    const response = await fetch(proxyUrl);
    console.log('🎵 DEBUG: Proxy response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🎵 DEBUG: Proxy error response:', errorText);
      let errorMessage = 'Failed to get signed URL';
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      
      throw new Error(errorMessage);
    }
    
    const responseData = await response.json();
    console.log('🎵 DEBUG: Proxy response data:', responseData);
    
    const { url: signedUrl } = responseData;
    console.log('🎵 Extension received signed URL:', signedUrl);
    return signedUrl;
  } catch (error) {
    console.error('🎵 DEBUG: Error in getSignedAudioUrl:', error);
    throw error;
  }
}

/**
 * Generates a signed URL for an image file
 * 
 * @param relativePath - The relative path to the image file (e.g., "img2/855734f9c80388773fb2b7470507d651.png")
 * @returns Promise<string> - The signed URL for the image file
 * @throws Error if the signed URL generation fails
 */
export async function getSignedImageUrl(relativePath: string): Promise<string> {
  console.log('🖼️ DEBUG: getSignedImageUrl called with relativePath:', relativePath);

  const apiBaseUrl = process.env['API_BASE_URL'];
  const proxyUrl = `${apiBaseUrl}/api/extension/sign-image-url?path=${encodeURIComponent(relativePath)}`;
  
  console.log('🖼️ DEBUG: Using API_BASE_URL:', apiBaseUrl);
  console.log('🖼️ Extension requesting signed image URL from proxy:', proxyUrl);
  
  try {
    const response = await fetch(proxyUrl);
    console.log('🖼️ DEBUG: Proxy response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🖼️ DEBUG: Proxy error response:', errorText);
      let errorMessage = 'Failed to get signed URL';
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      
      throw new Error(errorMessage);
    }
    
    const responseData = await response.json();
    console.log('🖼️ DEBUG: Proxy response data:', responseData);
    
    const { url: signedUrl } = responseData;
    console.log('🖼️ Extension received signed URL:', signedUrl);
    return signedUrl;
  } catch (error) {
    console.error('🖼️ DEBUG: Error in getSignedImageUrl:', error);
    throw error;
  }
}
