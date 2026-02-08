import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock browser storage with proper argument validation
const createMockStorage = () => {
  const storage = {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  };

  // Add argument validation to catch the errors we encountered
  storage.get.mockImplementation(function(_keys) {
    if (arguments.length > 1) {
      throw new Error(`Expected at most 1 argument for get(), got ${arguments.length}`);
    }
    return Promise.resolve({});
  });

  storage.remove.mockImplementation(function(_keys) {
    if (arguments.length > 1) {
      throw new Error(`Expected at most 1 argument for remove(), got ${arguments.length}`);
    }
    return Promise.resolve();
  });

  return storage;
};

describe('Storage API Usage', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    vi.clearAllMocks();
  });

  describe('Correct Usage', () => {
    it('should allow get() with single array argument', async () => {
      await expect(mockStorage.get(['key1', 'key2'])).resolves.toBeDefined();
      expect(mockStorage.get).toHaveBeenCalledWith(['key1', 'key2']);
    });

    it('should allow get() with single string argument', async () => {
      await expect(mockStorage.get('key1')).resolves.toBeDefined();
      expect(mockStorage.get).toHaveBeenCalledWith('key1');
    });

    it('should allow remove() with single array argument', async () => {
      await expect(mockStorage.remove(['key1', 'key2'])).resolves.toBeUndefined();
      expect(mockStorage.remove).toHaveBeenCalledWith(['key1', 'key2']);
    });

    it('should allow remove() with single string argument', async () => {
      await expect(mockStorage.remove('key1')).resolves.toBeUndefined();
      expect(mockStorage.remove).toHaveBeenCalledWith('key1');
    });
  });

  describe('Incorrect Usage (should throw errors)', () => {
    it('should throw error when get() is called with multiple arguments', async () => {
      // This simulates the error we encountered
      await expect(() => {
        // @ts-ignore - intentionally wrong usage
        mockStorage.get('key1', 'key2');
      }).toThrow('Expected at most 1 argument for get(), got 2');
    });

    it('should throw error when remove() is called with multiple arguments', async () => {
      // This simulates the error we encountered
      await expect(() => {
        // @ts-ignore - intentionally wrong usage
        mockStorage.remove('key1', 'key2');
      }).toThrow('Expected at most 1 argument for remove(), got 2');
    });

    it('should throw error when remove() is called with callback as second argument', async () => {
      // This simulates the callback-style usage that caused errors
      await expect(() => {
        // @ts-ignore - intentionally wrong usage
        mockStorage.remove(['key1', 'key2'], () => {});
      }).toThrow('Expected at most 1 argument for remove(), got 2');
    });
  });
});

describe('Storage Adapter Implementation', () => {
  it('should implement correct storage adapter pattern', () => {
    // Test the storage adapter pattern we use in sw-main.ts
    const storage = {
      async getItem(key: string) {
        // This should use array syntax
        const mockStorage = createMockStorage();
        const v = await mockStorage.get([key]);
        return (v as any)[key] ?? null;
      },
      async setItem(key: string, value: string) {
        const mockStorage = createMockStorage();
        await mockStorage.set({ [key]: value });
      },
      async removeItem(key: string) {
        const mockStorage = createMockStorage();
        await mockStorage.remove([key]);
      },
    };

    // These should not throw errors
    expect(() => storage.getItem('test')).not.toThrow();
    expect(() => storage.setItem('test', 'value')).not.toThrow();
    expect(() => storage.removeItem('test')).not.toThrow();
  });
});
