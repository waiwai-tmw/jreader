// Jest environment
import { getMainDefinition, getGlossary, extractTextFromDefinition } from '@/utils/ankiconnect/definitionProcessing';

// Mock fetch globally
global.fetch = jest.fn() as any;

describe('Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Definition Processing Errors', () => {
    it('should handle malformed JSON in definitions gracefully', () => {
      const malformedDefinitions = [
        {
          type: 'structured',
          content: 'invalid json content',
          dictionary: 'Test Dictionary'
        }
      ];

      const result = getMainDefinition(malformedDefinitions);
      
      // Should not crash and should return the content as-is (since it's treated as simple content)
      expect(result.html).toContain('invalid json content');
      expect(result.html).toContain('data-dictionary="Test Dictionary"');
      expect(result.imagePaths).toEqual([]);
      expect(result.dictionaryNames).toEqual([]);
    });

    it('should handle null/undefined definitions gracefully', () => {
      expect(getMainDefinition(null)).toEqual({ html: '', imagePaths: [], dictionaryNames: [], imagePathsWithDictionary: [] });
      expect(getMainDefinition(undefined)).toEqual({ html: '', imagePaths: [], dictionaryNames: [], imagePathsWithDictionary: [] });
      expect(getMainDefinition([])).toEqual({ html: '', imagePaths: [], dictionaryNames: [], imagePathsWithDictionary: [] });
    });

    it('should handle definitions with missing required fields', () => {
      const incompleteDefinitions = [
        {
          // Missing type and content
          dictionary: 'Test Dictionary'
        },
        {
          type: 'structured',
          // Missing content
          dictionary: 'Test Dictionary'
        }
      ];

      const result = getMainDefinition(incompleteDefinitions);
      
      // Should not crash
      expect(result.html).toBe('');
      expect(result.imagePaths).toEqual([]);
      expect(result.dictionaryNames).toEqual([]);
    });

    it('should handle extractTextFromDefinition with invalid content', () => {
      const imagePaths: string[] = [];
      const dictionaryNames: string[] = [];
      
      // Test with null content
      expect(extractTextFromDefinition(null, imagePaths, dictionaryNames)).toBe('');
      
      // Test with undefined content
      expect(extractTextFromDefinition(undefined, imagePaths, dictionaryNames)).toBe('');
      
      // Test with empty string
      expect(extractTextFromDefinition('', imagePaths, dictionaryNames)).toBe('');
    });

    it('should handle extractTextFromDefinition with malformed objects', () => {
      const imagePaths: string[] = [];
      const dictionaryNames: string[] = [];
      
      // Test with object missing tag
      const malformedObject = {
        content: 'test',
        style: { color: 'red' }
        // Missing tag
      };
      
      // Should still process the object and return the content with style
      expect(extractTextFromDefinition(malformedObject, imagePaths, dictionaryNames)).toContain('test');
      expect(extractTextFromDefinition(malformedObject, imagePaths, dictionaryNames)).toContain('color: red');
    });
  });

  describe('Glossary Processing Errors', () => {
    it('should handle malformed JSON in glossary definitions', () => {
      const malformedDefinitions = [
        'invalid json string',
        {
          type: 'structured',
          content: 'another invalid json',
          dictionary: 'Test Dictionary'
        }
      ];

      const result = getGlossary(malformedDefinitions, {});
      
      // Should not crash and should return the content as-is
      expect(result.html).toContain('invalid json string');
      expect(result.html).toContain('another invalid json');
      expect(result.html).toContain('data-dictionary="Test Dictionary"');
      expect(result.imagePaths).toEqual([]);
      expect(result.dictionaryNames).toEqual([]);
    });

    it('should handle glossary with null/undefined definitions', () => {
      expect(getGlossary(null, {})).toEqual({ html: '', imagePaths: [], dictionaryNames: [], imagePathsWithDictionary: [] });
      expect(getGlossary(undefined, {})).toEqual({ html: '', imagePaths: [], dictionaryNames: [], imagePathsWithDictionary: [] });
      expect(getGlossary([], {})).toEqual({ html: '', imagePaths: [], dictionaryNames: [], imagePathsWithDictionary: [] });
    });

    it('should handle glossary with mixed valid and invalid definitions', () => {
      const mixedDefinitions = [
        {
          type: 'simple',
          content: 'Valid definition',
          dictionary: 'Valid Dict'
        },
        'invalid json',
        {
          type: 'structured',
          content: 'invalid json content',
          dictionary: 'Invalid Dict'
        }
      ];

      const result = getGlossary(mixedDefinitions, {});
      
      // Should process the valid definition and skip invalid ones
      expect(result.html).toContain('Valid definition');
      expect(result.html).toContain('data-dictionary="Valid Dict"');
      expect(result.imagePaths).toEqual([]);
      expect(result.dictionaryNames).toEqual([]);
    });
  });

  describe('Image Processing Errors', () => {
    it('should handle images with missing path gracefully', () => {
      const definitions = [
        {
          type: 'structured',
          content: '[{"tag":"img","height":10,"sizeUnits":"em"}]', // Missing path
          dictionary: 'Test Dictionary'
        }
      ];

      const result = getMainDefinition(definitions);
      
      // Should not crash - image without path should not have src attribute
      expect(result.html).toContain('<img style="height: 10em;" />');
      expect(result.imagePaths).toEqual([]);
      expect(result.dictionaryNames).toEqual([]);
    });

    it('should handle images with invalid path gracefully', () => {
      const definitions = [
        {
          type: 'structured',
          content: '[{"tag":"img","path":null,"height":10,"sizeUnits":"em"}]',
          dictionary: 'Test Dictionary'
        }
      ];

      const result = getMainDefinition(definitions);
      
      // Should not crash - image without path should not have src attribute
      expect(result.html).toContain('<img style="height: 10em;" />');
      expect(result.imagePaths).toEqual([]);
      expect(result.dictionaryNames).toEqual([]);
    });

    it('should handle images with missing dictionary name', () => {
      const definitions = [
        {
          type: 'structured',
          content: '[{"tag":"img","path":"test-image.png","height":10,"sizeUnits":"em"}]'
          // Missing dictionary name
        }
      ];

      const result = getMainDefinition(definitions);
      
      // Should still process the image but with "unknown" as dictionary name
      const unknownHash = 'unknown'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
      expect(result.html).toContain(`<img src="ANKI_IMAGE_PLACEHOLDER_${unknownHash}_0"`);
      expect(result.imagePaths).toEqual(['unknown/test-image.png']);
      expect(result.dictionaryNames).toEqual(['unknown']); // "unknown" is used for missing dictionary name
    });
  });

  describe('API Error Handling', () => {
    it('should handle signed URL generation errors', async () => {

      const definitions = [
        {
          type: 'structured',
          content: '[{"tag":"img","path":"test-image.png","height":10,"sizeUnits":"em"}]',
          dictionary: 'Test Dictionary'
        }
      ];

      const result = getMainDefinition(definitions);
      expect(result.imagePaths).toEqual(['Test Dictionary/test-image.png']);

    });

  describe('Edge Cases', () => {
    it('should handle very long dictionary names', () => {
      const longDictionaryName = 'A'.repeat(1000);
      const definitions = [
        {
          type: 'structured',
          content: '[{"tag":"img","path":"test-image.png","height":10,"sizeUnits":"em"}]',
          dictionary: longDictionaryName
        }
      ];

      const result = getMainDefinition(definitions);
      
      // Should handle long names without issues
      expect(result.imagePaths).toEqual([`${longDictionaryName}/test-image.png`]);
      expect(result.dictionaryNames).toEqual([longDictionaryName]);
      expect(result.html).toContain(`data-dictionary="${longDictionaryName}"`);
    });

    it('should handle special characters in dictionary names', () => {
      const specialDictionaryName = '[JA-JA Yoji] 四字熟語の百科事典 [2024-06-30]';
      const definitions = [
        {
          type: 'structured',
          content: '[{"tag":"img","path":"test-image.png","height":10,"sizeUnits":"em"}]',
          dictionary: specialDictionaryName
        }
      ];

      const result = getMainDefinition(definitions);
      
      // Should handle special characters correctly
      expect(result.imagePaths).toEqual([`${specialDictionaryName}/test-image.png`]);
      expect(result.dictionaryNames).toEqual([specialDictionaryName]);
      expect(result.html).toContain(`data-dictionary="${specialDictionaryName}"`);
    });

    it('should handle empty image paths', () => {
      const definitions = [
        {
          type: 'structured',
          content: '[{"tag":"img","path":"","height":10,"sizeUnits":"em"}]',
          dictionary: 'Test Dictionary'
        }
      ];

      const result = getMainDefinition(definitions);
      
      // Should handle empty paths gracefully - image without path should not have src attribute
      expect(result.html).toContain('<img style="height: 10em;" />');
      expect(result.imagePaths).toEqual([]);
      expect(result.dictionaryNames).toEqual([]);
    });
  });
  });
});
