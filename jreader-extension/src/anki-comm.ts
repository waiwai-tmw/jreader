import { fetchImageForAnki, storeImageInAnki, checkMediaExistsInAnki } from './lib/imageSyncHelper';

// Fetch audio file and convert to base64 for Anki
export const fetchAudioForAnki = async (audioUrl: string): Promise<string | null> => {
    console.log('🎵 DEBUG: fetchAudioForAnki called with audioUrl:', audioUrl);
    
    if (!audioUrl) {
      console.log('🎵 DEBUG: No audioUrl provided, returning null');
      return null;
    }
    
    try {
      console.log('🎵 Fetching audio for Anki:', audioUrl);
      
      // Get signed URL for the audio file
      const { getSignedAudioUrl } = await import('./lib/utils');
      const relativePath = audioUrl.replace('/media/', '');
      console.log('🎵 DEBUG: Extracted relativePath:', relativePath);
      
      const signedUrl = await getSignedAudioUrl(relativePath);
      
      console.log('🎵 Got signed URL:', signedUrl);
      
      // Fetch the audio file
      const response = await fetch(signedUrl);
      if (!response.ok) {
        console.error('🎵 Failed to fetch audio:', response.status, response.statusText);
        return null;
      }
      
      // Convert to blob and then to base64
      const audioBlob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove the data URL prefix (e.g., "data:audio/opus;base64,")
          const base64Data = result.split(',')[1];
          if (!base64Data) {
            reject(new Error('Failed to extract base64 data from audio'));
            return;
          }
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });
      
      console.log('🎵 Audio converted to base64, length:', base64.length);
      return base64;
    } catch (error) {
      console.error('🎵 Error fetching audio for Anki:', error);
      return null;
    }
  };

// Health check function for AnkiConnect
export const checkAnkiConnectHealth = async (ankiConnectUrl: string): Promise<{ available: boolean; error?: string }> => {
    try {
      console.log('🔍 Checking AnkiConnect health at:', ankiConnectUrl);
      
      const healthRequest = {
        action: 'version',
        version: 6
      };
      
      const response = await fetch(ankiConnectUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(healthRequest)
      });
      
      if (!response.ok) {
        console.log('🔍 AnkiConnect health check failed - HTTP error:', response.status);
        return { available: false, error: `HTTP ${response.status}` };
      }
      
      const result = await response.json();
      
      if (result.error) {
        console.log('🔍 AnkiConnect health check failed - API error:', result.error);
        return { available: false, error: result.error };
      }
      
      console.log('🔍 AnkiConnect health check successful - version:', result.result);
      return { available: true };
      
    } catch (error) {
      console.log('🔍 AnkiConnect health check failed - network error:', error);
      return { available: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  };

export const openAnkiNote = async (noteId: string, ankiConnectUrl: string): Promise<Response> => {
    // Send request to AnkiConnect to open the note
    const ankiResponse = await fetch(ankiConnectUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        action: 'guiBrowse',
        version: 6,
        params: {
            query: `nid:${noteId}`
        }
        })
    });

    return ankiResponse;
};

// Types used by the new media upload helper
export type AudioUploadPlan = {
  fieldName: string;
  sourceUrl: string;
  ankiFilename: string;
};

export type ImageUploadPlan = {
  fieldName: string;
  dictionary: string;
  sourcePath: string;
  ankiFilename: string;
};

export type MediaPlan = {
  cardId: string;
  audioToUpload: AudioUploadPlan[];
  imagesToUpload: ImageUploadPlan[];
};

export type MediaStats = {
  audio: { uploaded: number; skipped: number; failed: number };
  images: { uploaded: number; skipped: number; failed: number };
};

/**
 * Uploads all media described by mediaPlans to Anki's media collection.
 * Skips files that already exist by checking via getMediaFilesNames.
 * Uses fetchAudioForAnki and imageSyncHelper utilities.
 */
export async function uploadMediaPlansToAnki(
  ankiConnectUrl: string,
  mediaPlans: MediaPlan[]
): Promise<MediaStats> {
  const stats: MediaStats = {
    audio: { uploaded: 0, skipped: 0, failed: 0 },
    images: { uploaded: 0, skipped: 0, failed: 0 }
  };

  // In-memory cache to avoid redundant checks within this batch
  const processedMedia = new Set<string>();

  for (const plan of mediaPlans) {
    console.log('🧩 Uploading media for card:', plan.cardId, {
      audioCount: plan.audioToUpload?.length || 0,
      imageCount: plan.imagesToUpload?.length || 0
    });

    // Audio uploads
    for (const a of plan.audioToUpload) {
      // Check cache first
      if (processedMedia.has(a.ankiFilename)) {
        stats.audio.skipped += 1;
        console.log('🎵 Audio already processed in this batch, skipping:', a.ankiFilename);
        continue;
      }

      const exists = await checkMediaExistsInAnki(a.ankiFilename, { anki_connect_url: ankiConnectUrl });
      if (exists) {
        stats.audio.skipped += 1;
        processedMedia.add(a.ankiFilename);
        console.log('🎵 Audio exists, skipping:', a.ankiFilename);
        continue;
      }

      const audioBase64 = await fetchAudioForAnki(a.sourceUrl);
      if (!audioBase64) {
        stats.audio.failed += 1;
        console.warn('🎵 Failed to fetch audio:', a.sourceUrl);
        continue;
      }

      const storeAudioReq = {
        action: 'storeMediaFile',
        version: 6,
        params: { filename: a.ankiFilename, data: audioBase64 }
      };
      const resp = await fetch(ankiConnectUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeAudioReq)
      });
      try {
        const json = await resp.json();
        if (json?.error) {
          stats.audio.failed += 1;
          console.error('🎵 storeMediaFile audio error:', json.error);
        } else {
          stats.audio.uploaded += 1;
          processedMedia.add(a.ankiFilename);
          console.log('🎵 Uploaded audio:', a.ankiFilename);
        }
      } catch {
        stats.audio.failed += 1;
        console.error('🎵 storeMediaFile audio response parse error');
      }
    }

    // Image uploads
    for (const img of plan.imagesToUpload) {
      // Check cache first
      if (processedMedia.has(img.ankiFilename)) {
        stats.images.skipped += 1;
        console.log('🖼️ Image already processed in this batch, skipping:', img.ankiFilename);
        continue;
      }

      const exists = await checkMediaExistsInAnki(img.ankiFilename, { anki_connect_url: ankiConnectUrl });
      if (exists) {
        stats.images.skipped += 1;
        processedMedia.add(img.ankiFilename);
        console.log('🖼️ Image exists, skipping:', img.ankiFilename);
        continue;
      }

      const base64 = await fetchImageForAnki(img.sourcePath);
      if (!base64) {
        stats.images.failed += 1;
        console.warn('🖼️ Failed to fetch image:', img.sourcePath);
        continue;
      }

      const stored = await storeImageInAnki(img.ankiFilename, base64, { anki_connect_url: ankiConnectUrl });
      if (stored) {
        stats.images.uploaded += 1;
        processedMedia.add(img.ankiFilename);
        console.log('🖼️ Uploaded image:', img.ankiFilename);
      } else {
        stats.images.failed += 1;
        console.error('🖼️ Failed to upload image:', img.ankiFilename);
      }
    }
  }

  return stats;
}