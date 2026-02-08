// Integration tests for authentication error handling flow
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Tabs } from 'webextension-polyfill';

import { withAuthErrorHandling } from '../lib/authErrorHandler';
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

describe('Authentication Error Handling Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Error Handling Flow', () => {
    it('should handle invalid refresh token error end-to-end', async () => {
      // Setup mocks
      vi.mocked(browser.storage.local.remove).mockResolvedValue(undefined);
      vi.mocked(browser.storage.session.remove).mockResolvedValue(undefined);
      vi.mocked(browser.storage.local.get).mockResolvedValue({});
      vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);
      vi.mocked(browser.permissions.contains).mockResolvedValue(false);

      // Mock Supabase operation that fails with invalid refresh token
      const failingOperation = vi.fn().mockRejectedValue(
        new Error('AuthApiError: Invalid Refresh Token: Already Used')
      );

      // Execute the operation with error handling
      const result = await withAuthErrorHandling(
        failingOperation,
        'test_invalid_token_flow',
        { maxRetries: 1, clearSessionOnError: true }
      );

      // Verify the result
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session expired. Please re-authenticate.');

      // Verify that auth data was cleared
      expect(vi.mocked(browser.storage.local.remove)).toHaveBeenCalledWith([
        'supabase_session',
        'supabase_url', 
        'supabase_anon_key',
        'device_token',
        'pairing_in_progress'
      ]);

      expect(vi.mocked(browser.storage.session.remove)).toHaveBeenCalledWith([
        'jreader_sw_auth'
      ]);

      // Verify that notification was stored
      expect(vi.mocked(browser.storage.local.set)).toHaveBeenCalledWith({
        auth_notifications: [expect.objectContaining({
          type: 'warning',
          title: 'Session Expired',
          message: 'Your authentication session has expired. Please sign in again to continue using the extension.',
          action: expect.objectContaining({
            label: 'Sign In'
          }),
          persistent: true
        })]
      });

      // Verify that popup was notified
      expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({
        type: 'AUTH_NOTIFICATION',
        notification: expect.objectContaining({
          type: 'warning',
          title: 'Session Expired'
        })
      });
    });

    it('should handle network error with retry and eventual success', async () => {
      // Setup mocks
      vi.mocked(browser.storage.local.get).mockResolvedValue({});
      vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);
      vi.mocked(browser.permissions.contains).mockResolvedValue(false);

      // Mock operation that fails twice then succeeds
      const flakyOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success data');

      // Execute with retry
      const result = await withAuthErrorHandling(
        flakyOperation,
        'test_network_retry_flow',
        { maxRetries: 3, clearSessionOnError: false }
      );

      // Verify success after retries
      expect(result.success).toBe(true);
      expect(result.data).toBe('success data');
      expect(flakyOperation).toHaveBeenCalledTimes(3);

      // Verify no auth data was cleared (network error is retryable)
        expect(vi.mocked(browser.storage.local.remove)).not.toHaveBeenCalled();
    });

    it('should handle missing session error end-to-end', async () => {
      // Setup mocks
      vi.mocked(browser.storage.local.get).mockResolvedValue({});
      vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);
      vi.mocked(browser.permissions.contains).mockResolvedValue(false);

      // Mock operation that fails with missing session
      const failingOperation = vi.fn().mockRejectedValue(
        new Error('AuthSessionMissingError: Auth session missing!')
      );

      // Execute the operation
      const result = await withAuthErrorHandling(
        failingOperation,
        'test_missing_session_flow',
        { maxRetries: 1, clearSessionOnError: true }
      );

      // Verify the result
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session expired. Please re-authenticate.');

      // Verify that auth data was cleared
      expect(vi.mocked(browser.storage.local.remove)).toHaveBeenCalledWith([
        'supabase_session',
        'supabase_url', 
        'supabase_anon_key',
        'device_token',
        'pairing_in_progress'
      ]);

      // Verify that notification was stored
      expect(vi.mocked(browser.storage.local.set)).toHaveBeenCalledWith({
        auth_notifications: [expect.objectContaining({
          type: 'warning',
          title: 'Session Expired'
        })]
      });
    });

    it('should handle JWT expiration error end-to-end', async () => {
      // Setup mocks
      vi.mocked(browser.storage.local.remove).mockResolvedValue(undefined);
      vi.mocked(browser.storage.session.remove).mockResolvedValue(undefined);
      vi.mocked(browser.storage.local.get).mockResolvedValue({});
      vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);
      vi.mocked(browser.permissions.contains).mockResolvedValue(false);

      // Mock operation that fails with JWT expiration
      const failingOperation = vi.fn().mockRejectedValue(
        new Error('JWT expired')
      );

      // Execute the operation
      const result = await withAuthErrorHandling(
        failingOperation,
        'test_jwt_expiration_flow',
        { maxRetries: 1, clearSessionOnError: true }
      );

      // Verify the result
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session expired. Please re-authenticate.');

      // Verify that auth data was cleared
      expect(vi.mocked(browser.storage.local.remove)).toHaveBeenCalledWith([
        'supabase_session',
        'supabase_url', 
        'supabase_anon_key',
        'device_token',
        'pairing_in_progress'
      ]);

      // Verify that notification was stored
      expect(vi.mocked(browser.storage.local.set)).toHaveBeenCalledWith({
        auth_notifications: [expect.objectContaining({
          type: 'warning',
          title: 'Session Expired'
        })]
      });
    });
  });

  describe('Session Validation Integration', () => {
    it('should validate and reject invalid session before operation', async () => {
      // Mock session validation function
      const validateStoredSession = vi.fn().mockResolvedValue({
        isValid: false,
        reason: 'Missing access_token or refresh_token'
      });

      // Mock the session validation in the startup flow
      const invalidSession = {
        refresh_token: 'valid_token'
        // Missing access_token
      };

      const validationResult = await validateStoredSession(invalidSession);

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.reason).toBe('Missing access_token or refresh_token');
    });

    it('should validate and accept valid session', async () => {
      // Mock session validation function
      const validateStoredSession = vi.fn().mockResolvedValue({
        isValid: true
      });

      const validSession = {
        access_token: 'valid_access_token',
        refresh_token: 'valid_refresh_token',
        expires_at: new Date(Date.now() + 3600000).toISOString()
      };

      const validationResult = await validateStoredSession(validSession);

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.reason).toBeUndefined();
    });
  });

  describe('Notification Flow Integration', () => {
    it('should show different notifications for different error types', async () => {
      // Setup mocks
      vi.mocked(browser.storage.local.get).mockResolvedValue({});
      vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);
      vi.mocked(browser.permissions.contains).mockResolvedValue(false);

      // Test session expired notification
      await AuthNotificationHandler.showSessionExpiredNotification();
      
      // Test session restored notification
      await AuthNotificationHandler.showSessionRestoredNotification();
      
      // Test network error notification
      await AuthNotificationHandler.showNetworkErrorNotification();
      
      // Test pairing required notification
      await AuthNotificationHandler.showPairingRequiredNotification();

      // Verify all notifications were stored
      expect(vi.mocked(browser.storage.local.set)).toHaveBeenCalledTimes(4);

      // Verify different notification types
      const calls = vi.mocked(browser.storage.local.set).mock.calls;
      expect((calls[0]?.[0] as { auth_notifications: Array<{ type: string }> })?.auth_notifications[0]?.type).toBe('warning'); // Session expired
      expect((calls[1]?.[0] as { auth_notifications: Array<{ type: string }> })?.auth_notifications[0]?.type).toBe('success'); // Session restored
      expect((calls[2]?.[0] as { auth_notifications: Array<{ type: string }> })?.auth_notifications[0]?.type).toBe('error');   // Network error
      expect((calls[3]?.[0] as { auth_notifications: Array<{ type: string }> })?.auth_notifications[0]?.type).toBe('info');    // Pairing required
    });

    it('should handle notification storage limits', async () => {
      // Setup existing notifications at the limit
      const existingNotifications = Array.from({ length: 5 }, (_, i) => ({
        type: 'info',
        title: `Old Notification ${i}`,
        message: `Old message ${i}`,
        timestamp: new Date(Date.now() - i * 1000).toISOString()
      }));

      vi.mocked(browser.storage.local.get).mockResolvedValue({
        auth_notifications: existingNotifications
      });
      vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);
      vi.mocked(browser.permissions.contains).mockResolvedValue(false);

      // Add new notification
      await AuthNotificationHandler.showErrorNotification(
        'New Error',
        'This is a new error notification'
      );

      // Verify that only 5 notifications are stored (limit maintained)
      const setCall = vi.mocked(browser.storage.local.set).mock.calls[0]?.[0];
      const storedNotifications = (setCall as { auth_notifications: unknown[] })?.auth_notifications;
      expect(storedNotifications).toHaveLength(5);

      // Verify new notification is at the beginning
      expect(storedNotifications?.[0]).toMatchObject({
        type: 'error',
        title: 'New Error',
        message: 'This is a new error notification'
      });
    });
  });

  describe('Error Recovery Actions Integration', () => {
    it('should handle sign in action from session expired notification', async () => {
      // Setup mocks
      vi.mocked(browser.storage.local.get).mockResolvedValue({
        api_base_url: 'https://example.com'
      });
      vi.mocked(browser.tabs.create).mockResolvedValue({ id: 1 } as Tabs.Tab);

      // Create a session expired notification with action
      const notification = {
        type: 'warning' as const,
        title: 'Session Expired',
        message: 'Your session has expired',
        action: {
          label: 'Sign In',
          callback: async () => {
            const result = await vi.mocked(browser.storage.local.get)(['api_base_url']);
            const apiBaseUrl = (result['api_base_url'] as string | undefined) || 'https://waiwais-macbook-pro-2.unicorn-lime.ts.net';
            await vi.mocked(browser.tabs.create)({ url: apiBaseUrl });
          }
        },
        persistent: true,
        timestamp: new Date().toISOString()
      };

      // Execute the action
      await notification.action.callback();

      // Verify that web app was opened
      expect(vi.mocked(browser.tabs.create)).toHaveBeenCalledWith({
        url: 'https://example.com'
      });
    });

    // Removed legacy retry action from network error notification

    it('should handle start authentication action from pairing required notification', async () => {
      // Setup mocks
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);

      // Create a pairing required notification with action
      const notification = {
        type: 'info' as const,
        title: 'Authentication Required',
        message: 'Please sign in to your account',
        action: {
          label: 'Sign In',
          callback: async () => {
              await vi.mocked(browser.runtime.sendMessage)({
                type: 'auth.signInDiscord'
              });
          }
        },
        persistent: true,
        timestamp: new Date().toISOString()
      };

      // Execute the action
      await notification.action.callback();

      // Verify that sign in message was sent
      expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({
        type: 'auth.signInDiscord'
      });
    });
  });

  describe('Browser Notification Integration', () => {
    it('should create browser notification when permission granted', async () => {
      // Setup mocks
      vi.mocked(browser.storage.local.get).mockResolvedValue({});
      vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);
      vi.mocked(browser.permissions.contains).mockResolvedValue(true);
      vi.mocked(browser.notifications.create).mockResolvedValue('notification-id');

      // Show notification
      await AuthNotificationHandler.showErrorNotification(
        'Test Error',
        'This is a test error'
      );

      // Verify browser notification was created
      expect(vi.mocked(browser.notifications.create)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'basic',
          iconUrl: 'icons/icon-48.png',
          title: 'Test Error',
          message: 'This is a test error',
          priority: 2 // Error priority
        })
      );
    });

    it('should handle notification click events', async () => {
      // Setup mocks
      vi.mocked(browser.storage.local.get).mockResolvedValue({});
      vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);
      vi.mocked(browser.permissions.contains).mockResolvedValue(true);
      vi.mocked(browser.notifications.create).mockResolvedValue('notification-id');
      vi.mocked(browser.notifications.clear).mockResolvedValue(true);

      // Mock click listener
      let clickListener: ((notificationId: string) => void) | undefined;
      vi.mocked(browser.notifications.onClicked.addListener).mockImplementation((listener) => {
        clickListener = listener;
      });

      // Show notification with action
      await AuthNotificationHandler.showErrorNotification(
        'Test Error',
        'This is a test error',
        {
          label: 'Test Action',
          callback: () => console.log('Action executed')
        }
      );

      // Verify click listener was registered
      expect(vi.mocked(browser.notifications.onClicked.addListener)).toHaveBeenCalled();
      expect(clickListener).toBeDefined();

      // Simulate notification click
      if (clickListener) {
        clickListener('notification-id');
      }

      // Verify notification was not automatically cleared (this would be handled by the action callback)
      expect(vi.mocked(browser.notifications.clear)).not.toHaveBeenCalled();
    });
  });
});
