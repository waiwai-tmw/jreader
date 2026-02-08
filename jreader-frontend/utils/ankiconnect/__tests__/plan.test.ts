import { syncCardsToAnki } from '@/utils/ankiconnect/ankiconnect';

describe('syncCardsToAnki planning flow', () => {
  test('builds addNotesRequest and mediaPlans for card with audio and image', async () => {
    const card = {
      id: '1',
      expression: '犬',
      reading: 'いぬ',
      // Minimal structured definition including an image path and dictionary origin
      definitions: [
        {
          type: 'structured',
          content: { tag: 'img', path: 'foo/bar.png', width: 100, height: 50 },
          dictionary_origin: 'dictA',
          dictionary_title: 'Dict A'
        }
      ],
      sentence: '犬が好きです。',
      pitch_accent: '0',
      frequency: [['Dict1', 100]],
      expression_audio: '/media/jpod_files/audio.opus',
      document_title: 'Sample'
    } as any;

    const ankiSettings = {
      anki_connect_url: 'http://localhost:8765',
      anki_deck: 'Default',
      anki_note_type: 'Basic'
    };

    const fieldMappings = {
      Expression: '{expression}',
      MainDefinition: '{main_definition}',
      Audio: '{expression_audio}'
    } as Record<string, any>;

    const { addNotesRequest, mediaPlans } = await syncCardsToAnki([card], ankiSettings, fieldMappings);

    // addNotes payload
    expect(addNotesRequest).toBeDefined();
    expect(addNotesRequest.action).toBe('addNotes');
    expect(addNotesRequest.version).toBe(6);
    expect(addNotesRequest.params?.notes?.length).toBe(1);
    const note = addNotesRequest.params!.notes![0]!;
    expect(note.deckName).toBe('Default');
    expect(note.modelName).toBe('Basic');
    expect(note.fields).toBeDefined();

    // media plans
    expect(Array.isArray(mediaPlans)).toBe(true);
    expect(mediaPlans.length).toBe(1);
    const plan = mediaPlans[0]!;
    expect(plan.cardId).toBe('1');

    // audio planned
    expect(plan.audioToUpload.length).toBeGreaterThanOrEqual(1);
    expect(plan.audioToUpload[0]!.ankiFilename).toMatch(/^jreader_media_jpod_files_audio\.mp3$/);

    // image planned
    expect(plan.imagesToUpload.length).toBeGreaterThanOrEqual(1);
    // planned filename should include dict origin and card id
    expect(plan.imagesToUpload[0]!.ankiFilename).toContain('dictA');
    expect(plan.imagesToUpload[0]!.ankiFilename).toMatch(/\.png$/);
  });
});


