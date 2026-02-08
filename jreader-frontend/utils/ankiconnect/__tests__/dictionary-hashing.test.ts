import { getMainDefinition, getGlossary } from '@/utils/ankiconnect/definitionProcessing';

describe('Dictionary Hashing for Image Placeholders', () => {
  it('should generate consistent hashes for dictionary names', () => {
    // Test the hashing function
    const hashFunction = (str: string) => str.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    
    const dict1 = 'PixivLight_2024-11-25';
    const dict2 = 'ja.Wikipedia.2022-12-01.v1.6.1';
    const dict3 = 'TMW Club v2 [2024-05-12]';
    
    const hash1 = hashFunction(dict1);
    const hash2 = hashFunction(dict2);
    const hash3 = hashFunction(dict3);
    
    // Hashes should be consistent
    expect(hashFunction(dict1)).toBe(hash1);
    expect(hashFunction(dict2)).toBe(hash2);
    expect(hashFunction(dict3)).toBe(hash3);
    
    // Different dictionaries should have different hashes
    expect(hash1).not.toBe(hash2);
    expect(hash2).not.toBe(hash3);
    expect(hash1).not.toBe(hash3);
    
    console.log('Dictionary hashes:', { dict1, hash1, dict2, hash2, dict3, hash3 });
  });

  it('should generate per-dictionary placeholders using hashes', () => {
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

    // Test main definition
    const mainResult = getMainDefinition(definitions);
    const pixivHash = 'PixivLight_2024-11-25'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    expect(mainResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${pixivHash}_0`);
    
    // Test glossary
    const glossaryResult = getGlossary(definitions, { MainDefinition: '{main_definition}' });
    const wikipediaHash = 'ja.Wikipedia.2022-12-01.v1.6.1'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    expect(glossaryResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${wikipediaHash}_0`);
    
    // Verify both placeholders are in glossary (since we include all definitions)
    expect(glossaryResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${pixivHash}_0`);
    expect(glossaryResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${wikipediaHash}_0`);
    
    // Main definition should only have the first one
    expect(mainResult.html).not.toContain(`ANKI_IMAGE_PLACEHOLDER_${wikipediaHash}_0`);
  });

  it('should handle dictionary names with special characters', () => {
    const definitions = [{
      type: 'structured',
      content: '[{"tag":"img","path":"test.png","height":10,"sizeUnits":"em"}]',
      dictionary: '[JA-JA Encyclopedia] きっずジャポニカ 新版'
    }];

    const result = getMainDefinition(definitions);
    const dictHash = '[JA-JA Encyclopedia] きっずジャポニカ 新版'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    
    expect(result.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${dictHash}_0`);
    expect(result.html).not.toContain('ANKI_IMAGE_PLACEHOLDER_0'); // Should not use global placeholder
  });
});
