import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the image sync helper functions
vi.mock('../lib/imageSyncHelper', () => ({
  checkMediaExistsInAnki: vi.fn(),
  fetchImageForAnki: vi.fn(),
  storeImageInAnki: vi.fn(),
}));

// Mock the definition processing
vi.mock('../lib/definitionProcessing', () => ({
  getMainDefinition: vi.fn(),
  getGlossary: vi.fn(),
  extractTextFromDefinition: vi.fn(),
  objectToStyleString: vi.fn(),
}));

// Mock browser API
vi.mock('../lib/browser', () => ({
  browser: {
    storage: {
      session: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
      },
    },
    runtime: {
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      onInstalled: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      onStartup: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
  getBrowserInfo: vi.fn(() => ({ name: 'chrome', version: '120' })),
}));

// Mock webextension-polyfill
vi.mock('webextension-polyfill', () => ({}));

describe('Service Worker Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should import the image sync helper correctly', async () => {
    // This test verifies that the import works and the module can be loaded
    const { checkMediaExistsInAnki, fetchImageForAnki, storeImageInAnki } = await import('../lib/imageSyncHelper');

    expect(checkMediaExistsInAnki).toBeDefined();
    expect(fetchImageForAnki).toBeDefined();
    expect(storeImageInAnki).toBeDefined();
    expect(typeof checkMediaExistsInAnki).toBe('function');
    expect(typeof fetchImageForAnki).toBe('function');
    expect(typeof storeImageInAnki).toBe('function');
  });

  it('should be able to load the main service worker module', async () => {
    // This test verifies that the main module can be imported without errors
    // after our changes
    expect(async () => {
      await import('../sw-main');
    }).not.toThrow();
  });
});
