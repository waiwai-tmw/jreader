import { extractNcodeFromUrl, getGenreName } from '../syosetuGenres';

describe('syosetuGenres', () => {
  describe('extractNcodeFromUrl', () => {
    it('should extract N-code from URL with trailing slash', () => {
      const url = 'https://ncode.syosetu.com/n8417fa/';
      const result = extractNcodeFromUrl(url);
      expect(result).toBe('n8417fa');
    });

    it('should extract N-code from URL without trailing slash', () => {
      const url = 'https://ncode.syosetu.com/n8417fa';
      const result = extractNcodeFromUrl(url);
      expect(result).toBe('n8417fa');
    });

    it('should extract N-code from novel18 URL', () => {
      const url = 'https://novel18.syosetu.com/n8417fa/';
      const result = extractNcodeFromUrl(url);
      expect(result).toBe('n8417fa');
    });

    it('should extract N-code with different patterns', () => {
      const testCases = [
        { url: 'https://ncode.syosetu.com/n0001a', expected: 'n0001a' },
        { url: 'https://ncode.syosetu.com/s1234b/', expected: 's1234b' },
        { url: 'https://ncode.syosetu.com/n9999z', expected: 'n9999z' },
        { url: 'https://ncode.syosetu.com/n1a/', expected: 'n1a' },
        { url: 'https://ncode.syosetu.com/n123456789a', expected: 'n123456789a' },
      ];

      testCases.forEach(({ url, expected }) => {
        const result = extractNcodeFromUrl(url);
        expect(result).toBe(expected);
      });
    });

    it('should return null for invalid URLs', () => {
      const invalidUrls = [
        'https://ncode.syosetu.com/', // empty path
        'not-a-url', // malformed URL
        '', // empty string
      ];

      invalidUrls.forEach(url => {
        const result = extractNcodeFromUrl(url);
        expect(result).toBeNull();
      });
    });

    it('should return path content for any valid URL path', () => {
      const testCases = [
        { url: 'https://ncode.syosetu.com/invalid', expected: 'invalid' },
        { url: 'https://ncode.syosetu.com/123456', expected: '123456' },
        { url: 'https://ncode.syosetu.com/abc', expected: 'abc' },
        { url: 'https://ncode.syosetu.com/n123', expected: 'n123' },
        { url: 'https://ncode.syosetu.com/123a', expected: '123a' },
        { url: 'https://example.com/n8417fa', expected: 'n8417fa' },
      ];

      testCases.forEach(({ url, expected }) => {
        const result = extractNcodeFromUrl(url);
        expect(result).toBe(expected);
      });
    });

    it('should handle URLs with query parameters', () => {
      const url = 'https://ncode.syosetu.com/n8417fa/?p=1';
      const result = extractNcodeFromUrl(url);
      expect(result).toBe('n8417fa');
    });

    it('should handle URLs with fragments', () => {
      const url = 'https://ncode.syosetu.com/n8417fa/#chapter1';
      const result = extractNcodeFromUrl(url);
      expect(result).toBe('n8417fa');
    });

    it('should return lowercase N-code', () => {
      const url = 'https://ncode.syosetu.com/N8417FA';
      const result = extractNcodeFromUrl(url);
      expect(result).toBe('n8417fa');
    });
  });

  describe('getGenreName', () => {
    it('should return correct genre names', () => {
      expect(getGenreName(0)).toBe('未選択〔未選択〕');
      expect(getGenreName(101)).toBe('異世界〔恋愛〕');
      expect(getGenreName(401)).toBe('VRゲーム〔SF〕');
      expect(getGenreName(9999)).toBe('その他〔その他〕');
    });

    it('should return "Unknown Genre" for invalid genre IDs', () => {
      expect(getGenreName(99999)).toBe('Unknown Genre');
      expect(getGenreName(-1)).toBe('Unknown Genre');
    });
  });
});
