import { describe, it, expect } from '@jest/globals';

import { getGlossary } from '@/utils/ankiconnect/definitionProcessing';

describe('Glossary Processing', () => {
  it('should handle empty definitions', () => {
    const result = getGlossary(null, {});
    expect(result).toEqual({ html: '', imagePaths: [], dictionaryNames: [], imagePathsWithDictionary: [] });
    
    const result2 = getGlossary(undefined, {});
    expect(result2).toEqual({ html: '', imagePaths: [], dictionaryNames: [], imagePathsWithDictionary: [] });
    
    const result3 = getGlossary([], {});
    expect(result3).toEqual({ html: '', imagePaths: [], dictionaryNames: [], imagePathsWithDictionary: [] });
  });

  it('should handle single definition when main_definition is not used', () => {
    const definitions = [{
      type: 'simple',
      content: 'Simple definition content',
      dictionary: 'Test Dictionary'
    }];
    
    const result = getGlossary(definitions, {});
    
    expect(result.html).toContain('Simple definition content');
    expect(result.html).toContain('data-dictionary="Test Dictionary"');
    expect(result.imagePaths).toEqual([]);
    expect(result.dictionaryNames).toEqual([]);
  });

  it('should handle single definition when main_definition is used (should include it)', () => {
    const definitions = [{
      type: 'simple',
      content: 'Simple definition content',
      dictionary: 'Test Dictionary'
    }];
    
    const fieldMappings = { MainDefinition: '{main_definition}' };
    const result = getGlossary(definitions, fieldMappings);
    
    expect(result.html).toContain('Simple definition content');
    expect(result.html).toContain('data-dictionary="Test Dictionary"');
    expect(result.imagePaths).toEqual([]);
    expect(result.dictionaryNames).toEqual([]);
  });

  it('should handle multiple definitions with main_definition used', () => {
    const definitions = [
      {
        type: 'simple',
        content: 'First definition',
        dictionary: 'Dictionary 1'
      },
      {
        type: 'simple',
        content: 'Second definition',
        dictionary: 'Dictionary 2'
      },
      {
        type: 'structured',
        content: '[{"tag":"span","content":"Third definition"}]',
        dictionary: 'Dictionary 3'
      }
    ];
    
    const fieldMappings = { MainDefinition: '{main_definition}' };
    const result = getGlossary(definitions, fieldMappings);
    
    // Should include all definitions
    expect(result.html).toContain('First definition');
    expect(result.html).toContain('Second definition');
    expect(result.html).toContain('Third definition');
    
    // Should have data-dictionary wrappers
    expect(result.html).toContain('data-dictionary="Dictionary 2"');
    expect(result.html).toContain('data-dictionary="Dictionary 3"');
    
    // Should NOT have separators between definitions (removed ---)
    expect(result.html).not.toContain('---');
  });

  it('should handle structured definitions with images in glossary', () => {
    const definitions = [
      {
        type: 'structured',
        content: '[{"tag":"img","path":"test-image.png","height":10,"sizeUnits":"em"}]',
        dictionary: 'Image Dictionary'
      }
    ];
    
    const result = getGlossary(definitions, {});
    
    // Calculate the hash for "Image Dictionary"
    const imageDictHash = 'Image Dictionary'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    expect(result.html).toContain(`<img src="ANKI_IMAGE_PLACEHOLDER_${imageDictHash}_0"`);
    expect(result.html).toContain('data-dictionary="Image Dictionary"');
    expect(result.imagePaths).toEqual(['Image Dictionary/test-image.png']);
    expect(result.dictionaryNames).toEqual(['Image Dictionary']);
  });

  it('should handle simple definitions without dictionary name', () => {
    const definitions = [{
      type: 'simple',
      content: 'Simple definition without dictionary'
    }];
    
    const result = getGlossary(definitions, {});
    
    expect(result.html).toContain('Simple definition without dictionary');
    expect(result.html).toContain('data-dictionary="unknown"'); // Now uses "unknown" as fallback
    expect(result.imagePaths).toEqual([]);
    expect(result.dictionaryNames).toEqual([]);
  });

  it('should handle mixed definition types in glossary', () => {
    const definitions = [
      {
        type: 'simple',
        content: 'Simple definition',
        dictionary: 'Simple Dict'
      },
      {
        type: 'structured',
        content: '[{"tag":"span","content":"Structured definition"}]',
        dictionary: 'Structured Dict'
      }
    ];
    
    const result = getGlossary(definitions, {});
    
    expect(result.html).toContain('Simple definition');
    expect(result.html).toContain('Structured definition');
    expect(result.html).toContain('data-dictionary="Simple Dict"');
    expect(result.html).toContain('data-dictionary="Structured Dict"');
    expect(result.html).not.toContain('---'); // No separators anymore
    expect(result.imagePaths).toEqual([]);
    expect(result.dictionaryNames).toEqual([]);
  });

  it('should handle JSON string definitions', () => {
    const definitions = [
      '{"type":"simple","content":"JSON string definition","dictionary":"JSON Dict"}'
    ];
    
    const result = getGlossary(definitions, {});
    
    expect(result.html).toContain('JSON string definition');
    // JSON string definitions are not parsed, so they remain as raw strings
    expect(result.html).toContain('{"type":"simple","content":"JSON string definition","dictionary":"JSON Dict"}');
    expect(result.imagePaths).toEqual([]);
    expect(result.dictionaryNames).toEqual([]);
  });

  it('should handle malformed JSON gracefully', () => {
    const definitions = [
      'invalid json content'
    ];
    
    const result = getGlossary(definitions, {});
    
    expect(result.html).toContain('invalid json content');
    expect(result.html).not.toContain('data-dictionary=');
    expect(result.imagePaths).toEqual([]);
    expect(result.dictionaryNames).toEqual([]);
  });

  it('should NOT separate multiple glossary items with --- (removed separators)', () => {
    const definitions = [
      {
        type: 'simple',
        content: 'First item',
        dictionary: 'Dict 1'
      },
      {
        type: 'simple',
        content: 'Second item',
        dictionary: 'Dict 2'
      },
      {
        type: 'simple',
        content: 'Third item',
        dictionary: 'Dict 3'
      }
    ];
    
    const result = getGlossary(definitions, {});
    
    // Should NOT have separators anymore
    const separatorCount = (result.html.match(/---/g) || []).length;
    expect(separatorCount).toBe(0);
    
    // Should contain all items
    expect(result.html).toContain('First item');
    expect(result.html).toContain('Second item');
    expect(result.html).toContain('Third item');
    
    // Should have data-dictionary wrappers
    expect(result.html).toContain('data-dictionary="Dict 1"');
    expect(result.html).toContain('data-dictionary="Dict 2"');
    expect(result.html).toContain('data-dictionary="Dict 3"');
  });

  it('should handle the user\'s idiom definition in glossary context', () => {
    const definitions = [
      {
        type: 'structured',
        content: '[{"content":[{"content":"むいちもん","style":{"fontWeight":"bold"},"tag":"span"},{"content":"【無一文】","tag":"span"},{"content":"詳細","href":"https://idiom-encyclopedia.com/three/muichimonn/","tag":"a"}],"data":{"name":"header"},"tag":"span"},{"content":{"background":false,"collapsed":false,"collapsible":false,"height":10,"path":"img2/855734f9c80388773fb2b7470507d651.png","sizeUnits":"em","tag":"img"},"data":{"jp-kotowaza":"image"},"style":{"marginBottom":"0.5em"},"tag":"div"},{"content":[{"content":"意味","style":{"borderRadius":"0.18em","borderStyle":"solid","borderWidth":"0.03em","cursor":"default","fontSize":"0.85em","marginRight":"0.25em","padding":"0.1em 0.25em 0em 0.2em","verticalAlign":"text-bottom"},"tag":"span"},{"content":"おかねを、ぜんぜん持っていないこと。いちもんなし。からっけつ。","tag":"span"}],"data":{"name":"意味"},"style":{"marginBottom":"0.1em"},"tag":"div"},{"content":[{"content":"使い方","style":{"borderRadius":"0.18em","borderStyle":"solid","borderWidth":"0.03em","cursor":"default","fontSize":"0.85em","marginRight":"0.25em","padding":"0.1em 0.25em 0em 0.2em","verticalAlign":"text-bottom"},"tag":"span"},{"content":[{"content":[{"content":"知らない土地で無一文となり顔面蒼白する。","tag":"span"}],"tag":"li"},{"content":[{"content":"兄は海外で無一文になってもあっけらかんと旅行を楽しんだようだ。","tag":"span"}],"tag":"li"},{"content":[{"content":"競馬場に赴き無一文で帰ってくる父を母がなじる。","tag":"span"}],"tag":"li"},{"content":[{"content":"まったくの無一文でも動じない肝っ玉を持ちたいものだ。","tag":"span"}],"tag":"li"},{"content":[{"content":"旅館で働く旧友をたのみの綱として無一文で飛び込んだ訳アリの私。","tag":"span"}],"tag":"li"}],"style":{"listStyleType":"circle"},"tag":"ul"}],"data":{"name":"使い方"},"style":{"marginBottom":"0.1em"},"tag":"div"}]',
        dictionary: '[JA-JA Yoji] 四字熟語の百科事典 [2024-06-30]'
      }
    ];
    
    const result = getGlossary(definitions, {});
    
    // Should contain the expected content
    expect(result.html).toContain('<span style="font-weight: bold;">むいちもん</span>');
    expect(result.html).toContain('<span>【無一文】</span>');
    expect(result.html).toContain('<a href="https://idiom-encyclopedia.com/three/muichimonn/">詳細</a>');
    // Calculate the hash for the dictionary name
    const dictHash = '[JA-JA Yoji] 四字熟語の百科事典 [2024-06-30]'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    expect(result.html).toContain(`src="ANKI_IMAGE_PLACEHOLDER_${dictHash}_0"`);
    expect(result.html).toContain('おかねを、ぜんぜん持っていないこと。いちもんなし。からっけつ。');
    expect(result.html).toContain('知らない土地で無一文となり顔面蒼白する。');
    
    // Should have data-dictionary wrapper
    expect(result.html).toContain('data-dictionary="[JA-JA Yoji] 四字熟語の百科事典 [2024-06-30]"');
    
    // Should have image path and dictionary name
    expect(result.imagePaths).toEqual(['[JA-JA Yoji] 四字熟語の百科事典 [2024-06-30]/img2/855734f9c80388773fb2b7470507d651.png']);
    expect(result.dictionaryNames).toEqual(['[JA-JA Yoji] 四字熟語の百科事典 [2024-06-30]']);
  });
});
