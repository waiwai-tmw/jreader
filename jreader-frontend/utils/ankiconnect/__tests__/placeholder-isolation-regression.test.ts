import { getMainDefinition, getGlossary } from '@/utils/ankiconnect/definitionProcessing';

describe('Placeholder Isolation Regression Test', () => {
  it('should prevent the original cross-contamination bug', () => {
    // This test specifically reproduces the exact scenario that caused the bug:
    // Pixiv and Wikipedia definitions with images getting cross-contaminated
    
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

    // Test main definition (first item) - should only have Pixiv placeholder
    const mainResult = getMainDefinition(definitions);
    // Calculate expected hashes
    const pixivHash = 'PixivLight_2024-11-25'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    const wikipediaHash = 'ja.Wikipedia.2022-12-01.v1.6.1'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    expect(mainResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${pixivHash}_0`);
    expect(mainResult.html).not.toContain(`ANKI_IMAGE_PLACEHOLDER_${wikipediaHash}_0`);
    
    // Test glossary (all items) - should have both placeholders
    const glossaryResult = getGlossary(definitions, { MainDefinition: '{main_definition}' });
    expect(glossaryResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${pixivHash}_0`);
    expect(glossaryResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${wikipediaHash}_0`);
    
    // Verify image paths are correctly associated
    expect(mainResult.imagePaths).toEqual(['PixivLight_2024-11-25/assets/pixiv-logo.png']);
    expect(glossaryResult.imagePaths).toEqual([
      'PixivLight_2024-11-25/assets/pixiv-logo.png',
      'ja.Wikipedia.2022-12-01.v1.6.1/assets/wikipedia-icon.png'
    ]);
    
    // Verify imagePathsWithDictionary contains correct associations
    expect(mainResult.imagePathsWithDictionary).toEqual([
      { path: 'PixivLight_2024-11-25/assets/pixiv-logo.png', dictionary: 'PixivLight_2024-11-25', index: 0 }
    ]);
    expect(glossaryResult.imagePathsWithDictionary).toEqual([
      { path: 'PixivLight_2024-11-25/assets/pixiv-logo.png', dictionary: 'PixivLight_2024-11-25', index: 0 },
      { path: 'ja.Wikipedia.2022-12-01.v1.6.1/assets/wikipedia-icon.png', dictionary: 'ja.Wikipedia.2022-12-01.v1.6.1', index: 0 }
    ]);
  });

  it('should ensure glossary images from different dictionaries get different placeholders', () => {
    // Test multiple dictionaries in glossary to ensure no placeholder collision
    const definitions = [
      {
        type: 'structured',
        content: '[{"tag":"img","path":"dict1/image1.png","height":10,"sizeUnits":"em"}]',
        dictionary: 'Dictionary 1'
      },
      {
        type: 'structured',
        content: '[{"tag":"img","path":"dict2/image2.png","height":15,"sizeUnits":"em"}]',
        dictionary: 'Dictionary 2'
      }
    ];

    const result = getGlossary(definitions, {});
    
    // Each dictionary should get its own placeholder namespace
    // Calculate expected hashes
    const dict1Hash = 'Dictionary 1'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    const dict2Hash = 'Dictionary 2'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    expect(result.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${dict1Hash}_0`);
    expect(result.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${dict2Hash}_0`);
    
    // Verify correct image paths
    expect(result.imagePaths).toEqual([
      'Dictionary 1/dict1/image1.png',
      'Dictionary 2/dict2/image2.png'
    ]);
    
    // Verify imagePathsWithDictionary contains correct associations
    // Each dictionary should have its own index starting from 0 (per-dictionary indexing)
    expect(result.imagePathsWithDictionary).toEqual([
      { path: 'Dictionary 1/dict1/image1.png', dictionary: 'Dictionary 1', index: 0 },
      { path: 'Dictionary 2/dict2/image2.png', dictionary: 'Dictionary 2', index: 0 }
    ]);
  });
});
