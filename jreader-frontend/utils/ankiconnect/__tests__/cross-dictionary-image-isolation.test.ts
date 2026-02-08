import { getMainDefinition, getGlossary } from '@/utils/ankiconnect/definitionProcessing';

describe('Cross-Dictionary Image Isolation', () => {
  it('should ensure images from different dictionaries get different placeholders', () => {
    // This test simulates the exact scenario that caused the bug:
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

    // Calculate actual hash values
    const pixivHash = 'PixivLight_2024-11-25'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    const wikipediaHash = 'ja.Wikipedia.2022-12-01.v1.6.1'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);

    // Test main definition (first item)
    const mainResult = getMainDefinition(definitions);
    expect(mainResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${pixivHash}_0`);
    expect(mainResult.html).not.toContain(`ANKI_IMAGE_PLACEHOLDER_${wikipediaHash}_0`);
    
    // Test glossary (all items)
    const glossaryResult = getGlossary(definitions, { MainDefinition: '{main_definition}' });
    expect(glossaryResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${pixivHash}_0`);
    expect(glossaryResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${wikipediaHash}_0`);
    
    // Verify image paths are correctly associated
    expect(mainResult.imagePaths).toEqual(['PixivLight_2024-11-25/assets/pixiv-logo.png']);
    expect(glossaryResult.imagePaths).toEqual([
      'PixivLight_2024-11-25/assets/pixiv-logo.png',
      'ja.Wikipedia.2022-12-01.v1.6.1/assets/wikipedia-icon.png'
    ]);
  });

  it('should ensure glossary images from different dictionaries get different placeholders', () => {
    // Test multiple dictionaries in glossary
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
      },
      {
        type: 'structured',
        content: '[{"tag":"img","path":"dict3/image3.png","height":20,"sizeUnits":"em"}]',
        dictionary: 'Dictionary 3'
      }
    ];

    const result = getGlossary(definitions, {});
    
    // Calculate actual hash values
    const dict1Hash = 'Dictionary 1'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    const dict2Hash = 'Dictionary 2'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    const dict3Hash = 'Dictionary 3'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    
    // Each dictionary should get its own placeholder namespace
    expect(result.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${dict1Hash}_0`);
    expect(result.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${dict2Hash}_0`);
    expect(result.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${dict3Hash}_0`);
    
    // No cross-contamination - each placeholder should only appear once
    const placeholder1Matches = (result.html.match(new RegExp(`ANKI_IMAGE_PLACEHOLDER_${dict1Hash}_0`, 'g')) || []).length;
    const placeholder2Matches = (result.html.match(new RegExp(`ANKI_IMAGE_PLACEHOLDER_${dict2Hash}_0`, 'g')) || []).length;
    const placeholder3Matches = (result.html.match(new RegExp(`ANKI_IMAGE_PLACEHOLDER_${dict3Hash}_0`, 'g')) || []).length;
    
    expect(placeholder1Matches).toBe(1);
    expect(placeholder2Matches).toBe(1);
    expect(placeholder3Matches).toBe(1);
    
    // Verify correct image paths
    expect(result.imagePaths).toEqual([
      'Dictionary 1/dict1/image1.png',
      'Dictionary 2/dict2/image2.png', 
      'Dictionary 3/dict3/image3.png'
    ]);
  });

  it('should handle multiple images within the same dictionary correctly', () => {
    // Test that images within the same dictionary get sequential indices
    const definitions = [{
      type: 'structured',
      content: [
        {"tag":"img","path":"dict/image1.png","height":10,"sizeUnits":"em"},
        {"tag":"img","path":"dict/image2.png","height":15,"sizeUnits":"em"},
        {"tag":"img","path":"dict/image3.png","height":20,"sizeUnits":"em"}
      ],
      dictionary: 'Test Dictionary'
    }];

    const result = getMainDefinition(definitions);
    
    // Calculate actual hash value
    const testDictHash = 'Test Dictionary'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    
    // All images should be in the same dictionary namespace with sequential indices
    expect(result.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${testDictHash}_0`);
    expect(result.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${testDictHash}_1`);
    expect(result.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${testDictHash}_2`);
    
    // Verify correct image paths
    expect(result.imagePaths).toEqual([
      'Test Dictionary/dict/image1.png',
      'Test Dictionary/dict/image2.png',
      'Test Dictionary/dict/image3.png'
    ]);
  });

  it('should prevent placeholder collision between main definition and glossary', () => {
    // This is the critical test that would have caught the original bug
    const definitions = [
      {
        type: 'structured',
        content: '[{"tag":"img","path":"pixiv/logo.png","height":10,"sizeUnits":"em"}]',
        dictionary: 'PixivLight_2024-11-25'
      },
      {
        type: 'structured',
        content: '[{"tag":"img","path":"wikipedia/icon.png","height":15,"sizeUnits":"em"}]',
        dictionary: 'ja.Wikipedia.2022-12-01.v1.6.1'
      }
    ];

    // Calculate actual hash values
    const pixivHash = 'PixivLight_2024-11-25'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    const wikipediaHash = 'ja.Wikipedia.2022-12-01.v1.6.1'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);

    // Main definition should only have Pixiv image
    const mainResult = getMainDefinition(definitions);
    expect(mainResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${pixivHash}_0`);
    expect(mainResult.html).not.toContain('wikipedia');
    
    // Glossary should have both images
    const glossaryResult = getGlossary(definitions, { MainDefinition: '{main_definition}' });
    expect(glossaryResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${pixivHash}_0`);
    expect(glossaryResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${wikipediaHash}_0`);
    
    // Main definition should only have Pixiv image
    expect(mainResult.html).not.toContain(`ANKI_IMAGE_PLACEHOLDER_${wikipediaHash}_0`);
  });
});
