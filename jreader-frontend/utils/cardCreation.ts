import { extractAudioUrlWithoutParams } from './audioUtils';

import { createDatabaseClient, type DatabaseClient, type CardInsertData, SupabaseDatabaseClient } from '@/utils/supabase/database';

export interface CardCreationData {
  term: string;
  reading?: string;
  definitions: any[];
  sentence?: string;
  pitchAccent?: string;
  frequencyPairs: any[];
  expressionAudio?: string;
  documentTitle?: string;
}

export interface CardCreationResult {
  success: boolean;
  data?: any[];
  error?: string;
}

/**
 * Creates a card in the database with the provided data using a database client
 *
 * This function accepts both DatabaseClient instances and raw Supabase clients for backwards compatibility.
 * During E2E tests, a MockDatabaseClient is injected via createDatabaseClient().
 * In production, the Supabase client is wrapped in a SupabaseDatabaseClient.
 *
 * This dual-support approach minimizes changes while enabling mock responses in tests.
 *
 * @param dbClient - The database client to use (DatabaseClient or raw Supabase client)
 * @param cardData - The card data to insert
 * @returns Promise<CardCreationResult> - The result of the card creation
 */
export async function createCardInDatabaseWithClient(dbClient: DatabaseClient | any, cardData: CardCreationData): Promise<CardCreationResult> {
  try {
    const dbCardData: CardInsertData = {
      expression: cardData.term,
      reading: cardData.reading || '',
      definitions: cardData.definitions,
      sentence: cardData.sentence || null,
      pitch_accent: cardData.pitchAccent || null,
      frequency: cardData.frequencyPairs,
      expression_audio: cardData.expressionAudio || null,
      document_title: cardData.documentTitle || null,
      anki_note_id: null,
      anki_model: null,
      anki_deck: null,
      sync_status: 'local_only',
      synced_at: null
    };

    // Check if the client is already a DatabaseClient instance with the insertCard method
    if (dbClient && typeof dbClient.insertCard === 'function') {
      // Use the client directly - this happens with MockDatabaseClient in tests
      const result = await dbClient.insertCard(dbCardData);

      if (result.error) {
        return { success: false, error: result.error.message };
      }

      return { success: true, data: result.data };
    } else {
      // Fallback: wrap raw Supabase client in SupabaseDatabaseClient for compatibility
      // This allows callers to pass the raw Supabase client without modifying their code
      const dbClientWrapper = new SupabaseDatabaseClient(dbClient);
      const result = await dbClientWrapper.insertCard(dbCardData);

      if (result.error) {
        return { success: false, error: result.error.message };
      }

      return { success: true, data: result.data };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Creates a card in the database with the provided data
 * Automatically uses mock client in test mode, production client otherwise
 * @param cardData - The card data to insert
 * @returns Promise<CardCreationResult> - The result of the card creation
 */
export async function createCardInDatabase(cardData: CardCreationData): Promise<CardCreationResult> {
  try {
    const dbClient = createDatabaseClient();
    return await createCardInDatabaseWithClient(dbClient, cardData);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Processes audio data and extracts the audio URL for storage
 * @param audioData - The audio data from the API response
 * @returns string | null - The processed audio URL or null if no audio
 */
export function processAudioForCard(audioData: any): string | null {
  if (!audioData?.audioSources?.length) {
    return null;
  }
  
  const firstAudioSource = audioData.audioSources[0];
  const mediaPath = firstAudioSource.url.replace('/audio/', '/media/');
  return extractAudioUrlWithoutParams(mediaPath);
}

/**
 * Validates that a card creation result has a valid ID
 * @param result - The card creation result
 * @returns boolean - True if the result has a valid ID
 */
export function validateCardCreationResult(result: CardCreationResult): boolean {
  return !!(result.success && 
            result.data && 
            result.data.length > 0 && 
            result.data[0].id != null);
}
