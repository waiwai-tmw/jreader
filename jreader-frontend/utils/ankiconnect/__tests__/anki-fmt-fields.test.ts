import { buildAnkiNoteFields } from '@/utils/ankiconnect/anki-fmt';

describe('buildAnkiNoteFields (frontend)', () => {
  it('maps expression, main_definition, and expression_audio', () => {
    const card: any = {
      id: '1',
      expression: '犬',
      reading: 'いぬ',
      definitions: [
        { type: 'simple', content: 'A dog', dictionary: 'Dict' }
      ],
      expression_audio: '/media/jpod_files/audio.opus'
    };

    const fieldMappings: Record<string, any> = {
      Expression: '{expression}',
      MainDefinition: '{main_definition}',
      Audio: '{expression_audio}'
    };

    const { noteFields, audioFields, imageFields } = buildAnkiNoteFields(card, fieldMappings);
    expect(noteFields['Expression']).toBe('犬');
    expect(noteFields['MainDefinition']).toContain('yomitan-glossary');
    // .opus files are automatically converted to .mp3 for iOS Anki compatibility
    expect(audioFields['Audio']).toBe('/media/jpod_files/audio.mp3');
    expect(Object.keys(imageFields).length).toBeGreaterThanOrEqual(0);
  });
});


