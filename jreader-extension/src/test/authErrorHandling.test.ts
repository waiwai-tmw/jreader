// Comprehensive unit tests for authentication error handling
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AuthErrorHandler, withAuthErrorHandling } from '../lib/authErrorHandler';
import { AuthNotificationHandler } from '../lib/authNotificationHandler';

import { browser } from '@/lib/browser';

// Mock the browser module
vi.mock('@/lib/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn()
      },
      session: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn()
      }
    },
    notifications: {
      create: vi.fn(),
      clear: vi.fn(),
      onClicked: {
        addListener: vi.fn()
      }
    },
    runtime: {
      sendMessage: vi.fn()
    },
    tabs: {
      create: vi.fn()
    },
    permissions: {
      contains: vi.fn()
    }
  }
}));

describe('AuthErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isAuthError', () => {
    it('should detect invalid refresh token errors', () => {
      const error = new Error('AuthApiError: Invalid Refresh Token: Already Used');
      expect(AuthErrorHandler.isAuthError(error)).toBe(true);
    });

    it('should detect missing session errors', () => {
      const error = new Error('AuthSessionMissingError: Auth session missing!');
      expect(AuthErrorHandler.isAuthError(error)).toBe(true);
    });

    it('should detect JWT expiration errors', () => {
      const error = new Error('JWT expired');
      expect(AuthErrorHandler.isAuthError(error)).toBe(true);
    });

    it('should detect refresh token not found errors', () => {
      const error = new Error('refresh_token_not_found');
      expect(AuthErrorHandler.isAuthError(error)).toBe(true);
    });

    it('should not detect non-auth errors', () => {
      const error = new Error('Network timeout');
      expect(AuthErrorHandler.isAuthError(error)).toBe(false);
    });

    it('should handle null/undefined errors', () => {
      expect(AuthErrorHandler.isAuthError(null)).toBe(false);
      expect(AuthErrorHandler.isAuthError(undefined)).toBe(false);
    });

    it('should handle errors with code property', () => {
      const error = { code: 'Invalid Refresh Token: Already Used', message: 'Some message' };
      expect(AuthErrorHandler.isAuthError(error)).toBe(true);
    });
  });

  describe('isSessionInvalidError', () => {
    it('should detect invalid refresh token errors', () => {
      const error = new Error('Invalid Refresh Token: Already Used');
      expect(AuthErrorHandler.isSessionInvalidError(error)).toBe(true);
    });

    it('should detect missing session errors', () => {
      const error = new Error('AuthSessionMissingError');
      expect(AuthErrorHandler.isSessionInvalidError(error)).toBe(true);
    });

    it('should detect JWT expiration errors', () => {
      const error = new Error('JWT expired');
      expect(AuthErrorHandler.isSessionInvalidError(error)).toBe(true);
    });

    it('should detect invalid JWT errors', () => {
      const error = new Error('Invalid JWT');
      expect(AuthErrorHandler.isSessionInvalidError(error)).toBe(true);
    });

    it('should detect invalid grant errors', () => {
      const error = new Error('invalid_grant');
      expect(AuthErrorHandler.isSessionInvalidError(error)).toBe(true);
    });

    it('should not detect retryable errors', () => {
      const error = new Error('Network error');
      expect(AuthErrorHandler.isSessionInvalidError(error)).toBe(false);
    });

    it('should handle null/undefined errors', () => {
      expect(AuthErrorHandler.isSessionInvalidError(null)).toBe(false);
      expect(AuthErrorHandler.isSessionInvalidError(undefined)).toBe(false);
    });
  });

  describe('getUserFriendlyErrorMessage', () => {
    it('should return user-friendly message for invalid refresh token', () => {
      const error = new Error('Invalid Refresh Token: Already Used');
      const message = AuthErrorHandler.getUserFriendlyErrorMessage(error);
      expect(message).toBe('Your session has expired. Please sign in again.');
    });

    it('should return user-friendly message for missing session', () => {
      const error = new Error('AuthSessionMissingError');
      const message = AuthErrorHandler.getUserFriendlyErrorMessage(error);
      expect(message).toBe('You are not signed in. Please sign in to continue.');
    });

    it('should return user-friendly message for JWT expiration', () => {
      const error = new Error('JWT expired');
      const message = AuthErrorHandler.getUserFriendlyErrorMessage(error);
      expect(message).toBe('Your session has expired. Please sign in again.');
    });

    it('should return user-friendly message for invalid JWT', () => {
      const error = new Error('Invalid JWT');
      const message = AuthErrorHandler.getUserFriendlyErrorMessage(error);
      expect(message).toBe('Your session has expired. Please sign in again.');
    });

    it('should return user-friendly message for refresh token not found', () => {
      const error = new Error('refresh_token_not_found');
      const message = AuthErrorHandler.getUserFriendlyErrorMessage(error);
      expect(message).toBe('Authentication session not found. Please sign in again.');
    });

    it('should return user-friendly message for network errors', () => {
      const error = new Error('Network error');
      const message = AuthErrorHandler.getUserFriendlyErrorMessage(error);
      expect(message).toBe('Network error. Please check your connection and try again.');
    });

    it('should return fallback message for unknown errors', () => {
      const error = new Error('Unknown error');
      const message = AuthErrorHandler.getUserFriendlyErrorMessage(error);
      expect(message).toBe('An authentication error occurred. Please try signing in again.');
    });

    it('should handle null/undefined errors', () => {
      expect(AuthErrorHandler.getUserFriendlyErrorMessage(null)).toBe('An unknown error occurred');
      expect(AuthErrorHandler.getUserFriendlyErrorMessage(undefined)).toBe('An unknown error occurred');
    });
  });

  describe('clearAuthData', () => {
    it('should clear all authentication data from storage', async () => {
      vi.mocked(browser.storage.local.remove).mockResolvedValue(undefined);
      vi.mocked(browser.storage.session.remove).mockResolvedValue(undefined);

      await AuthErrorHandler.clearAuthData();

      expect(browser.storage.local.remove).toHaveBeenCalledWith([
        'supabase_session',
        'supabase_url', 
        'supabase_anon_key',
        'device_token',
        'pairing_in_progress'
      ]);

      expect(browser.storage.session.remove).toHaveBeenCalledWith([
        'jreader_sw_auth'
      ]);
    });

    it('should handle errors when clearing auth data', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(browser.storage.local.remove).mockRejectedValue(new Error('Storage error'));

      await AuthErrorHandler.clearAuthData();

      expect(consoleSpy).toHaveBeenCalledWith('❌ Error clearing authentication data:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await AuthErrorHandler.retryWithBackoff(operation, 3, 100);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue('success');
      
      const result = await AuthErrorHandler.retryWithBackoff(operation, 3, 10);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max attempts', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Persistent failure'));
      
      await expect(AuthErrorHandler.retryWithBackoff(operation, 2, 10))
        .rejects.toThrow('Persistent failure');
      
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry session invalid errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Invalid Refresh Token: Already Used'));
      
      await expect(AuthErrorHandler.retryWithBackoff(operation, 3, 10))
        .rejects.toThrow('Invalid Refresh Token: Already Used');
      
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleAuthError', () => {
    it('should clear auth data and show notification for session invalid errors', async () => {
      const error = new Error('Invalid Refresh Token: Already Used');
      const context = { operation: 'test', timestamp: new Date().toISOString() };
      
      const clearAuthDataSpy = vi.spyOn(AuthErrorHandler, 'clearAuthData').mockResolvedValue();
      const showNotificationSpy = vi.spyOn(AuthNotificationHandler, 'showSessionExpiredNotification').mockResolvedValue();
      
      const result = await AuthErrorHandler.handleAuthError(error, context);
      
      expect(result).toEqual({
        success: false,
        shouldRetry: false,
        error: 'Session expired. Please re-authenticate.'
      });
      
      expect(clearAuthDataSpy).toHaveBeenCalled();
      expect(showNotificationSpy).toHaveBeenCalled();
      
      clearAuthDataSpy.mockRestore();
      showNotificationSpy.mockRestore();
    });

    it('should indicate retry for retryable auth errors', async () => {
      // Test the retry logic by using a custom error that's auth-related but not session invalid
      // We'll mock the isAuthError to return true and isSessionInvalidError to return false
      const error = new Error('Custom auth error');
      const context = { operation: 'test', timestamp: new Date().toISOString() };
      const retryCallback = vi.fn();
      
      // Mock the methods to simulate a retryable auth error
      const isAuthErrorSpy = vi.spyOn(AuthErrorHandler, 'isAuthError').mockReturnValue(true);
      const isSessionInvalidErrorSpy = vi.spyOn(AuthErrorHandler, 'isSessionInvalidError').mockReturnValue(false);
      
      const result = await AuthErrorHandler.handleAuthError(error, context, retryCallback);
      
      expect(result).toEqual({
        success: false,
        shouldRetry: true,
        error: 'Authentication error, retrying...'
      });
      
      isAuthErrorSpy.mockRestore();
      isSessionInvalidErrorSpy.mockRestore();
    });

    it('should not retry when no callback provided', async () => {
      const error = new Error('Network error');
      const context = { operation: 'test', timestamp: new Date().toISOString() };
      
      const result = await AuthErrorHandler.handleAuthError(error, context);
      
      expect(result).toEqual({
        success: false,
        shouldRetry: false,
        error: 'Network error. Please check your connection and try again.'
      });
    });
  });

  describe('safeAuthOperation', () => {
    it('should return success when operation succeeds', async () => {
      const operation = vi.fn().mockResolvedValue('test data');
      const context = { operation: 'test', timestamp: new Date().toISOString() };
      
      const result = await AuthErrorHandler.safeAuthOperation(operation, context);
      
      expect(result).toEqual({
        success: true,
        data: 'test data'
      });
    });

    it('should handle operation failure with retry', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('test data');
      const context = { operation: 'test', timestamp: new Date().toISOString() };
      
      const result = await AuthErrorHandler.safeAuthOperation(operation, context, { maxRetries: 2 });
      
      expect(result).toEqual({
        success: true,
        data: 'test data'
      });
    });

    it('should clear session on invalid session error', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Invalid Refresh Token: Already Used'));
      const context = { operation: 'test', timestamp: new Date().toISOString() };
      
      const clearAuthDataSpy = vi.spyOn(AuthErrorHandler, 'clearAuthData').mockResolvedValue();
      
      const result = await AuthErrorHandler.safeAuthOperation(operation, context, { clearSessionOnError: true });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session expired. Please re-authenticate.');
      expect(clearAuthDataSpy).toHaveBeenCalled();
      
      clearAuthDataSpy.mockRestore();
    });
  });
});

describe('withAuthErrorHandling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should wrap operation with error handling', async () => {
    const operation = vi.fn().mockResolvedValue('success');
    
    const result = await withAuthErrorHandling(operation, 'test_operation');
    
    expect(result).toEqual({
      success: true,
      data: 'success'
    });
  });

  it('should handle operation errors', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Test error'));
    
    const result = await withAuthErrorHandling(operation, 'test_operation');
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should use custom options', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Test error'));
    
    const result = await withAuthErrorHandling(operation, 'test_operation', { maxRetries: 2 });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
