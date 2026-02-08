import { describe, it, expect } from 'vitest';

describe('Real Image Deduplication Bug', () => {
  it('should demonstrate the actual bug from user logs', () => {
    // Based on the user's actual logs
    const imageFields = {
      'glossary_image_0': 'PixivLight_2024-11-25/assets/pixiv-logo.png', // Success
      'glossary_image_1': 'ja.Wikipedia.2022-12-01.v1.6.1/assets\\wikipedia-icon.png', // 401 error
      'glossary_image_2': 'Pixiv_2024-11-25/assets/pixiv-logo.png', // Success (different from first)
      'glossary_image_3': 'TMW Club v2 [2024-05-12]/img/魚_cookingClubDeck_0.webp', // Success
      'glossary_image_4': '[JA-JA Encyclopedia] きっずジャポニカ 新版/img/191018A.jpg', // Success
      // ... more images
    };

    const processedNoteFields: Record<string, string> = {
      'Glossary': `
        <div data-dictionary="PixivLight_2024-11-25">
          <img src="ANKI_IMAGE_PLACEHOLDER_0" />
        </div>
        <div data-dictionary="ja.Wikipedia.2022-12-01.v1.6.1">
          <img src="ANKI_IMAGE_PLACEHOLDER_1" />
        </div>
        <div data-dictionary="Pixiv_2024-11-25">
          <img src="ANKI_IMAGE_PLACEHOLDER_2" />
        </div>
        <div data-dictionary="TMW Club v2 [2024-05-12]">
          <img src="ANKI_IMAGE_PLACEHOLDER_3" />
        </div>
        <div data-dictionary="[JA-JA Encyclopedia] きっずジャポニカ 新版">
          <img src="ANKI_IMAGE_PLACEHOLDER_4" />
        </div>
      `
    };

    // Simulate the image processing results
    const imagePathToFilename = new Map([
      ['PixivLight_2024-11-25/assets/pixiv-logo.png', 'jreader_PixivLight_2024-11-25_assets_pixiv-logo_png.png'],
      // Note: Wikipedia image failed (401 error), so it's NOT in the map
      ['Pixiv_2024-11-25/assets/pixiv-logo.png', 'jreader_Pixiv_2024-11-25_assets_pixiv-logo_png.png'],
      ['TMW Club v2 [2024-05-12]/img/魚_cookingClubDeck_0.webp', 'jreader_TMW_Club_v2_2024-05-12_img_魚_cookingClubDeck_0_webp.png'],
      ['[JA-JA Encyclopedia] きっずジャポニカ 新版/img/191018A.jpg', 'jreader_JA-JA_Encyclopedia_きっずジャポニカ_新版_img_191018A_jpg.png'],
    ]);

    // Current replacement logic
    for (const [fieldName, imagePath] of Object.entries(imageFields)) {
      const imageFilename = imagePathToFilename.get(imagePath);
      if (imageFilename) {
        const index = fieldName.split('_').pop();
        const placeholderPattern = new RegExp(`ANKI_IMAGE_PLACEHOLDER_${index}`, 'g');
        Object.keys(processedNoteFields).forEach(fieldKey => {
          const fieldValue = processedNoteFields[fieldKey];
          if (fieldValue && fieldValue.includes('ANKI_IMAGE_PLACEHOLDER_')) {
            processedNoteFields[fieldKey] = fieldValue.replace(placeholderPattern, imageFilename);
          }
        });
        console.log(`Replaced ANKI_IMAGE_PLACEHOLDER_${index} with ${imageFilename}`);
      } else {
        console.log(`No filename found for ${imagePath} (failed to fetch)`);
      }
    }

    console.log('Final result:', processedNoteFields['Glossary']);

    // The Wikipedia image should still have its placeholder since it failed to fetch
    expect(processedNoteFields['Glossary']).toContain('ANKI_IMAGE_PLACEHOLDER_1');
    
    // But the user reported it's getting the Pixiv logo instead
    // This suggests there's a bug in the replacement logic
  });

  it('should show what happens when placeholders get mixed up', () => {
    // Let's simulate a scenario where the replacement logic might be buggy
    const processedNoteFields: Record<string, string> = {
      'Glossary': `
        <div data-dictionary="PixivLight_2024-11-25">
          <img src="ANKI_IMAGE_PLACEHOLDER_0" />
        </div>
        <div data-dictionary="ja.Wikipedia.2022-12-01.v1.6.1">
          <img src="ANKI_IMAGE_PLACEHOLDER_1" />
        </div>
      `
    };

    // Simulate the bug: what if the replacement logic is replacing ALL placeholders with the same index?
    const pixivFilename = 'jreader_PixivLight_2024-11-25_assets_pixiv-logo_png.png';
    
    // Buggy logic: replace ALL ANKI_IMAGE_PLACEHOLDER_0 with pixiv filename
    if (processedNoteFields['Glossary']) {
      processedNoteFields['Glossary'] = processedNoteFields['Glossary'].replace(
        /ANKI_IMAGE_PLACEHOLDER_0/g,
        pixivFilename
      );
    }

    // Buggy logic: replace ALL ANKI_IMAGE_PLACEHOLDER_1 with pixiv filename (WRONG!)
    if (processedNoteFields['Glossary']) {
      processedNoteFields['Glossary'] = processedNoteFields['Glossary'].replace(
        /ANKI_IMAGE_PLACEHOLDER_1/g,
        pixivFilename
      );
    }

    console.log('Buggy result:', processedNoteFields['Glossary']);

    // This would cause the Wikipedia image to get the Pixiv logo
    expect(processedNoteFields['Glossary']).toContain('jreader_PixivLight_2024-11-25_assets_pixiv-logo_png.png');
    expect(processedNoteFields['Glossary']).not.toContain('ANKI_IMAGE_PLACEHOLDER_1');
  });
});

