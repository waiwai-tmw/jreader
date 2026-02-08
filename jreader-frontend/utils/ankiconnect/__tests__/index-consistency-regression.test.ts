import { getMainDefinition, getGlossary } from '@/utils/ankiconnect/definitionProcessing';

describe('Index Consistency Regression Tests', () => {
  it('should maintain consistent indices between placeholders and field names for multiple images per dictionary', () => {
    // This test would have caught the index mismatch bug we just fixed
    // The bug was: placeholders used per-dictionary indices (0,1,2...) 
    // but field names used global indices (6,7,8...)
    
    const card = {
      expression: '魚',
      definitions: [
        {
          type: 'structured',
          content: JSON.stringify([
            {"tag":"img","path":"assets/pixiv-logo.png","height":10,"sizeUnits":"em"},
            {"tag":"img","path":"assets/pixiv-logo2.png","height":15,"sizeUnits":"em"}
          ]),
          dictionary: 'PixivLight_2024-11-25'
        },
        {
          type: 'structured',
          content: JSON.stringify([
            {"tag":"img","path":"assets/wikipedia-icon.png","height":20,"sizeUnits":"em"},
            {"tag":"img","path":"assets/wikipedia-icon2.png","height":25,"sizeUnits":"em"},
            {"tag":"img","path":"assets/wikipedia-icon3.png","height":30,"sizeUnits":"em"}
          ]),
          dictionary: 'ja.Wikipedia.2022-12-01.v1.6.1'
        }
      ]
    };

    const fieldMappings = {
      MainDefinition: '{main_definition}',
      Glossary: '{glossary}'
    };

    // Step 1: Generate HTML with placeholders
    const mainResult = getMainDefinition(card.definitions);
    const glossaryResult = getGlossary(card.definitions, fieldMappings);

    // Calculate hash values
    const pixivHash = 'PixivLight_2024-11-25'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    const wikipediaHash = 'ja.Wikipedia.2022-12-01.v1.6.1'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);

    // Step 2: Verify placeholders are generated with per-dictionary indices
    expect(mainResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${pixivHash}_0`);
    expect(mainResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${pixivHash}_1`);
    expect(glossaryResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${wikipediaHash}_0`);
    expect(glossaryResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${wikipediaHash}_1`);
    expect(glossaryResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${wikipediaHash}_2`);

    // Step 3: Verify imagePathsWithDictionary uses per-dictionary indices
    const mainImages = mainResult.imagePathsWithDictionary;
    const glossaryImages = glossaryResult.imagePathsWithDictionary;

    // Main definition should have 2 images with indices 0,1
    expect(mainImages).toHaveLength(2);
    expect(mainImages[0]!.index).toBe(0);
    expect(mainImages[1]!.index).toBe(1);
    expect(mainImages[0]!.dictionary).toBe('PixivLight_2024-11-25');
    expect(mainImages[1]!.dictionary).toBe('PixivLight_2024-11-25');

    // Glossary should have all images (2 from Pixiv, 3 from Wikipedia)
    expect(glossaryImages).toHaveLength(5);
    // Pixiv images
    expect(glossaryImages[0]!.index).toBe(0);
    expect(glossaryImages[1]!.index).toBe(1);
    expect(glossaryImages[0]!.dictionary).toBe('PixivLight_2024-11-25');
    expect(glossaryImages[1]!.dictionary).toBe('PixivLight_2024-11-25');
    // Wikipedia images
    expect(glossaryImages[2]!.index).toBe(0);
    expect(glossaryImages[3]!.index).toBe(1);
    expect(glossaryImages[4]!.index).toBe(2);
    expect(glossaryImages[2]!.dictionary).toBe('ja.Wikipedia.2022-12-01.v1.6.1');
    expect(glossaryImages[3]!.dictionary).toBe('ja.Wikipedia.2022-12-01.v1.6.1');
    expect(glossaryImages[4]!.dictionary).toBe('ja.Wikipedia.2022-12-01.v1.6.1');

    // Step 4: Simulate field name generation (this is where the bug was)
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

    // Step 5: Verify field names match placeholder patterns
    // This is the critical assertion that would have caught the bug
    expect(imageFields).toEqual({
      [`main_definition_image_${pixivHash}_0`]: 'PixivLight_2024-11-25/assets/pixiv-logo.png',
      [`main_definition_image_${pixivHash}_1`]: 'PixivLight_2024-11-25/assets/pixiv-logo2.png',
      [`glossary_image_${pixivHash}_0`]: 'PixivLight_2024-11-25/assets/pixiv-logo.png',
      [`glossary_image_${pixivHash}_1`]: 'PixivLight_2024-11-25/assets/pixiv-logo2.png',
      [`glossary_image_${wikipediaHash}_0`]: 'ja.Wikipedia.2022-12-01.v1.6.1/assets/wikipedia-icon.png',
      [`glossary_image_${wikipediaHash}_1`]: 'ja.Wikipedia.2022-12-01.v1.6.1/assets/wikipedia-icon2.png',
      [`glossary_image_${wikipediaHash}_2`]: 'ja.Wikipedia.2022-12-01.v1.6.1/assets/wikipedia-icon3.png'
    });

    // Step 6: Verify that placeholder replacement would work
    const processedNoteFields = { ...{ MainDefinition: mainResult.html, Glossary: glossaryResult.html } };
    
    for (const [fieldName, imagePath] of Object.entries(imageFields)) {
      const fieldParts = fieldName.split('_');
      const index = fieldParts.pop();
      
      let skipParts = 2; // Default for glossary_image_
      if (fieldParts[0] === 'main' && fieldParts[1] === 'definition') {
        skipParts = 3; // For main_definition_image_
      }
      
      const dictHash = fieldParts.slice(skipParts).join('_');
      const placeholderPattern = new RegExp(`ANKI_IMAGE_PLACEHOLDER_${dictHash}_${index}`, 'g');
      
      // This should find and replace the placeholder
      const fields = processedNoteFields as Record<string, string>;
      Object.keys(fields).forEach(fieldKey => {
        const fieldValue = fields[fieldKey];
        if (fieldValue && typeof fieldValue === 'string' && fieldValue.includes('ANKI_IMAGE_PLACEHOLDER_')) {
          const beforeReplace = fieldValue.includes(`ANKI_IMAGE_PLACEHOLDER_${dictHash}_${index}`);
          fields[fieldKey] = fieldValue.replace(placeholderPattern, `jreader_${(imagePath as string).replace(/[\/\\]/g, '_').replace(/\./g, '_')}.png`);

          // This assertion would have failed with the old buggy code
          if (beforeReplace) {
            expect(fields[fieldKey]).not.toContain(`ANKI_IMAGE_PLACEHOLDER_${dictHash}_${index}`);
          }
        }
      });
    }

    // Step 7: Verify no placeholders remain
    expect(processedNoteFields.MainDefinition).not.toContain('ANKI_IMAGE_PLACEHOLDER_');
    expect(processedNoteFields.Glossary).not.toContain('ANKI_IMAGE_PLACEHOLDER_');
  });

  it('should handle the exact scenario that caused the original regression', () => {
    // This test replicates the exact scenario from the user's logs
    // where Encyclopedia images had indices 6,7,8... but placeholders had 0,1,2...
    
    const card = {
      expression: '魚',
      definitions: [
        {
          type: 'structured',
          content: JSON.stringify([
            {"tag":"img","path":"img/191018A.jpg","height":12,"sizeUnits":"em"},
            {"tag":"img","path":"img/191018B.jpg","height":12,"sizeUnits":"em"},
            {"tag":"img","path":"img/191018C.jpg","height":12,"sizeUnits":"em"},
            {"tag":"img","path":"img/191018D.jpg","height":12,"sizeUnits":"em"},
            {"tag":"img","path":"img/191018E.jpg","height":12,"sizeUnits":"em"},
            {"tag":"img","path":"img/191018F.jpg","height":12,"sizeUnits":"em"},
            {"tag":"img","path":"img/191018G.jpg","height":12,"sizeUnits":"em"},
            {"tag":"img","path":"img/191018H.jpg","height":12,"sizeUnits":"em"}
          ]),
          dictionary: '[JA-JA Encyclopedia] きっずジャポニカ 新版'
        }
      ]
    };

    const fieldMappings = {
      Glossary: '{glossary}'
    };

    const glossaryResult = getGlossary(card.definitions, fieldMappings);
    const encyclopediaHash = '[JA-JA Encyclopedia] きっずジャポニカ 新版'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);

    // Verify placeholders are generated with indices 0-7
    for (let i = 0; i < 8; i++) {
      expect(glossaryResult.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${encyclopediaHash}_${i}`);
    }

    // Verify imagePathsWithDictionary has indices 0-7 (not 6-13 like the buggy version)
    expect(glossaryResult.imagePathsWithDictionary).toHaveLength(8);
    glossaryResult.imagePathsWithDictionary.forEach((item, index) => {
      expect(item.index).toBe(index);
      expect(item.dictionary).toBe('[JA-JA Encyclopedia] きっずジャポニカ 新版');
    });

    // Verify field names would be generated correctly
    const imageFields: Record<string, string> = {};
    glossaryResult.imagePathsWithDictionary.forEach(({path, dictionary, index}) => {
      const dictHash = dictionary ? dictionary.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36) : 'unknown';
      imageFields[`glossary_image_${dictHash}_${index}`] = path;
    });

    // This assertion would have failed with the old buggy code
    expect(Object.keys(imageFields)).toEqual([
      `glossary_image_${encyclopediaHash}_0`,
      `glossary_image_${encyclopediaHash}_1`,
      `glossary_image_${encyclopediaHash}_2`,
      `glossary_image_${encyclopediaHash}_3`,
      `glossary_image_${encyclopediaHash}_4`,
      `glossary_image_${encyclopediaHash}_5`,
      `glossary_image_${encyclopediaHash}_6`,
      `glossary_image_${encyclopediaHash}_7`
    ]);
  });
});
