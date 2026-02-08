// User notification system for authentication errors and recovery actions
import { browser } from '@/lib/browser';
import { SW_EVENT_AUTH_SIGN_IN_DISCORD } from '@/lib/constants';

export interface AuthNotification {
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  action?: {
    label: string;
    callback: () => void;
  };
  persistent?: boolean;
  timestamp: string;
}

export class AuthNotificationHandler {
  private static readonly STORAGE_KEY = 'auth_notifications';
  private static readonly MAX_NOTIFICATIONS = 5;

  /**
   * Shows a notification to the user about authentication status
   */
  static async showNotification(notification: Omit<AuthNotification, 'timestamp'>): Promise<void> {
    const fullNotification: AuthNotification = {
      ...notification,
      timestamp: new Date().toISOString()
    };

    try {
      // Store notification for persistence
      await this.storeNotification(fullNotification);

      // Send notification to popup if it's open
      await this.sendToPopup(fullNotification);

      // Show browser notification if permission is granted
      await this.showBrowserNotification(fullNotification);

      console.log(`🔔 Auth notification: ${notification.type.toUpperCase()} - ${notification.title}`);
    } catch (error) {
      console.error('Error showing auth notification:', error);
    }
  }

  /**
   * Shows a session expired notification with re-authentication option
   */
  static async showSessionExpiredNotification(): Promise<void> {
    await this.showNotification({
      type: 'warning',
      title: 'Session Expired',
      message: 'Your authentication session has expired. Please sign in again to continue using the extension.',
      action: {
        label: 'Sign In',
        callback: () => {
          // Open the web app for re-authentication
          void this.openWebAppForAuth();
        }
      },
      persistent: true
    });
  }

  /**
   * Shows a session restored notification
   */
  static async showSessionRestoredNotification(): Promise<void> {
    await this.showNotification({
      type: 'success',
      title: 'Session Restored',
      message: 'Your authentication session has been successfully restored.',
      persistent: false
    });
  }

  /**
   * Shows a network error notification
   */
  static async showNetworkErrorNotification(): Promise<void> {
    await this.showNotification({
      type: 'error',
      title: 'Connection Error',
      message: 'Unable to connect to the server. Please check your internet connection and try again.',
      // Removed legacy Retry action; instruct user to try again manually
      persistent: false
    });
  }

  /**
   * Shows a pairing required notification
   */
  static async showPairingRequiredNotification(): Promise<void> {
    await this.showNotification({
      type: 'info',
      title: 'Pairing Required',
      message: 'Please pair your extension with your account to sync cards and access your data.',
      action: {
        label: 'Start Pairing',
        callback: () => {
          void this.startPairingProcess();
        }
      },
      persistent: true
    });
  }

  /**
   * Stores notification in browser storage for persistence
   */
  private static async storeNotification(notification: AuthNotification): Promise<void> {
    try {
      const result = await browser.storage.local.get([this.STORAGE_KEY]);
      const notifications: AuthNotification[] = (result[this.STORAGE_KEY] as AuthNotification[] | undefined) || [];

      // Add new notification at the beginning
      notifications.unshift(notification);

      // Keep only the most recent notifications
      const trimmedNotifications = notifications.slice(0, this.MAX_NOTIFICATIONS);

      await browser.storage.local.set({
        [this.STORAGE_KEY]: trimmedNotifications
      });
    } catch (error) {
      console.error('Error storing notification:', error);
    }
  }

  /**
   * Sends notification to popup if it's open
   */
  private static async sendToPopup(notification: AuthNotification): Promise<void> {
    try {
      // Try to send message to popup
      await browser.runtime.sendMessage({
        type: 'AUTH_NOTIFICATION',
        notification
      });
    } catch (error) {
      // Popup might not be open, that's okay
      console.log(`Could not send notification to popup (popup may be closed), error=${JSON.stringify(error)}`);
    }
  }

  /**
   * Shows browser notification if permission is granted
   */
  private static async showBrowserNotification(notification: AuthNotification): Promise<void> {
    try {
      // Check if we have permission to show notifications
      const permission = await browser.permissions.contains({
        permissions: ['notifications']
      });

      if (!permission) {
        console.log('No notification permission, skipping browser notification');
        return;
      }

      // Create browser notification
      const notificationId = `auth_${Date.now()}`;

      await browser.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: 'icons/icon-48.png', // Adjust path as needed
        title: notification.title,
        message: notification.message,
        priority: notification.type === 'error' ? 2 : 1
      });

      // Handle notification click
      browser.notifications.onClicked.addListener((clickedNotificationId) => {
        if (clickedNotificationId === notificationId && notification.action) {
          notification.action.callback();
          void browser.notifications.clear(clickedNotificationId);
        }
      });

      // Auto-clear non-persistent notifications after 5 seconds
      if (!notification.persistent) {
        setTimeout(() => {
          void browser.notifications.clear(notificationId);
        }, 5000);
      }
    } catch (error) {
      console.error('Error showing browser notification:', error);
    }
  }

  /**
   * Gets stored notifications
   */
  static async getStoredNotifications(): Promise<AuthNotification[]> {
    try {
      const result = await browser.storage.local.get([this.STORAGE_KEY]);
      return (result[this.STORAGE_KEY] as AuthNotification[] | undefined) || [];
    } catch (error) {
      console.error('Error getting stored notifications:', error);
      return [];
    }
  }

  /**
   * Clears stored notifications
   */
  static async clearStoredNotifications(): Promise<void> {
    try {
      await browser.storage.local.remove([this.STORAGE_KEY]);
    } catch (error) {
      console.error('Error clearing stored notifications:', error);
    }
  }

  /**
   * Opens the web app for authentication
   */
  private static async openWebAppForAuth(): Promise<void> {
    try {
      // Get the API base URL from storage
      const result = await browser.storage.local.get(['api_base_url']);
      const apiBaseUrl = (result['api_base_url'] as string | undefined) || 'https://waiwais-macbook-pro-2.unicorn-lime.ts.net';

      // Open the web app
      await browser.tabs.create({
        url: apiBaseUrl
      });
    } catch (error) {
      console.error('Error opening web app for auth:', error);
    }
  }

  /**
   * Starts the authentication process
   */
  private static async startPairingProcess(): Promise<void> {
    try {
      // Send message to background script to start Discord authentication
      await browser.runtime.sendMessage({
        type: SW_EVENT_AUTH_SIGN_IN_DISCORD
      });
    } catch (error) {
      console.error('Error starting authentication process:', error);
    }
  }

  // Removed legacy retryLastOperation; no background retry message is supported

  /**
   * Shows a generic error notification
   */
  static async showErrorNotification(title: string, message: string, action?: { label: string; callback: () => void }): Promise<void> {
    // Use conditional spread to only include 'action' if defined
    // This satisfies exactOptionalPropertyTypes by not setting action: undefined
    await this.showNotification({
      type: 'error',
      title,
      message,
      ...(action && { action }),
      persistent: false
    });
  }

  /**
   * Shows a generic success notification
   */
  static async showSuccessNotification(title: string, message: string): Promise<void> {
    await this.showNotification({
      type: 'success',
      title,
      message,
      persistent: false
    });
  }

  /**
   * Shows a generic info notification
   */
  static async showInfoNotification(title: string, message: string, action?: { label: string; callback: () => void }): Promise<void> {
    // Use conditional spread to only include 'action' if defined
    // This satisfies exactOptionalPropertyTypes by not setting action: undefined
    await this.showNotification({
      type: 'info',
      title,
      message,
      ...(action && { action }),
      persistent: false
    });
  }
}
