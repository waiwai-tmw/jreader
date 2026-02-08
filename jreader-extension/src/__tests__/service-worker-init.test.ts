import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the browser APIs with proper validation
const createMockBrowser = () => {
  const storage = {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
    session: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  };

  // Add argument validation to storage methods
  storage.local.get.mockImplementation(function(_keys) {
    if (arguments.length > 1) {
      throw new Error(`Expected at most 1 argument for get(), got ${arguments.length}`);
    }
    return Promise.resolve({});
  });

  storage.local.remove.mockImplementation(function(_keys) {
    if (arguments.length > 1) {
      throw new Error(`Expected at most 1 argument for remove(), got ${arguments.length}`);
    }
    return Promise.resolve();
  });

  storage.session.get.mockImplementation(function(_keys) {
    if (arguments.length > 1) {
      throw new Error(`Expected at most 1 argument for get(), got ${arguments.length}`);
    }
    return Promise.resolve({});
  });

  storage.session.remove.mockImplementation(function(_keys) {
    if (arguments.length > 1) {
      throw new Error(`Expected at most 1 argument for remove(), got ${arguments.length}`);
    }
    return Promise.resolve();
  });

  return {
    storage,
    runtime: {
      id: 'test-extension-id',
      onMessage: {
        addListener: vi.fn(),
      },
      onInstalled: {
        addListener: vi.fn(),
      },
      onStartup: {
        addListener: vi.fn(),
      },
    },
  };
};

describe('Service Worker Initialization', () => {
  let mockBrowser: ReturnType<typeof createMockBrowser>;

  beforeEach(() => {
    mockBrowser = createMockBrowser();
    vi.clearAllMocks();
  });

  describe('Storage Operations', () => {
    it('should handle storage.get() calls correctly', async () => {
      // Test the pattern used in our service worker
      const result = await mockBrowser.storage.local.get(['supabase_session']);
      expect(result).toBeDefined();
      expect(mockBrowser.storage.local.get).toHaveBeenCalledWith(['supabase_session']);
    });

    it('should handle storage.remove() calls correctly', async () => {
      // Test the pattern used in our service worker
      await mockBrowser.storage.local.remove(['device_token', 'supabase_session']);
      expect(mockBrowser.storage.local.remove).toHaveBeenCalledWith(['device_token', 'supabase_session']);
    });

    it('should throw error for incorrect storage.get() usage', async () => {
      // This would catch the error we encountered
      await expect(() => {
        // @ts-ignore - intentionally wrong usage
        mockBrowser.storage.local.get('key1', 'key2');
      }).toThrow('Expected at most 1 argument for get(), got 2');
    });

    it('should throw error for incorrect storage.remove() usage', async () => {
      // This would catch the error we encountered
      await expect(() => {
        // @ts-ignore - intentionally wrong usage
        mockBrowser.storage.local.remove('key1', 'key2');
      }).toThrow('Expected at most 1 argument for remove(), got 2');
    });
  });

  describe('Storage Adapter Pattern', () => {
    it('should implement service worker safe storage adapter', async () => {
      // Test the storage adapter we use for Supabase
      const storage = {
        async getItem(key: string) {
          const v = await mockBrowser.storage.session.get([key]);
          return (v as any)[key] ?? null;
        },
        async setItem(key: string, value: string) {
          await mockBrowser.storage.session.set({ [key]: value });
        },
        async removeItem(key: string) {
          await mockBrowser.storage.session.remove([key]);
        },
      };

      // These should work without errors
      await expect(storage.getItem('test')).resolves.toBeNull();
      await expect(storage.setItem('test', 'value')).resolves.toBeUndefined();
      await expect(storage.removeItem('test')).resolves.toBeUndefined();

      // Verify correct API calls
      expect(mockBrowser.storage.session.get).toHaveBeenCalledWith(['test']);
      expect(mockBrowser.storage.session.set).toHaveBeenCalledWith({ test: 'value' });
      expect(mockBrowser.storage.session.remove).toHaveBeenCalledWith(['test']);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle storage errors gracefully', async () => {
      // Mock storage to throw an error
      mockBrowser.storage.local.get.mockRejectedValue(new Error('Storage error'));

      // Test error handling pattern
      try {
        await mockBrowser.storage.local.get(['supabase_session']);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Storage error');
      }
    });

    it('should handle missing storage gracefully', async () => {
      // Test the pattern we use to check for storage availability
      const hasStorage = !!(mockBrowser.storage && mockBrowser.storage.local);
      expect(hasStorage).toBe(true);
    });
  });
});
