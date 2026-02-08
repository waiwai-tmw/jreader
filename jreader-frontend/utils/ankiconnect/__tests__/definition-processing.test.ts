import { getMainDefinition } from '@/utils/ankiconnect/definitionProcessing';

describe('Definition Processing (frontend)', () => {
  it('extracts main definition and image paths', () => {
    const definitions = [
      { type: 'structured', content: '[{"tag":"span","content":"Main"},{"tag":"img","path":"img/a.png"}]', dictionary_origin: 'DictX', dictionary_title: 'Dict X' },
      { type: 'simple', content: 'Other', dictionary: 'Dict Y' }
    ];
    const result = getMainDefinition(definitions);
    expect(result.html).toContain('Main');
    expect(result.imagePaths).toEqual(['DictX/img/a.png']);
    expect(result.dictionaryNames).toEqual(['DictX']);
  });
});


