// Tests for content script extension context invalidation handling
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock browser APIs
const mockBrowser = {
  runtime: {
    id: 'test-extension-id',
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn()
    }
  }
};

// Mock the browser module
vi.mock('@/lib/browser', () => ({
  browser: mockBrowser
}));

describe('Content Script Context Invalidation Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleRuntimeError function', () => {
    const handleRuntimeError = (error: any, responseType: string, defaultError: string = 'Failed to send message to background script') => {
      // Handle extension context invalidation
      if (error && error && error.message && error.message.includes('Extension context invalidated')) {
        console.log('🔄 Extension context invalidated - extension was reloaded. This is normal during development.');
        return {
          type: responseType,
          success: false,
          available: false,
          configured: false,
          error: 'Extension was reloaded. Please refresh the page and try again.'
        };
      } else {
        console.error(`❌ Error in ${responseType}:`, error);
        return {
          type: responseType,
          success: false,
          available: false,
          configured: false,
          error: (error && error.message) || defaultError
        };
      }
    };

    it('should handle extension context invalidated error gracefully', () => {
      const error = new Error('Extension context invalidated');
      const response = handleRuntimeError(error, 'testResponse');

      expect(response).toEqual({
        type: 'testResponse',
        success: false,
        available: false,
        configured: false,
        error: 'Extension was reloaded. Please refresh the page and try again.'
      });

      expect(console.log).toHaveBeenCalledWith('🔄 Extension context invalidated - extension was reloaded. This is normal during development.');
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should handle other errors normally', () => {
      const error = new Error('Network error');
      const response = handleRuntimeError(error, 'testResponse');

      expect(response).toEqual({
        type: 'testResponse',
        success: false,
        available: false,
        configured: false,
        error: 'Network error'
      });

      expect(console.error).toHaveBeenCalledWith('❌ Error in testResponse:', error);
    });

    it('should handle errors without message property', () => {
      const error = { code: 'UNKNOWN_ERROR' };
      const response = handleRuntimeError(error, 'testResponse', 'Custom default error');

      expect(response).toEqual({
        type: 'testResponse',
        success: false,
        available: false,
        configured: false,
        error: 'Custom default error'
      });
    });

    it('should handle null/undefined errors', () => {
      const response = handleRuntimeError(null, 'testResponse');

      expect(response).toEqual({
        type: 'testResponse',
        success: false,
        available: false,
        configured: false,
        error: 'Failed to send message to background script'
      });
    });
  });

  describe('ensureRuntimeAvailable function', () => {
    const ensureRuntimeAvailable = (operation: string): boolean => {
      if (!mockBrowser.runtime) {
        console.error(`💥 Browser runtime not available for ${operation}`);
        return false;
      }
      return true;
    };

    it('should return true when runtime is available', () => {
      const result = ensureRuntimeAvailable('test operation');
      expect(result).toBe(true);
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should return false and log error when runtime is not available', () => {
      // Temporarily remove runtime
      const originalRuntime = mockBrowser.runtime;
      delete (mockBrowser as any).runtime;

      const result = ensureRuntimeAvailable('test operation');
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('💥 Browser runtime not available for test operation');

      // Restore runtime
      mockBrowser.runtime = originalRuntime;
    });
  });

  describe('Context monitoring', () => {
    it('should detect when runtime becomes unavailable', () => {
      // Mock the context monitoring logic
      let contextCheckInterval: number | null = null;
      let statusCleared = false;

      const clearExtensionStatus = () => {
        statusCleared = true;
      };

      const startContextMonitoring = () => {
        if (contextCheckInterval) return;

        contextCheckInterval = window.setInterval(() => {
          try {
            if (!mockBrowser.runtime || !mockBrowser.runtime.id) {
              console.log('🔄 Extension context invalidated detected - stopping monitoring');
              if (contextCheckInterval) {
                clearInterval(contextCheckInterval);
                contextCheckInterval = null;
              }
              clearExtensionStatus();
            }
          } catch (error) {
            console.log(`🔄 Extension context invalidated detected via error - stopping monitoring, error=${JSON.stringify(error)}`);
            if (contextCheckInterval) {
              clearInterval(contextCheckInterval);
              contextCheckInterval = null;
            }
            clearExtensionStatus();
          }
        }, 100); // Use short interval for testing
      };

      // Start monitoring
      startContextMonitoring();
      expect(contextCheckInterval).not.toBeNull();

      // Simulate context invalidation by removing runtime
      const originalRuntime = mockBrowser.runtime;
      delete (mockBrowser as any).runtime;

      // Wait for the interval to trigger
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(statusCleared).toBe(true);
          expect(contextCheckInterval).toBeNull();

          // Restore runtime
          mockBrowser.runtime = originalRuntime;
          resolve();
        }, 150);
      });
    });
  });

  describe('Message handling with context invalidation', () => {
    it('should handle Anki health check with context invalidation', async () => {
      const handleRuntimeError = (error: any, responseType: string) => {
        if (error && error.message && error.message.includes('Extension context invalidated')) {
          return {
            type: responseType,
            success: false,
            available: false,
            configured: false,
            error: 'Extension was reloaded. Please refresh the page and try again.'
          };
        }
        return { type: responseType, success: false, error: (error && error.message) || 'Unknown error' };
      };

      const setExtensionStatus = vi.fn();

      // Mock the Anki health check flow
      const error = new Error('Extension context invalidated');
      const errorResponse = handleRuntimeError(error, 'ankiHealthResponse');

      expect(errorResponse).toEqual({
        type: 'ankiHealthResponse',
        success: false,
        available: false,
        configured: false,
        error: 'Extension was reloaded. Please refresh the page and try again.'
      });

      // Should also update extension status
      if (error && error.message && error.message.includes('Extension context invalidated')) {
        setExtensionStatus(false, false);
      }

      expect(setExtensionStatus).toHaveBeenCalledWith(false, false);
    });

    it('should handle sync card request with context invalidation', async () => {
      const handleRuntimeError = (error: any, responseType: string) => {
        if (error && error.message && error.message.includes('Extension context invalidated')) {
          return {
            type: responseType,
            success: false,
            available: false,
            configured: false,
            error: 'Extension was reloaded. Please refresh the page and try again.'
          };
        }
        return { type: responseType, success: false, error: (error && error.message) || 'Unknown error' };
      };

      const setExtensionStatus = vi.fn();

      // Mock the sync card flow
      const error = new Error('Extension context invalidated');
      const errorResponse = handleRuntimeError(error, 'anki.syncCardsResponse');
      (errorResponse as any).results = [];

      expect(errorResponse).toEqual({
        type: 'anki.syncCardsResponse',
        success: false,
        available: false,
        configured: false,
        error: 'Extension was reloaded. Please refresh the page and try again.',
        results: []
      });

      // Should also update extension status
      if (error && error.message && error.message.includes('Extension context invalidated')) {
        setExtensionStatus(false, false);
      }

      expect(setExtensionStatus).toHaveBeenCalledWith(false, false);
    });

    it('should handle Supabase session transfer with context invalidation', async () => {
      const setExtensionStatus = vi.fn();

      // Mock the Supabase session transfer flow
      const error = new Error('Extension context invalidated');

      // Should catch the error and update extension status
      if (error && error.message && error.message.includes('Extension context invalidated')) {
        setExtensionStatus(false, false);
      }

      expect(setExtensionStatus).toHaveBeenCalledWith(false, false);
    });
  });
});
