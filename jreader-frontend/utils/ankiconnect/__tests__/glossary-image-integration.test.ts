import { getGlossary } from '@/utils/ankiconnect/definitionProcessing';

// Import the functions we want to test

describe('Glossary Image Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should process glossary with images and return image paths', () => {
    // Test glossary with multiple definitions, some with images
    const definitions = [
      {
        type: 'structured',
        content: '[{"tag":"img","path":"img1/test-image1.png","height":10,"sizeUnits":"em"}]',
        dictionary: 'Dictionary 1'
      },
      {
        type: 'simple',
        content: 'Simple definition without image',
        dictionary: 'Dictionary 2'
      },
      {
        type: 'structured',
        content: '[{"tag":"img","path":"img2/test-image2.png","height":20,"sizeUnits":"em"}]',
        dictionary: 'Dictionary 3'
      }
    ];

    const result = getGlossary(definitions, {});

    // Should return HTML with image placeholders (each definition gets its own placeholder index)
    // Calculate hashes for the dictionary names
    const dict1Hash = 'Dictionary 1'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    const dict3Hash = 'Dictionary 3'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    expect(result.html).toContain(`<img src="ANKI_IMAGE_PLACEHOLDER_${dict1Hash}_0"`);
    expect(result.html).toContain(`<img src="ANKI_IMAGE_PLACEHOLDER_${dict3Hash}_0"`); // Both images get placeholder 0 since they're in separate definitions
    
    // Should return image paths with dictionary names
    expect(result.imagePaths).toEqual([
      'Dictionary 1/img1/test-image1.png',
      'Dictionary 3/img2/test-image2.png'
    ]);
    
    // Should return dictionary names
    expect(result.dictionaryNames).toEqual(['Dictionary 1', 'Dictionary 3']);
    
    // Should have data-dictionary wrappers
    expect(result.html).toContain('data-dictionary="Dictionary 1"');
    expect(result.html).toContain('data-dictionary="Dictionary 2"');
    expect(result.html).toContain('data-dictionary="Dictionary 3"');
  });

  it('should handle glossary with main_definition used (include all definitions)', () => {
    const definitions = [
      {
        type: 'structured',
        content: '[{"tag":"img","path":"img1/first-image.png","height":10,"sizeUnits":"em"}]',
        dictionary: 'First Dictionary'
      },
      {
        type: 'structured',
        content: '[{"tag":"img","path":"img2/second-image.png","height":20,"sizeUnits":"em"}]',
        dictionary: 'Second Dictionary'
      }
    ];

    const fieldMappings = { MainDefinition: '{main_definition}' };
    const result = getGlossary(definitions, fieldMappings);

    // Should include both definitions
    expect(result.html).toContain('First Dictionary');
    expect(result.html).toContain('Second Dictionary');
    
    // Calculate hashes for both dictionaries
    const firstDictHash = 'First Dictionary'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    const secondDictHash = 'Second Dictionary'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    expect(result.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${firstDictHash}_0`);
    expect(result.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${secondDictHash}_0`);
    
    // Should have image paths for both definitions
    expect(result.imagePaths).toEqual([
      'First Dictionary/img1/first-image.png',
      'Second Dictionary/img2/second-image.png'
    ]);
    expect(result.dictionaryNames).toEqual(['First Dictionary', 'Second Dictionary']);
    
    // Should have data-dictionary wrapper for both definitions
    expect(result.html).toContain('data-dictionary="First Dictionary"');
    expect(result.html).toContain('data-dictionary="Second Dictionary"');
  });

  it('should handle mixed definition types in glossary with images', () => {
    const definitions = [
      {
        type: 'simple',
        content: 'Simple definition',
        dictionary: 'Simple Dict'
      },
      {
        type: 'structured',
        content: '[{"tag":"img","path":"img/test-image.png","height":15,"sizeUnits":"em"}]',
        dictionary: 'Image Dict'
      },
      '{"type":"structured","content":"[{\\"tag\\":\\"img\\",\\"path\\":\\"img/json-image.png\\",\\"height\\":25,\\"sizeUnits\\":\\"em\\"}]","dictionary":"JSON Dict"}'
    ];

    const result = getGlossary(definitions, {});

    // Should process all three definitions
    expect(result.html).toContain('Simple definition');
    // Calculate hash for "Image Dict"
    const imageDictHash = 'Image Dict'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    expect(result.html).toContain(`<img src="ANKI_IMAGE_PLACEHOLDER_${imageDictHash}_0"`);
    expect(result.html).toContain('img/json-image.png'); // JSON string content is not processed as structured
    
    // Should have image paths for the structured definition only (JSON string is not processed)
    expect(result.imagePaths).toEqual([
      'Image Dict/img/test-image.png'
    ]);
    
    // Should have dictionary names for the structured definition only
    expect(result.dictionaryNames).toEqual(['Image Dict']);
    
    // Should have data-dictionary wrappers for all
    expect(result.html).toContain('data-dictionary="Simple Dict"');
    expect(result.html).toContain('data-dictionary="Image Dict"');
    // JSON string definitions are not parsed, so they remain as raw strings
    expect(result.html).toContain('{"type":"structured","content":"[{\\"tag\\":\\"img\\",\\"path\\":\\"img/json-image.png\\",\\"height\\":25,\\"sizeUnits\\":\\"em\\"}]","dictionary":"JSON Dict"}');
  });

  it('should handle glossary with no images', () => {
    const definitions = [
      {
        type: 'simple',
        content: 'First simple definition',
        dictionary: 'Dict 1'
      },
      {
        type: 'simple',
        content: 'Second simple definition',
        dictionary: 'Dict 2'
      }
    ];

    const result = getGlossary(definitions, {});

    // Should not have any image placeholders
    expect(result.html).not.toContain('ANKI_IMAGE_PLACEHOLDER_');
    
    // Should have empty image paths and dictionary names
    expect(result.imagePaths).toEqual([]);
    expect(result.dictionaryNames).toEqual([]);
    
    // Should still have data-dictionary wrappers
    expect(result.html).toContain('data-dictionary="Dict 1"');
    expect(result.html).toContain('data-dictionary="Dict 2"');
  });

  it('should handle glossary with definitions without dictionary names', () => {
    const definitions = [
      {
        type: 'structured',
        content: '[{"tag":"img","path":"img/test-image.png","height":10,"sizeUnits":"em"}]'
        // No dictionary name
      },
      {
        type: 'simple',
        content: 'Simple definition without dictionary'
        // No dictionary name
      }
    ];

    const result = getGlossary(definitions, {});

    // Should still process images
    const unknownHash = 'unknown'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    expect(result.html).toContain(`<img src="ANKI_IMAGE_PLACEHOLDER_${unknownHash}_0"`);
    expect(result.imagePaths).toEqual(['unknown/img/test-image.png']);
    
    // Should have data-dictionary wrappers with "unknown"
    expect(result.html).toContain('data-dictionary="unknown"');
    
    // Should have "unknown" dictionary names for missing dictionary name
    expect(result.dictionaryNames).toEqual(['unknown']);
  });
});
