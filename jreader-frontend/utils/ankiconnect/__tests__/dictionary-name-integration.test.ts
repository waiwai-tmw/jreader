import { getMainDefinition } from '@/utils/ankiconnect/definitionProcessing';

describe('Dictionary Name Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should include dictionary name in image path for structured definitions', () => {
    const definitions = [{
      type: 'structured',
      content: [
        {
          tag: 'div',
          content: [
            {
              tag: 'img',
              path: 'img2/855734f9c80388773fb2b7470507d651.png',
              height: 10,
              sizeUnits: 'em'
            }
          ]
        }
      ],
      dictionary: '[JA-JA Yoji] 四字熟語の百科事典 [2024-06-30]'
    }];

    const result = getMainDefinition(definitions);

    // Calculate the hash for the dictionary name
    const dictHash = '[JA-JA Yoji] 四字熟語の百科事典 [2024-06-30]'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    expect(result.html).toContain(`<img src="ANKI_IMAGE_PLACEHOLDER_${dictHash}_0"`);
    expect(result.html).toContain('data-dictionary="[JA-JA Yoji] 四字熟語の百科事典 [2024-06-30]"');
    expect(result.imagePaths).toEqual(['[JA-JA Yoji] 四字熟語の百科事典 [2024-06-30]/img2/855734f9c80388773fb2b7470507d651.png']);
    expect(result.dictionaryNames).toEqual(['[JA-JA Yoji] 四字熟語の百科事典 [2024-06-30]']);
  });

  it('should handle image without dictionary name gracefully', () => {
    const definitions = [{
      type: 'structured',
      content: [
        {
          tag: 'div',
          content: [
            {
              tag: 'img',
              path: 'img2/855734f9c80388773fb2b7470507d651.png',
              height: 10,
              sizeUnits: 'em'
            }
          ]
        }
      ]
      // No dictionary field
    }];

    const result = getMainDefinition(definitions);

    // Calculate the hash for "unknown"
    const unknownHash = 'unknown'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    expect(result.html).toContain(`<img src="ANKI_IMAGE_PLACEHOLDER_${unknownHash}_0"`);
    expect(result.html).toContain('data-dictionary="unknown"'); // Now uses "unknown" as fallback
    expect(result.imagePaths).toEqual(['unknown/img2/855734f9c80388773fb2b7470507d651.png']);
    expect(result.dictionaryNames).toEqual(['unknown']);
  });

  it('should handle multiple images from different dictionaries', () => {
    const definitions = [
      {
        type: 'structured',
        content: [
          {
            tag: 'div',
            content: [
              {
                tag: 'img',
                path: 'img1/image1.png',
                height: 10,
                sizeUnits: 'em'
              }
            ]
          }
        ],
        dictionary: 'Dictionary 1'
      },
      {
        type: 'structured',
        content: [
          {
            tag: 'div',
            content: [
              {
                tag: 'img',
                path: 'img2/image2.png',
                height: 15,
                sizeUnits: 'em'
              }
            ]
          }
        ],
        dictionary: 'Dictionary 2'
      }
    ];

    const result = getMainDefinition(definitions);

    // Calculate the hash for "Dictionary 1"
    const dict1Hash = 'Dictionary 1'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    expect(result.html).toContain(`<img src="ANKI_IMAGE_PLACEHOLDER_${dict1Hash}_0"`);
    expect(result.html).toContain('data-dictionary="Dictionary 1"');
    expect(result.imagePaths).toEqual(['Dictionary 1/img1/image1.png']);
    expect(result.dictionaryNames).toEqual(['Dictionary 1']);
  });
});
