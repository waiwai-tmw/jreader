import { getMainDefinition, getGlossary } from '@/utils/ankiconnect/definitionProcessing';

describe('Image Deduplication Bug Tests', () => {
  it('should generate unique placeholders for different dictionaries', () => {
    // Test that different dictionaries get different placeholder hashes
    const definitions = [
      {
        type: 'structured',
        content: '[{"tag":"img","path":"assets/pixiv-logo.png","height":10,"sizeUnits":"em"}]',
        dictionary: 'PixivLight_2024-11-25'
      },
      {
        type: 'structured',
        content: '[{"tag":"img","path":"assets/wikipedia-icon.png","height":15,"sizeUnits":"em"}]',
        dictionary: 'ja.Wikipedia.2022-12-01.v1.6.1'
      }
    ];

    const fieldMappings = {
      MainDefinition: '{main_definition}',
      Glossary: '{glossary}'
    };

    // Generate HTML with placeholders
    const mainResult = getMainDefinition(definitions);
    const glossaryResult = getGlossary(definitions, fieldMappings);

    // Calculate expected hashes
    const pixivHash = 'PixivLight_2024-11-25'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    const wikipediaHash = 'ja.Wikipedia.2022-12-01.v1.6.1'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);

    // Verify different dictionaries get different placeholder hashes
    expect(mainResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${pixivHash}_0`);
    expect(glossaryResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${pixivHash}_0`);
    expect(glossaryResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${wikipediaHash}_0`);
    
    // Verify the hashes are actually different
    expect(pixivHash).not.toBe(wikipediaHash);
    
    // Verify image paths are correctly tracked with dictionary info
    expect(mainResult.imagePathsWithDictionary).toEqual([
      { path: 'PixivLight_2024-11-25/assets/pixiv-logo.png', dictionary: 'PixivLight_2024-11-25', index: 0 }
    ]);
    expect(glossaryResult.imagePathsWithDictionary).toEqual([
      { path: 'PixivLight_2024-11-25/assets/pixiv-logo.png', dictionary: 'PixivLight_2024-11-25', index: 0 },
      { path: 'ja.Wikipedia.2022-12-01.v1.6.1/assets/wikipedia-icon.png', dictionary: 'ja.Wikipedia.2022-12-01.v1.6.1', index: 0 }
    ]);
  });

  it('should handle multiple images from the same dictionary with sequential indices', () => {
    const definitions = [
      {
        type: 'structured',
        content: [
          {"tag":"img","path":"assets/image1.png","height":10,"sizeUnits":"em"},
          {"tag":"img","path":"assets/image2.png","height":15,"sizeUnits":"em"},
          {"tag":"img","path":"assets/image3.png","height":20,"sizeUnits":"em"}
        ],
        dictionary: 'Test Dictionary'
      }
    ];

    const result = getMainDefinition(definitions);
    
    // Calculate expected hash
    const testDictHash = 'Test Dictionary'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);

    // Verify sequential placeholders
    expect(result.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${testDictHash}_0`);
    expect(result.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${testDictHash}_1`);
    expect(result.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${testDictHash}_2`);

    // Verify image paths are correctly tracked
    expect(result.imagePathsWithDictionary).toEqual([
      { path: 'Test Dictionary/assets/image1.png', dictionary: 'Test Dictionary', index: 0 },
      { path: 'Test Dictionary/assets/image2.png', dictionary: 'Test Dictionary', index: 1 },
      { path: 'Test Dictionary/assets/image3.png', dictionary: 'Test Dictionary', index: 2 }
    ]);
  });

  it('should handle dictionary names with special characters', () => {
    const definitions = [
      {
        type: 'structured',
        content: '[{"tag":"img","path":"assets/image.png","height":10,"sizeUnits":"em"}]',
        dictionary: 'ja.Wikipedia.2022-12-01.v1.6.1' // Contains dots and numbers
      },
      {
        type: 'structured',
        content: '[{"tag":"img","path":"assets/logo.png","height":15,"sizeUnits":"em"}]',
        dictionary: 'PixivLight_2024-11-25' // Contains underscores and numbers
      }
    ];

    const mainResult = getMainDefinition(definitions);
    const glossaryResult = getGlossary(definitions, {});

    // Calculate expected hashes
    const wikipediaHash = 'ja.Wikipedia.2022-12-01.v1.6.1'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    const pixivHash = 'PixivLight_2024-11-25'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);

    // Verify hashing works for complex names
    expect(mainResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${wikipediaHash}_0`);
    expect(glossaryResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${pixivHash}_0`);

    // Verify the hashes are different
    expect(wikipediaHash).not.toBe(pixivHash);
  });
});