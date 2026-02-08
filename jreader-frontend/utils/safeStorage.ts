/**
 * Safe storage utility for Next.js applications
 * Handles localStorage operations with SSR safety
 */

export const safeStorage = {
  /**
   * Get an item from localStorage
   */
  getItem: (key: string): string | null => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.warn(`Failed to get localStorage item '${key}':`, error);
        return null;
      }
    }
    return null;
  },

  /**
   * Set an item in localStorage
   */
  setItem: (key: string, value: string): void => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.warn(`Failed to set localStorage item '${key}':`, error);
      }
    }
  },

  /**
   * Remove an item from localStorage
   */
  removeItem: (key: string): void => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`Failed to remove localStorage item '${key}':`, error);
      }
    }
  },

  /**
   * Clear all localStorage
   */
  clear: (): void => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.clear();
      } catch (error) {
        console.warn('Failed to clear localStorage:', error);
      }
    }
  },

  /**
   * Get the number of items in localStorage
   */
  get length(): number {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.length;
      } catch (error) {
        console.warn('Failed to get localStorage length:', error);
        return 0;
      }
    }
    return 0;
  },

  /**
   * Get a key by index
   */
  key: (index: number): string | null => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.key(index);
      } catch (error) {
        console.warn(`Failed to get localStorage key at index ${index}:`, error);
        return null;
      }
    }
    return null;
  }
};

/**
 * Safe JSON storage utilities
 */
export const safeJsonStorage = {
  /**
   * Get a JSON item from localStorage
   */
  getItem: <T>(key: string, defaultValue: T): T => {
    const item = safeStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }
    
    try {
      return JSON.parse(item) as T;
    } catch (error) {
      console.warn(`Failed to parse JSON from localStorage key '${key}':`, error);
      return defaultValue;
    }
  },

  /**
   * Set a JSON item in localStorage
   */
  setItem: <T>(key: string, value: T): void => {
    try {
      const serialized = JSON.stringify(value);
      safeStorage.setItem(key, serialized);
    } catch (error) {
      console.warn(`Failed to serialize JSON for localStorage key '${key}':`, error);
    }
  },

  /**
   * Remove a JSON item from localStorage
   */
  removeItem: (key: string): void => {
    safeStorage.removeItem(key);
  }
};

/**
 * Safe number storage utilities
 */
export const safeNumberStorage = {
  /**
   * Get a number from localStorage
   */
  getItem: (key: string, defaultValue: number): number => {
    const item = safeStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }
    
    const parsed = parseFloat(item);
    return isNaN(parsed) ? defaultValue : parsed;
  },

  /**
   * Set a number in localStorage
   */
  setItem: (key: string, value: number): void => {
    safeStorage.setItem(key, value.toString());
  },

  /**
   * Remove a number from localStorage
   */
  removeItem: (key: string): void => {
    safeStorage.removeItem(key);
  }
};

/**
 * Safe boolean storage utilities
 */
export const safeBooleanStorage = {
  /**
   * Get a boolean from localStorage
   */
  getItem: (key: string, defaultValue: boolean): boolean => {
    const item = safeStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }
    
    return item === 'true';
  },

  /**
   * Set a boolean in localStorage
   */
  setItem: (key: string, value: boolean): void => {
    safeStorage.setItem(key, value.toString());
  },

  /**
   * Remove a boolean from localStorage
   */
  removeItem: (key: string): void => {
    safeStorage.removeItem(key);
  }
};

/**
 * Safe string storage utilities
 */
export const safeStringStorage = {
  /**
   * Get a string from localStorage
   */
  getItem: (key: string, defaultValue: string): string => {
    const item = safeStorage.getItem(key);
    return item ?? defaultValue;
  },

  /**
   * Set a string in localStorage
   */
  setItem: (key: string, value: string): void => {
    safeStorage.setItem(key, value);
  },

  /**
   * Remove a string from localStorage
   */
  removeItem: (key: string): void => {
    safeStorage.removeItem(key);
  }
};
