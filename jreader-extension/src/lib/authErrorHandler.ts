// Authentication error handling utilities for graceful error recovery
import { AuthNotificationHandler } from './authNotificationHandler';

import { browser } from '@/lib/browser';

export interface AuthError {
  message: string;
  code?: string;
  status?: number;
  originalError?: any;
}

/**
 * Type guard to check if an unknown error has error-like properties
 * JavaScript allows throwing any value, so we defensively check for expected properties
 */
function isErrorLike(error: unknown): error is { message?: string; code?: string; stack?: string; toString(): string } {
  return typeof error === 'object' && error !== null;
}

/**
 * Helper to safely extract error message from unknown error value
 */
function getErrorMessage(error: unknown): string {
  if (!error) return '';
  return isErrorLike(error) ? (error.message || error.toString()) : String(error);
}

/**
 * Helper to safely extract error code from unknown error value
 */
function getErrorCode(error: unknown): string {
  return isErrorLike(error) ? (error.code || '') : '';
}

/**
 * Helper to safely extract error stack from unknown error value
 */
function getErrorStack(error: unknown): string | undefined {
  return isErrorLike(error) ? error.stack : undefined;
}

export interface AuthErrorContext {
  operation: string;
  userId?: string;
  sessionId?: string;
  timestamp: string;
}

export class AuthErrorHandler {
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly RETRY_DELAY_MS = 1000;
  private static readonly INVALID_TOKEN_ERRORS = [
    'Invalid Refresh Token: Already Used',
    'AuthApiError: Invalid Refresh Token',
    'AuthSessionMissingError',
    'JWT expired',
    'Invalid JWT',
    'refresh_token_not_found'
  ];

  /**
   * Determines if an error is an authentication-related error that requires session cleanup
   * @param error - Uses `unknown` because JavaScript allows throwing any value, following Supabase's pattern
   */
  static isAuthError(error: unknown): boolean {
    if (!error) return false;

    const errorMessage = getErrorMessage(error);
    const errorCode = getErrorCode(error);

    return this.INVALID_TOKEN_ERRORS.some(invalidTokenError =>
      errorMessage.includes(invalidTokenError) ||
      errorCode.includes(invalidTokenError)
    );
  }

  /**
   * Determines if an error indicates the session is invalid and needs to be cleared
   * @param error - Uses `unknown` because JavaScript allows throwing any value, following Supabase's pattern
   */
  static isSessionInvalidError(error: unknown): boolean {
    if (!error) return false;

    const errorMessage = getErrorMessage(error);
    const errorCode = getErrorCode(error);

    const sessionInvalidPatterns = [
      'Invalid Refresh Token: Already Used',
      'AuthApiError: Invalid Refresh Token',
      'AuthSessionMissingError',
      'JWT expired',
      'Invalid JWT',
      'refresh_token_not_found',
      'invalid_grant'
    ];

    return sessionInvalidPatterns.some(pattern =>
      errorMessage.includes(pattern) ||
      errorCode.includes(pattern)
    );
  }

  /**
   * Clears all authentication-related data from storage
   */
  static async clearAuthData(): Promise<void> {
    try {
      console.log('🧹 Clearing authentication data due to invalid session');
      
      await browser.storage.local.remove([
        'supabase_session',
        'supabase_url', 
        'supabase_anon_key',
        'device_token',
        'pairing_in_progress'
      ]);
      
      // Also clear session storage
      await browser.storage.session.remove([
        'jreader_sw_auth'
      ]);
      
      console.log('✅ Authentication data cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing authentication data:', error);
    }
  }

  /**
   * Handles authentication errors with appropriate recovery actions
   * @param error - Uses `unknown` because JavaScript allows throwing any value, following Supabase's pattern
   */
  static async handleAuthError(
    error: unknown,
    context: AuthErrorContext,
    retryCallback?: () => Promise<any>
  ): Promise<{ success: boolean; shouldRetry: boolean; error?: string }> {
    console.error(`🚨 Auth error in ${context.operation}:`, {
      error: getErrorMessage(error),
      code: getErrorCode(error),
      context,
      timestamp: new Date().toISOString()
    });

    // If it's a session invalid error, clear auth data and show notification
    if (this.isSessionInvalidError(error)) {
      console.log('🔄 Session invalid, clearing auth data');
      await this.clearAuthData();
      
      // Show user-friendly notification
      await AuthNotificationHandler.showSessionExpiredNotification();
      
      return {
        success: false,
        shouldRetry: false,
        error: 'Session expired. Please re-authenticate.'
      };
    }

    // For other auth errors, determine if we should retry
    const shouldRetry = this.isAuthError(error) && retryCallback !== undefined;
    
    if (shouldRetry) {
      console.log('🔄 Auth error detected, will retry operation');
      return {
        success: false,
        shouldRetry: true,
        error: 'Authentication error, retrying...'
      };
    }

    return {
      success: false,
      shouldRetry: false,
      error: this.getUserFriendlyErrorMessage(error)
    };
  }

  /**
   * Retries an operation with exponential backoff
   */
  static async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxAttempts: number = this.MAX_RETRY_ATTEMPTS,
    baseDelay: number = this.RETRY_DELAY_MS
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // If it's a session invalid error, don't retry
        if (this.isSessionInvalidError(error)) {
          console.log(`❌ Session invalid on attempt ${attempt}, not retrying`);
          throw error;
        }
        
        if (attempt === maxAttempts) {
          console.log(`❌ Max retry attempts (${maxAttempts}) reached`);
          throw error;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`🔄 Retry attempt ${attempt}/${maxAttempts} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Safely executes an authentication operation with error handling
   */
  static async safeAuthOperation<T>(
    operation: () => Promise<T>,
    context: AuthErrorContext,
    options: {
      maxRetries?: number;
      clearSessionOnError?: boolean;
    } = {}
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    const { maxRetries = 1, clearSessionOnError = true } = options;
    
    try {
      const result = await this.retryWithBackoff(operation, maxRetries);
      return { success: true, data: result };
    } catch (error) {
      const errorResult = await this.handleAuthError(error, context);
      
      if (clearSessionOnError && this.isSessionInvalidError(error)) {
        await this.clearAuthData();
      }
      
      // Use conditional spread to only include 'error' property if it has a value
      // This satisfies exactOptionalPropertyTypes by not setting error: undefined
      return {
        success: false,
        ...(errorResult.error && { error: errorResult.error })
      };
    }
  }

  /**
   * Gets a user-friendly error message for display
   * @param error - Uses `unknown` because JavaScript allows throwing any value, following Supabase's pattern
   */
  static getUserFriendlyErrorMessage(error: unknown): string {
    if (!error) return 'An unknown error occurred';

    const errorMessage = getErrorMessage(error);
    
    // Map technical errors to user-friendly messages
    if (errorMessage.includes('Invalid Refresh Token: Already Used')) {
      return 'Your session has expired. Please sign in again.';
    }
    
    if (errorMessage.includes('AuthSessionMissingError')) {
      return 'You are not signed in. Please sign in to continue.';
    }
    
    if (errorMessage.includes('JWT expired') || errorMessage.includes('Invalid JWT')) {
      return 'Your session has expired. Please sign in again.';
    }
    
    if (errorMessage.includes('refresh_token_not_found')) {
      return 'Authentication session not found. Please sign in again.';
    }
    
    if (errorMessage.includes('Network')) {
      return 'Network error. Please check your connection and try again.';
    }
    
    // Default fallback
    return 'An authentication error occurred. Please try signing in again.';
  }

  /**
   * Logs authentication errors for debugging
   * @param error - Uses `unknown` because JavaScript allows throwing any value, following Supabase's pattern
   */
  static logAuthError(error: unknown, context: AuthErrorContext): void {
    const errorInfo = {
      message: getErrorMessage(error),
      code: getErrorCode(error),
      stack: getErrorStack(error),
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location?.href || 'service-worker'
    };
    
    console.error('🔍 Auth Error Details:', errorInfo);
    
    // In development, you might want to send this to a logging service
    if (process.env['NODE_ENV'] === 'development') {
      console.table(errorInfo);
    }
  }

  /**
   * Shows a success notification when authentication is restored
   */
  static async showAuthSuccessNotification(_operation: string): Promise<void> {
    await AuthNotificationHandler.showSessionRestoredNotification();
  }

  /**
   * Shows a network error notification
   */
  static async showNetworkErrorNotification(): Promise<void> {
    await AuthNotificationHandler.showNetworkErrorNotification();
  }
}

/**
 * Utility function to wrap Supabase operations with error handling
 */
export async function withAuthErrorHandling<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: {
    maxRetries?: number;
    clearSessionOnError?: boolean;
  } = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  const context: AuthErrorContext = {
    operation: operationName,
    timestamp: new Date().toISOString()
  };
  
  return AuthErrorHandler.safeAuthOperation(operation, context, options);
}
