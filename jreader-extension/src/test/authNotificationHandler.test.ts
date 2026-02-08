// Unit tests for authentication notification handling
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { AuthNotificationHandler } from '../lib/authNotificationHandler';

import { browser } from '@/lib/browser';

// Mock the browser module
vi.mock('@/lib/browser', () => ({
  browser: {
    storage: {
      local: {
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

describe('AuthNotificationHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('showNotification', () => {
    it('should store notification in browser storage', async () => {
      vi.mocked(browser.storage.local.get).mockResolvedValue({});
      vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);
      vi.mocked(browser.permissions.contains).mockResolvedValue(false);

      const notification = {
        type: 'error' as const,
        title: 'Test Error',
        message: 'This is a test error message',
        persistent: false
      };

      await AuthNotificationHandler.showNotification(notification);

      expect(browser.storage.local.set).toHaveBeenCalledWith({
        auth_notifications: [expect.objectContaining({
          type: 'error',
          title: 'Test Error',
          message: 'This is a test error message',
          persistent: false,
          timestamp: expect.any(String)
        })]
      });
    });

    it('should send notification to popup', async () => {
      vi.mocked(browser.storage.local.get).mockResolvedValue({});
      vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);
      vi.mocked(browser.permissions.contains).mockResolvedValue(false);

      const notification = {
        type: 'info' as const,
        title: 'Test Info',
        message: 'This is a test info message'
      };

      await AuthNotificationHandler.showNotification(notification);

      expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({
        type: 'AUTH_NOTIFICATION',
        notification: expect.objectContaining({
          type: 'info',
          title: 'Test Info',
          message: 'This is a test info message',
          timestamp: expect.any(String)
        })
      });
    });

    it('should create browser notification when permission granted', async () => {
      vi.mocked(browser.storage.local.get).mockResolvedValue({});
      vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);
      vi.mocked(browser.permissions.contains).mockResolvedValue(true);
      vi.mocked(browser.notifications.create).mockResolvedValue('notification-id');

      const notification = {
        type: 'warning' as const,
        title: 'Test Warning',
        message: 'This is a test warning message'
      };

      await AuthNotificationHandler.showNotification(notification);

      expect(vi.mocked(browser.notifications.create)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'basic',
          iconUrl: 'icons/icon-48.png',
          title: 'Test Warning',
          message: 'This is a test warning message',
          priority: 1
        })
      );
    });

    it('should not create browser notification when permission denied', async () => {
      vi.mocked(browser.storage.local.get).mockResolvedValue({});
      vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);
      vi.mocked(browser.permissions.contains).mockResolvedValue(false);

      const notification = {
        type: 'error' as const,
        title: 'Test Error',
        message: 'This is a test error message'
      };

      await AuthNotificationHandler.showNotification(notification);

        expect(vi.mocked(browser.notifications.create)).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(browser.storage.local.get).mockRejectedValue(new Error('Storage error'));

      const notification = {
        type: 'error' as const,
        title: 'Test Error',
        message: 'This is a test error message'
      };

      await AuthNotificationHandler.showNotification(notification);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error storing notification:', expect.any(Error));
    });
  });

  describe('showSessionExpiredNotification', () => {
    it('should show session expired notification with sign in action', async () => {
      vi.mocked(browser.storage.local.get).mockResolvedValue({});
      vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);
      vi.mocked(browser.permissions.contains).mockResolvedValue(false);

      await AuthNotificationHandler.showSessionExpiredNotification();

      expect(browser.storage.local.set).toHaveBeenCalledWith({
        auth_notifications: [expect.objectContaining({
          type: 'warning',
          title: 'Session Expired',
          message: 'Your authentication session has expired. Please sign in again to continue using the extension.',
          action: expect.objectContaining({
            label: 'Sign In',
            callback: expect.any(Function)
          }),
          persistent: true
        })]
      });
    });
  });

  describe('showSessionRestoredNotification', () => {
    it('should show session restored notification', async () => {
      vi.mocked(browser.storage.local.get).mockResolvedValue({});
      vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);
      vi.mocked(browser.permissions.contains).mockResolvedValue(false);

      await AuthNotificationHandler.showSessionRestoredNotification();

      expect(browser.storage.local.set).toHaveBeenCalledWith({
        auth_notifications: [expect.objectContaining({
          type: 'success',
          title: 'Session Restored',
          message: 'Your authentication session has been successfully restored.',
          persistent: false
        })]
      });
    });
  });

  describe('showNetworkErrorNotification', () => {
    it('should show network error notification', async () => {
      vi.mocked(browser.storage.local.get).mockResolvedValue({});
      vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);
      vi.mocked(browser.permissions.contains).mockResolvedValue(false);

      await AuthNotificationHandler.showNetworkErrorNotification();

      expect(browser.storage.local.set).toHaveBeenCalledWith({
        auth_notifications: [expect.objectContaining({
          type: 'error',
          title: 'Connection Error',
          message: 'Unable to connect to the server. Please check your internet connection and try again.',
          persistent: false
        })]
      });
    });
  });

  describe('showPairingRequiredNotification', () => {
    it('should show pairing required notification with start pairing action', async () => {
      vi.mocked(browser.storage.local.get).mockResolvedValue({});
      vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);
      vi.mocked(browser.permissions.contains).mockResolvedValue(false);

      await AuthNotificationHandler.showPairingRequiredNotification();

      expect(browser.storage.local.set).toHaveBeenCalledWith({
        auth_notifications: [expect.objectContaining({
          type: 'info',
          title: 'Pairing Required',
          message: 'Please pair your extension with your account to sync cards and access your data.',
          action: expect.objectContaining({
            label: 'Start Pairing',
            callback: expect.any(Function)
          }),
          persistent: true
        })]
      });
    });
  });

  describe('getStoredNotifications', () => {
    it('should return stored notifications', async () => {
      const mockNotifications = [
        {
          type: 'error',
          title: 'Test Error',
          message: 'Test message',
          timestamp: '2023-01-01T00:00:00.000Z'
        }
      ];

      vi.mocked(browser.storage.local.get).mockResolvedValue({
        auth_notifications: mockNotifications
      });

      const result = await AuthNotificationHandler.getStoredNotifications();

      expect(result).toEqual(mockNotifications);
        expect(vi.mocked(browser.storage.local.get)).toHaveBeenCalledWith(['auth_notifications']);
    });

    it('should return empty array when no notifications stored', async () => {
      vi.mocked(browser.storage.local.get).mockResolvedValue({});

      const result = await AuthNotificationHandler.getStoredNotifications();

      expect(result).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(browser.storage.local.get).mockRejectedValue(new Error('Storage error'));

      const result = await AuthNotificationHandler.getStoredNotifications();

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error getting stored notifications:', expect.any(Error));
    });
  });

  describe('clearStoredNotifications', () => {
    it('should clear stored notifications', async () => {
      vi.mocked(browser.storage.local.remove).mockResolvedValue(undefined);

      await AuthNotificationHandler.clearStoredNotifications();

        expect(vi.mocked(browser.storage.local.remove)).toHaveBeenCalledWith(['auth_notifications']);
    });

    it('should handle errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(browser.storage.local.remove).mockRejectedValue(new Error('Storage error'));

      await AuthNotificationHandler.clearStoredNotifications();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error clearing stored notifications:', expect.any(Error));
    });
  });

  describe('showErrorNotification', () => {
    it('should show error notification with custom message', async () => {
      vi.mocked(browser.storage.local.get).mockResolvedValue({});
      vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);
      vi.mocked(browser.permissions.contains).mockResolvedValue(false);

      await AuthNotificationHandler.showErrorNotification(
        'Custom Error',
        'This is a custom error message',
        {
          label: 'Custom Action',
          callback: () => console.log('Custom action')
        }
      );

      expect(browser.storage.local.set).toHaveBeenCalledWith({
        auth_notifications: [expect.objectContaining({
          type: 'error',
          title: 'Custom Error',
          message: 'This is a custom error message',
          action: expect.objectContaining({
            label: 'Custom Action',
            callback: expect.any(Function)
          }),
          persistent: false
        })]
      });
    });
  });

  describe('showSuccessNotification', () => {
    it('should show success notification', async () => {
      vi.mocked(browser.storage.local.get).mockResolvedValue({});
      vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);
      vi.mocked(browser.permissions.contains).mockResolvedValue(false);

      await AuthNotificationHandler.showSuccessNotification(
        'Success Title',
        'This is a success message'
      );

      expect(browser.storage.local.set).toHaveBeenCalledWith({
        auth_notifications: [expect.objectContaining({
          type: 'success',
          title: 'Success Title',
          message: 'This is a success message',
          persistent: false
        })]
      });
    });
  });

  describe('showInfoNotification', () => {
    it('should show info notification with action', async () => {
      vi.mocked(browser.storage.local.get).mockResolvedValue({});
      vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);
      vi.mocked(browser.permissions.contains).mockResolvedValue(false);

      await AuthNotificationHandler.showInfoNotification(
        'Info Title',
        'This is an info message',
        {
          label: 'Info Action',
          callback: () => console.log('Info action')
        }
      );

      expect(browser.storage.local.set).toHaveBeenCalledWith({
        auth_notifications: [expect.objectContaining({
          type: 'info',
          title: 'Info Title',
          message: 'This is an info message',
          action: expect.objectContaining({
            label: 'Info Action',
            callback: expect.any(Function)
          }),
          persistent: false
        })]
      });
    });
  });

  describe('notification storage management', () => {
    it('should limit stored notifications to MAX_NOTIFICATIONS', async () => {
      const existingNotifications = Array.from({ length: 5 }, (_, i) => ({
        type: 'info',
        title: `Notification ${i}`,
        message: `Message ${i}`,
        timestamp: new Date(Date.now() - i * 1000).toISOString()
      }));

      vi.mocked(browser.storage.local.get).mockResolvedValue({
        auth_notifications: existingNotifications
      });
      vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);
      vi.mocked(browser.permissions.contains).mockResolvedValue(false);

      const newNotification = {
        type: 'error' as const,
        title: 'New Notification',
        message: 'This is a new notification'
      };

      await AuthNotificationHandler.showNotification(newNotification);

      // Should have 5 notifications (MAX_NOTIFICATIONS)
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        auth_notifications: expect.arrayContaining([
          expect.objectContaining({
            type: 'error',
            title: 'New Notification',
            message: 'This is a new notification'
          })
        ])
      });

        const storedNotifications = vi.mocked(browser.storage.local.set).mock.calls[0]?.[0]?.['auth_notifications'];
      expect(storedNotifications).toHaveLength(5);
    });

    it('should add new notification at the beginning of the array', async () => {
      const existingNotifications = [
        {
          type: 'info',
          title: 'Old Notification',
          message: 'This is an old notification',
          timestamp: '2023-01-01T00:00:00.000Z'
        }
      ];

      vi.mocked(browser.storage.local.get).mockResolvedValue({
        auth_notifications: existingNotifications
      });
      vi.mocked(browser.storage.local.set).mockResolvedValue(undefined);
      vi.mocked(browser.runtime.sendMessage).mockResolvedValue(undefined);
      vi.mocked(browser.permissions.contains).mockResolvedValue(false);

      const newNotification = {
        type: 'error' as const,
        title: 'New Notification',
        message: 'This is a new notification'
      };

      await AuthNotificationHandler.showNotification(newNotification);

      const setCall = vi.mocked(browser.storage.local.set).mock.calls[0]?.[0];
      const storedNotifications = (setCall as { auth_notifications: unknown[] })?.auth_notifications;
      expect(storedNotifications?.[0]).toMatchObject({
        type: 'error',
        title: 'New Notification',
        message: 'This is a new notification'
      });
    });
  });
});
