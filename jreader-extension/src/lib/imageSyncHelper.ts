/**
 * Helper function for syncing images to Anki with deduplication and caching
 */

import { browser } from './browser';
import { getSignedImageUrl } from './utils';

export interface AnkiSettings {
  anki_connect_url: string;
}

/**
 * Checks if a file exists in Anki's media collection
 * Uses getMediaFilesNames to check for exact filename matches
 */
export async function checkMediaExistsInAnki(
  ankiFilename: string, 
  ankiSettings: AnkiSettings
): Promise<boolean> {
  try {
    const checkMediaRequest = {
      action: 'getMediaFilesNames',
      version: 6,
      params: {
        pattern: ankiFilename
      }
    };
    
    console.log('🔄 IMAGE_SYNC: Checking if image exists in Anki:', ankiFilename);
    const response = await fetch(ankiSettings.anki_connect_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkMediaRequest)
    });
    
    const result = await response.json();
    console.log('🔄 IMAGE_SYNC: getMediaFilesNames response:', result);
    
    // Check if the exact filename is in the results
    const exists = !result.error && result.result && result.result.includes(ankiFilename);
    console.log('🔄 IMAGE_SYNC: Image exists check result:', exists ? 'EXISTS' : 'NOT_FOUND');
    return exists;
  } catch (error) {
    console.error('🔄 IMAGE_SYNC: Error checking if image exists in Anki:', error);
    // Fall back to persistent storage on any error
    return await checkMediaExistsInPersistentStorage(ankiFilename);
  }
}

/**
 * Fallback method to check if image exists using persistent storage
 * This maintains a record of images we've successfully stored
 */
async function checkMediaExistsInPersistentStorage(ankiFilename: string): Promise<boolean> {
  try {
    // Use browser storage to track images we've successfully stored
    const storageKey = 'jreader_stored_images';
    const storedImages = await browser.storage.local.get(storageKey);
    const storedImageArray = (storedImages[storageKey] as string[] | undefined) || [];
    const imageSet = new Set(storedImageArray);

    const exists = imageSet.has(ankiFilename);
    console.log('🔄 IMAGE_SYNC: Persistent storage check for', ankiFilename, ':', exists ? 'EXISTS' : 'NOT_FOUND');
    return exists;
  } catch (error) {
    console.error('🔄 IMAGE_SYNC: Error checking persistent storage:', error);
    return false;
  }
}

/**
 * Records that an image was successfully stored in Anki
 */
async function recordImageStored(ankiFilename: string): Promise<void> {
  try {
    const storageKey = 'jreader_stored_images';
    const storedImages = await browser.storage.local.get(storageKey);
    const storedImageArray = (storedImages[storageKey] as string[] | undefined) || [];
    const imageSet = new Set(storedImageArray);

    imageSet.add(ankiFilename);

    await browser.storage.local.set({
      [storageKey]: Array.from(imageSet)
    });

    console.log('🔄 IMAGE_SYNC: Recorded image as stored:', ankiFilename);
  } catch (error) {
    console.error('🔄 IMAGE_SYNC: Error recording stored image:', error);
  }
}

/**
 * Fetches an image from Supabase and converts it to base64
 */
export async function fetchImageForAnki(imagePath: string): Promise<string | null> {
  try {
    console.log('🔄 IMAGE_SYNC: Starting image fetch for path:', imagePath);
    
    // Normalize path separators (convert backslashes to forward slashes)
    const normalizedPath = imagePath.replace(/\\/g, '/');
    console.log('🔄 IMAGE_SYNC: Normalized path:', normalizedPath);
    
    console.log('🔄 IMAGE_SYNC: Requesting signed URL from API...');
    const signedUrl = await getSignedImageUrl(normalizedPath);
    console.log('🔄 IMAGE_SYNC: Got signed URL, fetching image...');
    
    // Fetch the image
    const imageResponse = await fetch(signedUrl);
    if (!imageResponse.ok) {
      console.error('🔄 IMAGE_SYNC: Failed to fetch image from signed URL:', signedUrl, 'Status:', imageResponse.status);
      return null;
    }
    
    console.log('🔄 IMAGE_SYNC: Image fetched successfully, converting to base64...');
    // Convert to base64 using a more memory-efficient approach
    const arrayBuffer = await imageResponse.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert in chunks to avoid stack overflow for large images
    let binaryString = '';
    const chunkSize = 8192; // Process 8KB at a time
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binaryString += String.fromCharCode(...chunk);
    }
    
    const base64 = btoa(binaryString);
    console.log('🔄 IMAGE_SYNC: Image converted to base64, length:', base64.length);
    return base64;
  } catch (error) {
    console.error('🔄 IMAGE_SYNC: Error fetching image for Anki:', imagePath, error);
    return null;
  }
}

/**
 * Stores an image in Anki's media collection
 */
export async function storeImageInAnki(
  ankiFilename: string,
  imageBase64: string,
  ankiSettings: AnkiSettings
): Promise<boolean> {
  try {
    const storeMediaRequest = {
      action: 'storeMediaFile',
      version: 6,
      params: {
        filename: ankiFilename,
        data: imageBase64
      }
    };

    console.log('🔄 IMAGE_SYNC: 📥 Storing new image file:', ankiFilename, 'Size:', imageBase64.length, 'chars');
    const response = await fetch(ankiSettings.anki_connect_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(storeMediaRequest)
    });

    const result = await response.json();
    console.log('🔄 IMAGE_SYNC: storeMediaFile response:', result);

    if (result.error) {
      console.error('🔄 IMAGE_SYNC: ❌ Failed to store image file:', result.error);
      return false;
    } else {
      console.log('🔄 IMAGE_SYNC: ✅ Successfully stored image:', ankiFilename);
      // Record that this image was successfully stored for future deduplication
      await recordImageStored(ankiFilename);
      return true;
    }
  } catch (error) {
    console.error('🔄 IMAGE_SYNC: Error storing image in Anki:', ankiFilename, error);
    return false;
  }
}
