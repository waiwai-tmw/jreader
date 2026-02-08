import { isIOS, isSafari } from './deviceDetection';

// Mock navigator.userAgent
const mockUserAgent = (userAgent: string) => {
  Object.defineProperty(navigator, 'userAgent', {
    value: userAgent,
    configurable: true
  });
};

describe('deviceDetection', () => {
  beforeEach(() => {
    // Reset to a default user agent
    mockUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  });

  describe('isIOS', () => {
    it('should return true for iPhone', () => {
      mockUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15');
      expect(isIOS()).toBe(true);
    });

    it('should return true for iPad', () => {
      mockUserAgent('Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15');
      expect(isIOS()).toBe(true);
    });

    it('should return true for iPod', () => {
      mockUserAgent('Mozilla/5.0 (iPod; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15');
      expect(isIOS()).toBe(true);
    });

    it('should return true for modern iPadOS devices (Macintosh user agent)', () => {
      mockUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15');
      // Mock ontouchend to simulate iPad touch support
      Object.defineProperty(document, 'ontouchend', {
        value: null,
        configurable: true
      });
      expect(isIOS()).toBe(true);
    });

    it('should return true for iPad Pro with Macintosh user agent', () => {
      mockUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15');
      // Mock ontouchend to simulate iPad touch support
      Object.defineProperty(document, 'ontouchend', {
        value: null,
        configurable: true
      });
      expect(isIOS()).toBe(true);
    });

    it('should return false for Windows desktop', () => {
      mockUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      expect(isIOS()).toBe(false);
    });

    it('should return false for Android devices', () => {
      mockUserAgent('Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36');
      expect(isIOS()).toBe(false);
    });

    it('should return false for desktop browsers', () => {
      mockUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      expect(isIOS()).toBe(false);
    });

    it('should return false when window is undefined', () => {
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;
      expect(isIOS()).toBe(false);
      global.window = originalWindow;
    });
  });

  describe('isSafari', () => {
    it('should return true for Safari on macOS', () => {
      mockUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15');
      expect(isSafari()).toBe(true);
    });

    it('should return true for Safari on iOS (iPhone)', () => {
      mockUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');
      expect(isSafari()).toBe(true);
    });

    it('should return true for Safari on iPadOS', () => {
      mockUserAgent('Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');
      expect(isSafari()).toBe(true);
    });

    it('should return false for Chrome on Windows', () => {
      mockUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      expect(isSafari()).toBe(false);
    });

    it('should return false for Chrome on macOS', () => {
      mockUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      expect(isSafari()).toBe(false);
    });

    it('should return false for Edge on Windows', () => {
      mockUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59');
      expect(isSafari()).toBe(false);
    });

    it('should return false for Firefox on macOS', () => {
      mockUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7; rv:89.0) Gecko/20100101 Firefox/89.0');
      expect(isSafari()).toBe(false);
    });

    it('should return false for Firefox on Windows', () => {
      mockUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0');
      expect(isSafari()).toBe(false);
    });

    it('should return false for Android Chrome', () => {
      mockUserAgent('Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36');
      expect(isSafari()).toBe(false);
    });

    it('should return false for Opera browser', () => {
      mockUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 OPR/77.0.4054.254');
      expect(isSafari()).toBe(false);
    });

    it('should return false for Brave browser', () => {
      mockUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Brave/1.27.97');
      expect(isSafari()).toBe(false);
    });

    it('should return false when window is undefined', () => {
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;
      expect(isSafari()).toBe(false);
      global.window = originalWindow;
    });
  });
});
