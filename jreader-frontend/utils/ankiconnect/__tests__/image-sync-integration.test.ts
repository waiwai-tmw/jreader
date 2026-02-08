// Jest environment
import { getMainDefinition, getGlossary } from '@/utils/ankiconnect/definitionProcessing';

describe('Image Sync Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle the complete image sync flow without cross-contamination', () => {
    // This test simulates the EXACT scenario that caused the original bug:
    // Pixiv and Wikipedia definitions with images getting cross-contaminated
    
    const card = {
      expression: '魚',
      definitions: [
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
      ]
    };

    const fieldMappings = {
      MainDefinition: '{main_definition}',
      Glossary: '{glossary}'
    };

    // Step 1: Generate HTML with placeholders (this was working correctly)
    const mainResult = getMainDefinition(card.definitions);
    const glossaryResult = getGlossary(card.definitions, fieldMappings);

    // Calculate actual hash values
    const pixivHash = 'PixivLight_2024-11-25'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    const wikipediaHash = 'ja.Wikipedia.2022-12-01.v1.6.1'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);

    // Verify HTML generation is correct
    expect(mainResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${pixivHash}_0`);
    expect(glossaryResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${wikipediaHash}_0`);

    // Step 2: Simulate the buildAnkiNoteFields logic (this is where the bug was)
    const noteFields = {
      MainDefinition: mainResult.html,
      Glossary: glossaryResult.html
    };

    // Simulate the image field mapping that buildAnkiNoteFields creates
    const imageFields: Record<string, string> = {};
    
    // Add main definition images
    mainResult.imagePathsWithDictionary.forEach(({path, dictionary, index}) => {
      const dictHash = dictionary ? dictionary.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36) : 'unknown';
      imageFields[`main_definition_image_${dictHash}_${index}`] = path;
    });

    // Add glossary images
    glossaryResult.imagePathsWithDictionary.forEach(({path, dictionary, index}) => {
      const dictHash = dictionary ? dictionary.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36) : 'unknown';
      imageFields[`glossary_image_${dictHash}_${index}`] = path;
    });

    // Verify image fields are correctly mapped
    expect(imageFields).toEqual({
      [`main_definition_image_${pixivHash}_0`]: 'PixivLight_2024-11-25/assets/pixiv-logo.png',
      [`glossary_image_${pixivHash}_0`]: 'PixivLight_2024-11-25/assets/pixiv-logo.png',
      [`glossary_image_${wikipediaHash}_0`]: 'ja.Wikipedia.2022-12-01.v1.6.1/assets/wikipedia-icon.png'
    });

    // Step 3: Simulate the image processing and placeholder replacement
    const imagePathToFilename = new Map<string, string>([
      ['PixivLight_2024-11-25/assets/pixiv-logo.png', 'jreader_PixivLight_2024-11-25_assets_pixiv-logo_png.png'],
      ['ja.Wikipedia.2022-12-01.v1.6.1/assets/wikipedia-icon.png', 'jreader_ja_Wikipedia_2022-12-01_v1_6_1_assets_wikipedia-icon_png.png']
    ]);

    let processedNoteFields: Record<string, string> = { ...noteFields } as Record<string, string>;

    // This is the critical part that was buggy before
    for (const [fieldName, imagePath] of Object.entries(imageFields)) {
      const imageFilename = imagePathToFilename.get(imagePath as string);
      if (imageFilename) {
        // Parse the field name to extract dictionary hash and index
        const fieldParts = fieldName.split('_');
        const index = fieldParts.pop(); // Last part is the index
        
        // Determine how many parts to skip based on the field type
        let skipParts = 2; // Default for glossary_image_
        if (fieldParts[0] === 'main' && fieldParts[1] === 'definition') {
          skipParts = 3; // For main_definition_image_
        }
        
        const dictHash = fieldParts.slice(skipParts).join('_');
        
        // Build the per-dictionary placeholder pattern
        const placeholderPattern = dictHash 
          ? new RegExp(`ANKI_IMAGE_PLACEHOLDER_${dictHash}_${index}`, 'g')
          : new RegExp(`ANKI_IMAGE_PLACEHOLDER_${index}`, 'g');

        // Replace placeholders in all fields
        Object.keys(processedNoteFields).forEach(fieldKey => {
          const value = processedNoteFields[fieldKey];
          if (typeof value === 'string' && value.includes('ANKI_IMAGE_PLACEHOLDER_')) {
            processedNoteFields[fieldKey] = value.replace(placeholderPattern, imageFilename);
          }
        });
      }
    }

    // Step 4: Verify no cross-contamination occurred

    // Main definition should only have Pixiv image
    expect(processedNoteFields['MainDefinition']).toContain('jreader_PixivLight_2024-11-25_assets_pixiv-logo_png.png');
    expect(processedNoteFields['MainDefinition']).not.toContain('jreader_ja_Wikipedia_2022-12-01_v1_6_1_assets_wikipedia-icon_png.png');

    // Glossary should have both images
    expect(processedNoteFields['Glossary']).toContain('jreader_PixivLight_2024-11-25_assets_pixiv-logo_png.png');
    expect(processedNoteFields['Glossary']).toContain('jreader_ja_Wikipedia_2022-12-01_v1_6_1_assets_wikipedia-icon_png.png');

    // Critical: No placeholders should remain
    expect(processedNoteFields['MainDefinition']).not.toContain('ANKI_IMAGE_PLACEHOLDER_');
    expect(processedNoteFields['Glossary']).not.toContain('ANKI_IMAGE_PLACEHOLDER_');
  });

  it('should maintain index consistency between placeholders and field names', () => {
    // This test specifically targets the index mismatch bug we just fixed
    const card = {
      expression: '魚',
      definitions: [
        {
          type: 'structured',
          content: JSON.stringify([
            {"tag":"img","path":"assets/img1.png","height":10,"sizeUnits":"em"},
            {"tag":"img","path":"assets/img2.png","height":15,"sizeUnits":"em"},
            {"tag":"img","path":"assets/img3.png","height":20,"sizeUnits":"em"}
          ]),
          dictionary: 'TestDict'
        }
      ]
    };

    const fieldMappings = {
      Glossary: '{glossary}'
    };

    const glossaryResult = getGlossary(card.definitions, fieldMappings);
    const testHash = 'TestDict'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);

    // Verify placeholders are generated with indices 0, 1, 2
    expect(glossaryResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${testHash}_0`);
    expect(glossaryResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${testHash}_1`);
    expect(glossaryResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${testHash}_2`);

    // Verify imagePathsWithDictionary has indices 0, 1, 2 (not global indices)
    expect(glossaryResult.imagePathsWithDictionary).toHaveLength(3);
    expect(glossaryResult.imagePathsWithDictionary[0]!.index).toBe(0);
    expect(glossaryResult.imagePathsWithDictionary[1]!.index).toBe(1);
    expect(glossaryResult.imagePathsWithDictionary[2]!.index).toBe(2);

    // Verify field names match placeholder patterns
    const imageFields: Record<string, string> = {};
    glossaryResult.imagePathsWithDictionary.forEach(({path, dictionary, index}) => {
      const dictHash = dictionary ? dictionary.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36) : 'unknown';
      imageFields[`glossary_image_${dictHash}_${index}`] = path;
    });

    // This assertion would have failed with the old buggy code
    expect(imageFields).toEqual({
      [`glossary_image_${testHash}_0`]: 'TestDict/assets/img1.png',
      [`glossary_image_${testHash}_1`]: 'TestDict/assets/img2.png',
      [`glossary_image_${testHash}_2`]: 'TestDict/assets/img3.png'
    });

    // Verify placeholder replacement would work
    let processedNoteFields: Record<string, string> = { Glossary: glossaryResult.html };
    
    for (const [fieldName, imagePath] of Object.entries(imageFields)) {
      const fieldParts = fieldName.split('_');
      const index = fieldParts.pop();
      const dictHash = fieldParts.slice(2).join('_');
      const placeholderPattern = new RegExp(`ANKI_IMAGE_PLACEHOLDER_${dictHash}_${index}`, 'g');

      processedNoteFields['Glossary'] = processedNoteFields['Glossary']!.replace(placeholderPattern, `jreader_${(imagePath as string).replace(/[\/\\]/g, '_').replace(/\./g, '_')}.png`);
    }

    // This would have failed with the old buggy code
    expect(processedNoteFields['Glossary']).not.toContain('ANKI_IMAGE_PLACEHOLDER_');
  });

  it('should handle multiple images from the same dictionary correctly', () => {
    const card = {
      expression: '魚',
      definitions: [
        {
          type: 'structured',
          content: [
            {"tag":"img","path":"assets/image1.png","height":10,"sizeUnits":"em"},
            {"tag":"img","path":"assets/image2.png","height":15,"sizeUnits":"em"},
            {"tag":"img","path":"assets/image3.png","height":20,"sizeUnits":"em"}
          ],
          dictionary: 'Test Dictionary'
        }
      ]
    };

    const fieldMappings = {
      MainDefinition: '{main_definition}',
      Glossary: '{glossary}'
    };

    // Generate HTML
    const mainResult = getMainDefinition(card.definitions);
    getGlossary(card.definitions, fieldMappings);

    // Calculate actual hash value
    const testDictHash = 'Test Dictionary'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);

    // Verify placeholders are generated correctly
    expect(mainResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${testDictHash}_0`);
    expect(mainResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${testDictHash}_1`);
    expect(mainResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${testDictHash}_2`);

    // Build image fields
    const imageFields: Record<string, string> = {};
    mainResult.imagePathsWithDictionary.forEach(({path, dictionary, index}) => {
      const dictHash = dictionary ? dictionary.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36) : 'unknown';
      imageFields[`main_definition_image_${dictHash}_${index}`] = path;
    });

    // Verify image fields
    expect(imageFields).toEqual({
      [`main_definition_image_${testDictHash}_0`]: 'Test Dictionary/assets/image1.png',
      [`main_definition_image_${testDictHash}_1`]: 'Test Dictionary/assets/image2.png',
      [`main_definition_image_${testDictHash}_2`]: 'Test Dictionary/assets/image3.png'
    });

    // Simulate image processing
    const imagePathToFilename = new Map<string, string>([
      ['Test Dictionary/assets/image1.png', 'jreader_Test_Dictionary_assets_image1_png.png'],
      ['Test Dictionary/assets/image2.png', 'jreader_Test_Dictionary_assets_image2_png.png'],
      ['Test Dictionary/assets/image3.png', 'jreader_Test_Dictionary_assets_image3_png.png']
    ]);

    let processedNoteFields: Record<string, string> = { MainDefinition: mainResult.html };

    // Replace placeholders
    for (const [fieldName, imagePath] of Object.entries(imageFields)) {
      const imageFilename = imagePathToFilename.get(imagePath as string);
      if (imageFilename) {
        const fieldParts = fieldName.split('_');
        const index = fieldParts.pop();
        
        // Determine how many parts to skip based on the field type
        let skipParts = 2; // Default for glossary_image_
        if (fieldParts[0] === 'main' && fieldParts[1] === 'definition') {
          skipParts = 3; // For main_definition_image_
        }
        
        const dictHash = fieldParts.slice(skipParts).join('_');
        
        const placeholderPattern = new RegExp(`ANKI_IMAGE_PLACEHOLDER_${dictHash}_${index}`, 'g');
        Object.keys(processedNoteFields).forEach(fieldKey => {
          const value = processedNoteFields[fieldKey];
          if (typeof value === 'string' && value.includes('ANKI_IMAGE_PLACEHOLDER_')) {
            processedNoteFields[fieldKey] = value.replace(placeholderPattern, imageFilename);
          }
        });
      }
    }

    // Verify all images are correctly replaced
    expect(processedNoteFields['MainDefinition']).toContain('jreader_Test_Dictionary_assets_image1_png.png');
    expect(processedNoteFields['MainDefinition']).toContain('jreader_Test_Dictionary_assets_image2_png.png');
    expect(processedNoteFields['MainDefinition']).toContain('jreader_Test_Dictionary_assets_image3_png.png');
    expect(processedNoteFields['MainDefinition']).not.toContain('ANKI_IMAGE_PLACEHOLDER_');
  });

  it('should handle complex dictionary names with special characters', () => {
    const card = {
      expression: '魚',
      definitions: [
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
      ]
    };

    const fieldMappings = {
      MainDefinition: '{main_definition}',
      Glossary: '{glossary}'
    };

    // Generate HTML
    const mainResult = getMainDefinition(card.definitions);
    const glossaryResult = getGlossary(card.definitions, fieldMappings);

    // Calculate actual hash values
    const wikipediaHash = 'ja.Wikipedia.2022-12-01.v1.6.1'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    const pixivHash = 'PixivLight_2024-11-25'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);

    // Verify hashing works for complex names
    expect(mainResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${wikipediaHash}_0`);
    expect(glossaryResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${pixivHash}_0`);

    // Build image fields
    const imageFields: Record<string, string> = {};
    mainResult.imagePathsWithDictionary.forEach(({path, dictionary, index}) => {
      const dictHash = dictionary ? dictionary.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36) : 'unknown';
      imageFields[`main_definition_image_${dictHash}_${index}`] = path;
    });
    glossaryResult.imagePathsWithDictionary.forEach(({path, dictionary, index}) => {
      const dictHash = dictionary ? dictionary.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36) : 'unknown';
      imageFields[`glossary_image_${dictHash}_${index}`] = path;
    });

    // Verify field names are safe (no special characters)
    expect(Object.keys(imageFields)).toEqual([
      `main_definition_image_${wikipediaHash}_0`,
      `glossary_image_${wikipediaHash}_0`,
      `glossary_image_${pixivHash}_0`
    ]);

    // Simulate image processing
    const imagePathToFilename = new Map<string, string>([
      ['ja.Wikipedia.2022-12-01.v1.6.1/assets/image.png', 'jreader_ja_Wikipedia_2022-12-01_v1_6_1_assets_image_png.png'],
      ['PixivLight_2024-11-25/assets/logo.png', 'jreader_PixivLight_2024-11-25_assets_logo_png.png']
    ]);

    let processedNoteFields: Record<string, string> = { 
      MainDefinition: mainResult.html,
      Glossary: glossaryResult.html 
    };

    // Replace placeholders
    for (const [fieldName, imagePath] of Object.entries(imageFields)) {
      const imageFilename = imagePathToFilename.get(imagePath);
      if (imageFilename) {
        const fieldParts = fieldName.split('_');
        const index = fieldParts.pop();
        
        // Determine how many parts to skip based on the field type
        let skipParts = 2; // Default for glossary_image_
        if (fieldParts[0] === 'main' && fieldParts[1] === 'definition') {
          skipParts = 3; // For main_definition_image_
        }
        
        const dictHash = fieldParts.slice(skipParts).join('_');
        
        const placeholderPattern = new RegExp(`ANKI_IMAGE_PLACEHOLDER_${dictHash}_${index}`, 'g');
        Object.keys(processedNoteFields).forEach(fieldKey => {
          const value = processedNoteFields[fieldKey];
          if (typeof value === 'string' && value.includes('ANKI_IMAGE_PLACEHOLDER_')) {
            processedNoteFields[fieldKey] = value.replace(placeholderPattern, imageFilename);
          }
        });
      }
    }

    // Verify both images are in glossary
    expect(processedNoteFields['Glossary']).toContain('jreader_ja_Wikipedia_2022-12-01_v1_6_1_assets_image_png.png');
    expect(processedNoteFields['Glossary']).toContain('jreader_PixivLight_2024-11-25_assets_logo_png.png');

    // Main definition should only have Wikipedia image
    expect(processedNoteFields['MainDefinition']).toContain('jreader_ja_Wikipedia_2022-12-01_v1_6_1_assets_image_png.png');
    expect(processedNoteFields['MainDefinition']).not.toContain('jreader_PixivLight_2024-11-25_assets_logo_png.png');
  });

  it('should handle the case where one image fails to fetch gracefully', () => {
    const card = {
      expression: '魚',
      definitions: [
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
      ]
    };

    const fieldMappings = {
      MainDefinition: '{main_definition}',
      Glossary: '{glossary}'
    };

    // Generate HTML
    const mainResult = getMainDefinition(card.definitions);
    const glossaryResult = getGlossary(card.definitions, fieldMappings);

    // Build image fields
    const imageFields: Record<string, string> = {};
    mainResult.imagePathsWithDictionary.forEach(({path, dictionary, index}) => {
      const dictHash = dictionary ? dictionary.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36) : 'unknown';
      imageFields[`main_definition_image_${dictHash}_${index}`] = path;
    });
    glossaryResult.imagePathsWithDictionary.forEach(({path, dictionary, index}) => {
      const dictHash = dictionary ? dictionary.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36) : 'unknown';
      imageFields[`glossary_image_${dictHash}_${index}`] = path;
    });

    // Simulate image processing where Wikipedia image fails to fetch
    const imagePathToFilename = new Map<string, string>([
      ['PixivLight_2024-11-25/assets/pixiv-logo.png', 'jreader_PixivLight_2024-11-25_assets_pixiv-logo_png.png']
      // Wikipedia image is missing from the map (simulating fetch failure)
    ]);

    let processedNoteFields: Record<string, string> = { 
      MainDefinition: mainResult.html,
      Glossary: glossaryResult.html 
    };

    // Replace placeholders
    for (const [fieldName, imagePath] of Object.entries(imageFields)) {
      const imageFilename = imagePathToFilename.get(imagePath as string);
      if (imageFilename) {
        const fieldParts = fieldName.split('_');
        const index = fieldParts.pop();
        
        // Determine how many parts to skip based on the field type
        let skipParts = 2; // Default for glossary_image_
        if (fieldParts[0] === 'main' && fieldParts[1] === 'definition') {
          skipParts = 3; // For main_definition_image_
        }
        
        const dictHash = fieldParts.slice(skipParts).join('_');
        
        const placeholderPattern = new RegExp(`ANKI_IMAGE_PLACEHOLDER_${dictHash}_${index}`, 'g');
        Object.keys(processedNoteFields).forEach(fieldKey => {
          const value = processedNoteFields[fieldKey];
          if (typeof value === 'string' && value.includes('ANKI_IMAGE_PLACEHOLDER_')) {
            processedNoteFields[fieldKey] = value.replace(placeholderPattern, imageFilename);
          }
        });
      }
    }

    // Calculate actual hash values
    const pixivHash = 'PixivLight_2024-11-25'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    const wikipediaHash = 'ja.Wikipedia.2022-12-01.v1.6.1'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);

    // Verify Pixiv image is replaced correctly
    expect(processedNoteFields['MainDefinition']).toContain('jreader_PixivLight_2024-11-25_assets_pixiv-logo_png.png');
    expect(processedNoteFields['MainDefinition']).not.toContain(`ANKI_IMAGE_PLACEHOLDER_${pixivHash}_0`);

    // Verify Wikipedia image placeholder is NOT replaced (because fetch failed)
    expect(processedNoteFields['Glossary']).toContain(`ANKI_IMAGE_PLACEHOLDER_${wikipediaHash}_0`);
    expect(processedNoteFields['Glossary']).not.toContain('jreader_ja_Wikipedia_2022-12-01_v1_6_1_assets_wikipedia-icon_png.png');
  });
});