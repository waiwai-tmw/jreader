import { updateCardsInAnki } from '../ankiconnect';

// Note: We intentionally do NOT mock '../anki-fmt' or other pure helpers
// to exercise the real field processing and media planning.

describe('updateCardsInAnki', () => {
  const fieldMappings = {
    Word: '{expression}',
    Reading: '{reading}',
    MainDefinition: '{main_definition}',
    Glossary: '{glossary}',
    Sentence: '{sentence}',
    PitchAccent: '{pitch_accent}',
    PitchCategories: '{pitch_categories}',
    ExpressionFurigana: '{expression_furigana}',
    ExpressionAudio: '{expression_audio}',
    DocumentTitle: '{document-title}',
    Frequency: '{frequency}',
    HarmonicRank: '{frequency-harmonic-rank}',
  };

  // Minimal realistic Supabase card rows. Use the shape seen in mining page and API route.
  const baseCard = {
    created_at: new Date().toISOString(),
    expression: '食べる',
    reading: 'たべる',
    // One structured definition with an image to exercise image planning and placeholder replacement
    definitions: [
      {
        type: 'structured',
        dictionary: 'Daijirin',
        dictionary_title: '大辞林',
        dictionary_origin: 'Daijirin',
        content: [
          { tag: 'span', content: 'to eat' },
          { tag: 'img', path: 'images/food.png', alt: 'food' },
        ],
      },
      // Add a simple definition to exercise glossary aggregation
      'consume food',
    ],
    sentence: 'りんごを食べる。',
    pitch_accent: '4,0',
    frequency: [
      { source: 'unidic', rank: 1200 },
      { source: 'bccwj', rank: 800 },
    ],
    expression_audio: '/media/jpod_files/audio.opus',
    document_title: 'NHK Easy',
    user_id: 'user_123',
    sync_status: 'synced',
    synced_at: new Date().toISOString(),
    anki_model: 'Mining',
    anki_deck: 'Japanese::Mining',
  } as const;

  it('returns empty result for empty cards', async () => {
    const result = await updateCardsInAnki([], fieldMappings) as any;
    const requests = result.requests ?? result.updateRequests;
    expect(requests).toEqual([]);
    expect(result.skippedCards).toEqual([]);
  });

  it('skips cards without anki_note_id and processes those with it', async () => {
    const unsynced = { ...baseCard, id: 1, anki_note_id: null };
    const synced = { ...baseCard, id: 2, anki_note_id: 1759292845774 };

    const result = await updateCardsInAnki([unsynced, synced] as any[], fieldMappings) as any;

    // One skipped, one processed
    expect(result.skippedCards).toEqual([{ id: 1, reason: 'not_synced' }]);
    const requests = result.requests ?? result.updateRequests;
    expect(Array.isArray(requests)).toBe(true);
    expect(requests).toHaveLength(1);

    const { request, mediaPlan } = requests[0];

    // Request targets the anki_note_id and contains processed fields
    expect(request).toMatchObject({
      action: 'updateNoteFields',
      version: 6,
      params: {
        note: {
          id: 1759292845774,
          // fields content is produced by real helpers; check key existence and some substitutions occurred
          fields: expect.any(Object),
        },
      },
    });

    // Media plan includes the card id and planned uploads
    expect(mediaPlan.cardId).toBe(2);
    expect(Array.isArray(mediaPlan.audioToUpload)).toBe(true);
    expect(Array.isArray(mediaPlan.imagesToUpload)).toBe(true);

    // Audio planning: filename should be mp3 and include id
    const audio = mediaPlan.audioToUpload[0];
    expect(audio).toMatchObject({ fieldName: 'ExpressionAudio', sourceUrl: expect.stringContaining('audio.mp3') });
    expect(audio.ankiFilename).toBe('jreader_media_jpod_files_audio.mp3');

    // Image planning: filename should be canonicalized with dictionary prefix stripped
    const image = mediaPlan.imagesToUpload[0];
    expect(image.dictionary).toBe('Daijirin');
    expect(image.sourcePath).toBe('Daijirin/images/food.png');
    expect(image.ankiFilename).toBe('jreader_Daijirin_images_food.png');

    // Confirm placeholders got replaced in at least one field
    const fields = (request.params as any).note.fields as Record<string, string>;
    const anyFieldContainsPlaceholder = Object.values(fields).some(v => typeof v === 'string' && v.includes('ANKI_IMAGE_PLACEHOLDER_'));
    expect(anyFieldContainsPlaceholder).toBe(false);
  });
});
