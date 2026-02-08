// Jest environment
import { getMainDefinition, getGlossary } from '@/utils/ankiconnect/definitionProcessing';

describe('End-to-End Image Sync Tests', () => {
  it('should complete the full image sync flow without any unreplaced placeholders', async () => {
    // This test simulates the complete flow from HTML generation to final Anki card
    // It would have caught the index mismatch bug by verifying no placeholders remain
    
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
            {"tag":"img","path":"assets/wikipedia-icon2.png","height":25,"sizeUnits":"em"}
          ]),
          dictionary: 'ja.Wikipedia.2022-12-01.v1.6.1'
        }
      ]
    };

    const fieldMappings = {
      MainDefinition: '{main_definition}',
      Glossary: '{glossary}'
    };

    // Step 1: Generate HTML (this was working)
    const mainResult = getMainDefinition(card.definitions);
    const glossaryResult = getGlossary(card.definitions, fieldMappings);

    // Step 2: Simulate the complete buildAnkiNoteFields logic
    const noteFields = {
      MainDefinition: mainResult.html,
      Glossary: glossaryResult.html
    };

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

    // Step 3: Simulate image processing and placeholder replacement
    const processedNoteFields = { ...noteFields };
    const imagePathToFilename = new Map([
      ['PixivLight_2024-11-25/assets/pixiv-logo.png', 'jreader_PixivLight_2024-11-25_assets_pixiv-logo_png.png'],
      ['PixivLight_2024-11-25/assets/pixiv-logo2.png', 'jreader_PixivLight_2024-11-25_assets_pixiv-logo2_png.png'],
      ['ja.Wikipedia.2022-12-01.v1.6.1/assets/wikipedia-icon.png', 'jreader_ja_Wikipedia_2022-12-01_v1_6_1_assets_wikipedia-icon_png.png'],
      ['ja.Wikipedia.2022-12-01.v1.6.1/assets/wikipedia-icon2.png', 'jreader_ja_Wikipedia_2022-12-01_v1_6_1_assets_wikipedia-icon2_png.png']
    ]);

    // Process each image field
    for (const [fieldName, imagePath] of Object.entries(imageFields)) {
      const imageFilename = imagePathToFilename.get(imagePath as string);
      if (imageFilename) {
        // Parse field name to extract dictionary hash and index
        const fieldParts = fieldName.split('_');
        const index = fieldParts.pop();

        let skipParts = 2; // Default for glossary_image_
        if (fieldParts[0] === 'main' && fieldParts[1] === 'definition') {
          skipParts = 3; // For main_definition_image_
        }

        const dictHash = fieldParts.slice(skipParts).join('_');
        const placeholderPattern = new RegExp(`ANKI_IMAGE_PLACEHOLDER_${dictHash}_${index}`, 'g');

        // Replace placeholders in all fields
        const fields = processedNoteFields as Record<string, string>;
        Object.keys(fields).forEach(fieldKey => {
          const fieldValue = fields[fieldKey];
          if (fieldValue && typeof fieldValue === 'string' && fieldValue.includes('ANKI_IMAGE_PLACEHOLDER_')) {
            fields[fieldKey] = fieldValue.replace(placeholderPattern, imageFilename);
          }
        });
      }
    }

    // Step 4: Verify the final result
    // This is the critical assertion that would have caught the bug
    expect(processedNoteFields.MainDefinition).not.toContain('ANKI_IMAGE_PLACEHOLDER_');
    expect(processedNoteFields.Glossary).not.toContain('ANKI_IMAGE_PLACEHOLDER_');

    // Verify that actual image filenames are present
    expect(processedNoteFields.MainDefinition).toContain('jreader_PixivLight_2024-11-25_assets_pixiv-logo_png.png');
    expect(processedNoteFields.MainDefinition).toContain('jreader_PixivLight_2024-11-25_assets_pixiv-logo2_png.png');
    expect(processedNoteFields.Glossary).toContain('jreader_ja_Wikipedia_2022-12-01_v1_6_1_assets_wikipedia-icon_png.png');
    expect(processedNoteFields.Glossary).toContain('jreader_ja_Wikipedia_2022-12-01_v1_6_1_assets_wikipedia-icon2_png.png');

    // Verify both sets of images are in glossary
    expect(processedNoteFields.Glossary).toContain('jreader_PixivLight_2024-11-25_assets_pixiv-logo_png.png');
    expect(processedNoteFields.Glossary).toContain('jreader_PixivLight_2024-11-25_assets_pixiv-logo2_png.png');
    expect(processedNoteFields.Glossary).toContain('jreader_ja_Wikipedia_2022-12-01_v1_6_1_assets_wikipedia-icon_png.png');
    expect(processedNoteFields.Glossary).toContain('jreader_ja_Wikipedia_2022-12-01_v1_6_1_assets_wikipedia-icon2_png.png');
  });

  it('should handle the exact user scenario with 8 Encyclopedia images', async () => {
    // This test replicates the exact scenario that caused the regression
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

    // Verify we have 8 images with correct indices
    expect(glossaryResult.imagePathsWithDictionary).toHaveLength(8);
    glossaryResult.imagePathsWithDictionary.forEach((item, index) => {
      expect(item.index).toBe(index);
    });

    // Simulate field name generation
    const imageFields: Record<string, string> = {};
    glossaryResult.imagePathsWithDictionary.forEach(({path, dictionary, index}) => {
      const dictHash = dictionary ? dictionary.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36) : 'unknown';
      imageFields[`glossary_image_${dictHash}_${index}`] = path;
    });

    // Verify all 8 field names are generated correctly
    expect(Object.keys(imageFields)).toHaveLength(8);
    for (let i = 0; i < 8; i++) {
      expect(imageFields).toHaveProperty(`glossary_image_${encyclopediaHash}_${i}`);
    }

    // Simulate placeholder replacement
    const processedNoteFields = { Glossary: glossaryResult.html };
    
    for (const [fieldName, imagePath] of Object.entries(imageFields)) {
      const fieldParts = fieldName.split('_');
      const index = fieldParts.pop();
      const dictHash = fieldParts.slice(2).join('_');
      const placeholderPattern = new RegExp(`ANKI_IMAGE_PLACEHOLDER_${dictHash}_${index}`, 'g');

      processedNoteFields.Glossary = processedNoteFields.Glossary.replace(placeholderPattern, `jreader_${(imagePath as string).replace(/[\/\\]/g, '_').replace(/\./g, '_')}.png`);
    }

    // This assertion would have failed with the old buggy code
    expect(processedNoteFields.Glossary).not.toContain('ANKI_IMAGE_PLACEHOLDER_');
    
    // Verify all 8 images are replaced
    for (let i = 0; i < 8; i++) {
      const letter = String.fromCharCode(65 + i); // A, B, C, D, E, F, G, H
      expect(processedNoteFields.Glossary).toContain(`jreader_[JA-JA Encyclopedia] きっずジャポニカ 新版_img_191018${letter}_jpg.png`);
    }
  });
});
