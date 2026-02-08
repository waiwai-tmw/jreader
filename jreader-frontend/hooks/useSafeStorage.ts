import { useState, useEffect } from 'react';

import { safeStorage, safeJsonStorage, safeNumberStorage, safeBooleanStorage, safeStringStorage } from '@/utils/safeStorage';

/**
 * Hook for safe localStorage operations with SSR safety
 */
export function useSafeStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const item = safeStorage.getItem(key);
        if (item !== null) {
          const parsed = JSON.parse(item) as T;
          setValue(parsed);
        }
      } catch (error) {
        console.warn(`Failed to load ${key} from localStorage:`, error);
      } finally {
        setIsLoaded(true);
      }
    } else {
      setIsLoaded(true);
    }
  }, [key]);

  // Function to update both state and localStorage
  const setStoredValue = (newValue: T | ((val: T) => T)) => {
    try {
      const valueToStore = newValue instanceof Function ? newValue(value) : newValue;
      setValue(valueToStore);
      
      if (typeof window !== 'undefined') {
        const serialized = JSON.stringify(valueToStore);
        safeStorage.setItem(key, serialized);
      }
    } catch (error) {
      console.warn(`Failed to save ${key} to localStorage:`, error);
    }
  };

  return [value, setStoredValue, isLoaded] as const;
}

/**
 * Hook for safe number storage
 */
export function useSafeNumberStorage(key: string, defaultValue: number) {
  const [value, setValue] = useState<number>(defaultValue);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = safeNumberStorage.getItem(key, defaultValue);
      setValue(stored);
    }
    setIsLoaded(true);
  }, [key, defaultValue]);

  const setStoredValue = (newValue: number | ((val: number) => number)) => {
    const valueToStore = newValue instanceof Function ? newValue(value) : newValue;
    setValue(valueToStore);
    safeNumberStorage.setItem(key, valueToStore);
  };

  return [value, setStoredValue, isLoaded] as const;
}

/**
 * Hook for safe boolean storage
 */
export function useSafeBooleanStorage(key: string, defaultValue: boolean) {
  const [value, setValue] = useState<boolean>(defaultValue);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = safeBooleanStorage.getItem(key, defaultValue);
      setValue(stored);
    }
    setIsLoaded(true);
  }, [key, defaultValue]);

  const setStoredValue = (newValue: boolean | ((val: boolean) => boolean)) => {
    const valueToStore = newValue instanceof Function ? newValue(value) : newValue;
    setValue(valueToStore);
    safeBooleanStorage.setItem(key, valueToStore);
  };

  return [value, setStoredValue, isLoaded] as const;
}

/**
 * Hook for safe string storage
 */
export function useSafeStringStorage(key: string, defaultValue: string) {
  const [value, setValue] = useState<string>(defaultValue);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = safeStringStorage.getItem(key, defaultValue);
      setValue(stored);
    }
    setIsLoaded(true);
  }, [key, defaultValue]);

  const setStoredValue = (newValue: string | ((val: string) => string)) => {
    const valueToStore = newValue instanceof Function ? newValue(value) : newValue;
    setValue(valueToStore);
    safeStringStorage.setItem(key, valueToStore);
  };

  return [value, setStoredValue, isLoaded] as const;
}

/**
 * Hook for safe JSON storage
 */
export function useSafeJsonStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = safeJsonStorage.getItem(key, defaultValue);
      setValue(stored);
    }
    setIsLoaded(true);
  }, [key, defaultValue]);

  const setStoredValue = (newValue: T | ((val: T) => T)) => {
    const valueToStore = newValue instanceof Function ? newValue(value) : newValue;
    setValue(valueToStore);
    safeJsonStorage.setItem(key, valueToStore);
  };

  return [value, setStoredValue, isLoaded] as const;
}
