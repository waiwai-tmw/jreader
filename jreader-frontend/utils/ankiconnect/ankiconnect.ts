import { buildAnkiNoteFields } from './anki-fmt';

// Local definition for Anki settings used in this module
type AnkiSettings = {
  anki_connect_url: string;
  anki_deck: string;
  anki_note_type: string;
};

function canonicalizeString(str: string): string {
  return str
    .replace(/[\/\\]/g, '_')
    .replace(/\./g, '_')
    .replace(/[<>:"|?*]/g, '_') // Replace only problematic filesystem characters
    .replace(/[\[\](){}]/g, '_') // Replace brackets and parentheses
    .replace(/\s+/g, '_') // Replace whitespace with underscores
    .replace(/_+/g, '_') // Collapse multiple underscores into one
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}

function splitFilenameAndExtension(filename: string): { filename: string, extension: string } {
    // Extract extension before canonicalizing
    const lastDotIndex = filename.lastIndexOf('.');
    const extension = lastDotIndex !== -1 ? filename.substring(lastDotIndex) : '';
    const pathWithoutExtension = lastDotIndex !== -1 ? filename.substring(0, lastDotIndex) : filename;
    return { filename: pathWithoutExtension, extension };
}

// Helper to derive a safe Anki media filename for audio
export function planAnkiAudioFilename(cardId: string | number, audioUrl: string): string {
  if (!audioUrl || audioUrl.trim() === '') {
    throw new Error(`Invalid audioUrl for cardId ${cardId}: audioUrl cannot be empty`);
  }

  // Remove query params and fragments, just like before
  const sanitized: string = audioUrl.split('?')[0]!.split('#')[0]!;

  // Extract extension and validate it
  const extCandidate = sanitized.includes('.') ? sanitized.split('.').pop() || '' : '';
  // We should only ever be using .mp3 here, because Anki on iOS cannot play .opus
  if (extCandidate?.toLowerCase() !== 'mp3') {
    console.warn('🎵 Unexpected audio extension for card id:', cardId, ':', extCandidate);
  }

  // Split the path and get the filename parts
  const { filename: pathWithoutExtension } = splitFilenameAndExtension(sanitized);

  // Canonicalize the path for filesystem compatibility
  const canonicalizedPath = canonicalizeString(pathWithoutExtension);

  // Always use .mp3 extension for consistency
  return `jreader_${canonicalizedPath}.mp3`;
}

/**
 * Generates a canonicalized filename for Anki based on dictionary name and image path
 */
export function generateAnkiImageFilename(dictionaryName: string, imagePath: string): string {
  // Canonicalize the dictionary name for filesystem compatibility
  const canonicalizedDictName = canonicalizeString(dictionaryName);

  // Extract just the base path from the full image path (remove dictionary name prefix if present)
  const pathParts = imagePath.split('/');
  const basePath = pathParts.length > 1 && pathParts[0] === dictionaryName 
    ? pathParts.slice(1).join('/') 
    : imagePath;

  const { filename: pathWithoutExtension, extension } = splitFilenameAndExtension(basePath);
  
  // Canonicalize the path without extension for filesystem compatibility
  const canonicalizedPath = canonicalizeString(pathWithoutExtension);
  
  // Preserve the original extension
  return `jreader_${canonicalizedDictName}_${canonicalizedPath}${extension}`;
}

/**
 * Prepare processed Anki note fields for a single card, without uploading media.
 * Builds fields, plans media filenames, and replaces placeholders with planned names.
 * Returns processed fields plus lists of media to upload (handled by extension).
 */
async function prepareProcessedNoteFields(
  card: Record<string, any>,
  fieldMappings: Record<string, any>
): Promise<{
  processedNoteFields: Record<string, string>;
  audioToUpload: Array<{ fieldName: string; sourceUrl: string; ankiFilename: string }>;
  imagesToUpload: Array<{ fieldName: string; dictionary: string; sourcePath: string; ankiFilename: string }>;
}> {
  const { noteFields, audioFields, imageFields } = buildAnkiNoteFields(card, fieldMappings);
  const processedNoteFields = { ...noteFields } as Record<string, string>;
  const audioToUpload: Array<{ fieldName: string; sourceUrl: string; ankiFilename: string }> = [];
  const imagesToUpload: Array<{ fieldName: string; dictionary: string; sourcePath: string; ankiFilename: string }> = [];

  // Plan audio filenames and update fields
  for (const [fieldName, audioUrl] of Object.entries(audioFields)) {
    const planned = planAnkiAudioFilename(card['id'], String(audioUrl));
    audioToUpload.push({ fieldName, sourceUrl: String(audioUrl), ankiFilename: planned });
    processedNoteFields[fieldName] = `[sound:${planned}]`;
  }

  // Plan image filenames and replace placeholders in fields
  for (const [fieldName, imagePath] of Object.entries(imageFields)) {
    const pathParts = String(imagePath).split('/');
    const dictionaryName = pathParts[0] || 'unknown';
    const planned = generateAnkiImageFilename(dictionaryName, String(imagePath));
    imagesToUpload.push({ fieldName, dictionary: dictionaryName, sourcePath: String(imagePath), ankiFilename: planned });

    const fieldParts = fieldName.split('_');
    const index = fieldParts.pop();
    let skipParts = 2;
    if (fieldParts[0] === 'main' && fieldParts[1] === 'definition') {
      skipParts = 3;
    }
    const dictHash = fieldParts.slice(skipParts).join('_');
    const placeholderPattern = dictHash
      ? new RegExp(`ANKI_IMAGE_PLACEHOLDER_${dictHash}_${index}`, 'g')
      : new RegExp(`ANKI_IMAGE_PLACEHOLDER_${index}`, 'g');

    Object.keys(processedNoteFields).forEach(fieldKey => {
      const value = processedNoteFields[fieldKey];
      if (typeof value === 'string' && value.includes('ANKI_IMAGE_PLACEHOLDER_')) {
        processedNoteFields[fieldKey] = value.replace(placeholderPattern, planned);
      }
    });
  }

  return { processedNoteFields, audioToUpload, imagesToUpload };
}

/**
 * Batch sync multiple cards using AnkiConnect addNotes.
 * Prepares media for each card, builds the notes array, sends one request,
 * and updates Supabase per-card for successes.
 */
type AnkiConnectAddNotesRequest = {
  action: 'addNotes';
  version: 6;
  params: {
    notes: Array<{
      deckName: string;
      modelName: string;
      fields: Record<string, string>;
      tags: string[];
    }>;
  };
};

type MediaPlan = {
  cardId: number;
  audioToUpload: Array<{ fieldName: string; sourceUrl: string; ankiFilename: string }>;
  imagesToUpload: Array<{ fieldName: string; dictionary: string; sourcePath: string; ankiFilename: string }>;
};

type SkippedCard = {
  id: number;
  reason: 'not_synced' | 'error';
};

type SyncCardsToAnkiResult = {
  addNotesRequest: AnkiConnectAddNotesRequest;
  mediaPlans: MediaPlan[];
};

export const syncCardsToAnki = async (
  cards: Record<string, any>[],
  ankiSettings: AnkiSettings,
  fieldMappings: Record<string, any>
): Promise<SyncCardsToAnkiResult> => {
  try {
    if (!cards || cards.length === 0) {
      return { addNotesRequest: { action: 'addNotes', version: 6, params: { notes: [] } }, mediaPlans: [] };
    }

    const notes: AnkiConnectAddNotesRequest['params']['notes'] = [];
    const mediaPlans: MediaPlan[] = [];

    for (const card of cards) {
      const { processedNoteFields, audioToUpload, imagesToUpload } = await prepareProcessedNoteFields(card, fieldMappings);
      notes.push({
        deckName: ankiSettings.anki_deck,
        modelName: ankiSettings.anki_note_type,
        fields: processedNoteFields,
        tags: ['jreader']
      });
      mediaPlans.push({ cardId: card['id'], audioToUpload, imagesToUpload });
    }

    const addNotesRequest = {
      action: 'addNotes' as const,
      version: 6 as const,
      params: { notes }
    };

    return { addNotesRequest, mediaPlans };
  } catch (error: any) {
    console.error('Error in syncCardsToAnki:', error);
    throw error;
  }
};

/**
 * Updates existing cards in Anki using AnkiConnect updateNoteFields.
 * Prepares media and field updates for each card, generating individual update requests.
 * Only processes cards that have already been synced to Anki (have anki_note_id).
 * Returns both the update requests and a list of cards that were skipped.
 */
type AnkiConnectUpdateNoteFieldsRequest = {
  action: 'updateNoteFields';
  version: 6;
  params: {
    note: {
      id: number;
      fields: Record<string, string>;
    };
  };
};

type AnkiConnectUpdateNoteFieldsRequestAndMediaPlan = {
  request: AnkiConnectUpdateNoteFieldsRequest;
  mediaPlan: MediaPlan;
};

type UpdateCardsInAnkiResult = {
  requests: AnkiConnectUpdateNoteFieldsRequestAndMediaPlan[];
  skippedCards: SkippedCard[];
};

export const updateCardsInAnki = async (
  cards: Record<string, any>[],
  fieldMappings: Record<string, any>
): Promise<UpdateCardsInAnkiResult> => {
  try {
    if (!cards || cards.length === 0) {
      return { requests: [], skippedCards: [] };
    }

    const updateRequests: AnkiConnectUpdateNoteFieldsRequestAndMediaPlan[] = [];
    const skippedCards: SkippedCard[] = [];

    for (const card of cards) {
      // Skip cards that haven't been synced to Anki yet
      if (!card['anki_note_id']) {
        console.warn(`Skipping card ${card['id']} - not yet synced to Anki (no anki_note_id)`);
        skippedCards.push({ id: card['id'], reason: 'not_synced' as const });
        continue;
      }

      const { processedNoteFields, audioToUpload, imagesToUpload } = await prepareProcessedNoteFields(card, fieldMappings);

      const updateRequest = {
        action: 'updateNoteFields' as const,
        version: 6 as const,
        params: {
          note: {
            id: card['anki_note_id'],
            fields: processedNoteFields
          }
        }
      };

      updateRequests.push({
        request: updateRequest,
        mediaPlan: {
          cardId: card['id'],
          audioToUpload,
          imagesToUpload
        }
      });
    }

    return { requests: updateRequests, skippedCards };
  } catch (error: any) {
    console.error('Error in updateCardsInAnki:', error);
    throw error;
  }
};
