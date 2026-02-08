import { getMainDefinition } from '@/utils/ankiconnect/definitionProcessing';

describe('Minimal Image Test', () => {
  it('should process definitions with just an image and generate correct HTML', () => {
    // Super minimal test: definitions with only an image
    const definitions = [{
      type: 'structured',
      content: '[{"tag":"img","path":"test-image.png","height":10,"sizeUnits":"em"}]'
    }];

    const result = getMainDefinition(definitions);

    // Should extract the image path with "unknown" dictionary
    expect(result.imagePaths).toEqual(['unknown/test-image.png']);
    
    // Should generate HTML with placeholder
    const unknownHash = 'unknown'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    expect(result.html).toBe(`<div style="text-align: left;" class="yomitan-glossary"><ol><li data-dictionary="unknown"><i>unknown</i> <img src="ANKI_IMAGE_PLACEHOLDER_${unknownHash}_0" style="height: 10em;" /></li></ol></div>`);
  });

  it('should process the user\'s idiom definition and extract the image', () => {
    // User's actual definition data
    const definitions = [{
      type: 'structured',
      content: '[{"content":[{"content":"むいちもん","style":{"fontWeight":"bold"},"tag":"span"},{"content":"【無一文】","tag":"span"},{"content":"詳細","href":"https://idiom-encyclopedia.com/three/muichimonn/","tag":"a"}],"data":{"name":"header"},"tag":"span"},{"content":{"background":false,"collapsed":false,"collapsible":false,"height":10,"path":"img2/855734f9c80388773fb2b7470507d651.png","sizeUnits":"em","tag":"img"},"data":{"jp-kotowaza":"image"},"style":{"marginBottom":"0.5em"},"tag":"div"},{"content":[{"content":"意味","style":{"borderRadius":"0.18em","borderStyle":"solid","borderWidth":"0.03em","cursor":"default","fontSize":"0.85em","marginRight":"0.25em","padding":"0.1em 0.25em 0em 0.2em","verticalAlign":"text-bottom"},"tag":"span"},{"content":"おかねを、ぜんぜん持っていないこと。いちもんなし。からっけつ。","tag":"span"}],"data":{"name":"意味"},"style":{"marginBottom":"0.1em"},"tag":"div"},{"content":[{"content":"使い方","style":{"borderRadius":"0.18em","borderStyle":"solid","borderWidth":"0.03em","cursor":"default","fontSize":"0.85em","marginRight":"0.25em","padding":"0.1em 0.25em 0em 0.2em","verticalAlign":"text-bottom"},"tag":"span"},{"content":[{"content":[{"content":"知らない土地で無一文となり顔面蒼白する。","tag":"span"}],"tag":"li"},{"content":[{"content":"兄は海外で無一文になってもあっけらかんと旅行を楽しんだようだ。","tag":"span"}],"tag":"li"},{"content":[{"content":"競馬場に赴き無一文で帰ってくる父を母がなじる。","tag":"span"}],"tag":"li"},{"content":[{"content":"まったくの無一文でも動じない肝っ玉を持ちたいものだ。","tag":"span"}],"tag":"li"},{"content":[{"content":"旅館で働く旧友をたのみの綱として無一文で飛び込んだ訳アリの私。","tag":"span"}],"tag":"li"}],"style":{"listStyleType":"circle"},"tag":"ul"}],"data":{"name":"使い方"},"style":{"marginBottom":"0.1em"},"tag":"div"}]'
    }];

    const result = getMainDefinition(definitions);

    // Should extract the image path with "unknown" dictionary
    expect(result.imagePaths).toEqual(['unknown/img2/855734f9c80388773fb2b7470507d651.png']);

    // Should contain the image placeholder
    const unknownHash = 'unknown'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    expect(result.html).toContain(`ANKI_IMAGE_PLACEHOLDER_${unknownHash}_0`);

    // Should contain all the expected content
    expect(result.html).toContain('<span style="font-weight: bold;">むいちもん</span>');
    expect(result.html).toContain('<span>【無一文】</span>');
    expect(result.html).toContain('<a href="https://idiom-encyclopedia.com/three/muichimonn/">詳細</a>');
    expect(result.html).toContain('おかねを、ぜんぜん持っていないこと。いちもんなし。からっけつ。');
    expect(result.html).toContain('知らない土地で無一文となり顔面蒼白する。');

    // The image should be in the HTML with the correct placeholder
    const unknownHash2 = 'unknown'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    expect(result.html).toContain(`src="ANKI_IMAGE_PLACEHOLDER_${unknownHash2}_0"`);
    expect(result.html).toContain('style="height: 10em;"');

    // Verify the structure: header, image, meaning, usage
    const htmlParts = result.html.split(`src="ANKI_IMAGE_PLACEHOLDER_${unknownHash2}_0"`);
    expect(htmlParts).toHaveLength(2);
    
    // Before the image should contain the header
    expect(htmlParts[0]).toContain('むいちもん');
    expect(htmlParts[0]).toContain('【無一文】');
    expect(htmlParts[0]).toContain('詳細');
    
    // After the image should contain the meaning and usage
    expect(htmlParts[1]).toContain('おかねを、ぜんぜん持っていないこと。いちもんなし。からっけつ。');
    expect(htmlParts[1]).toContain('知らない土地で無一文となり顔面蒼白する。');
  });

  it('should demonstrate the placeholder replacement process', () => {
    const definitions = [{
      type: 'structured',
      content: '[{"tag":"img","path":"test-image.png","height":10,"sizeUnits":"em"}]'
    }];

    const result = getMainDefinition(definitions);
    
    // Original HTML with placeholder
    const unknownHash = 'unknown'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    expect(result.html).toBe(`<div style="text-align: left;" class="yomitan-glossary"><ol><li data-dictionary="unknown"><i>unknown</i> <img src="ANKI_IMAGE_PLACEHOLDER_${unknownHash}_0" style="height: 10em;" /></li></ol></div>`);
    
    // Simulate the replacement that would happen in the sync process
    const imageFilename = 'image_123_1703123456789.png';
    const finalHtml = result.html.replace(
      `ANKI_IMAGE_PLACEHOLDER_${unknownHash}_0`,
      imageFilename
    );
    
    // Final HTML should have the actual image reference
    expect(finalHtml).toBe(`<div style="text-align: left;" class="yomitan-glossary"><ol><li data-dictionary="unknown"><i>unknown</i> <img src="${imageFilename}" style="height: 10em;" /></li></ol></div>`);
    
    // Wait, that's wrong! The replacement should replace just the src attribute, not the whole img tag
    // Let me fix this to show the correct replacement
    const correctFinalHtml = result.html.replace(
      `ANKI_IMAGE_PLACEHOLDER_${unknownHash}_0`,
      imageFilename
    );
    
    expect(correctFinalHtml).toBe(`<div style="text-align: left;" class="yomitan-glossary"><ol><li data-dictionary="unknown"><i>unknown</i> <img src="${imageFilename}" style="height: 10em;" /></li></ol></div>`);
  });
});
