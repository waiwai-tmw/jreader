import { describe, it, expect } from 'vitest';

import { getBrowserInfo } from '../browser';

describe('Browser Utilities', () => {
  describe('getBrowserInfo', () => {
    it('should detect Chrome browser', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        writable: true,
      });

      expect(getBrowserInfo()).toBe('chrome');
    });

    it('should detect Firefox browser', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
        writable: true,
      });

      expect(getBrowserInfo()).toBe('firefox');
    });

    it('should detect Safari browser', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        writable: true,
      });

      expect(getBrowserInfo()).toBe('safari');
    });

    it('should detect Edge browser', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        writable: true,
      });

      expect(getBrowserInfo()).toBe('edge');
    });

    it('should return unknown for unrecognized browsers', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'SomeUnknownBrowser/1.0',
        writable: true,
      });

      expect(getBrowserInfo()).toBe('unknown');
    });
  });
});
