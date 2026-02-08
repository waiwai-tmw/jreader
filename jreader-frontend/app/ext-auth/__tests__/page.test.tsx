/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { useSearchParams, useRouter } from 'next/navigation';

import ExtAuthPage from '../page';

import { ExtensionProvider } from '@/contexts/ExtensionContext';
import { createClient } from '@/utils/supabase/client';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

// Mock Supabase client
jest.mock('@/utils/supabase/client', () => ({
  createClient: jest.fn(),
}));

// Mock window.postMessage
const mockPostMessage = jest.fn();
Object.defineProperty(window, 'postMessage', {
  value: mockPostMessage,
  writable: true,
});

// Mock fetch
global.fetch = jest.fn();

// Helper function to render with ExtensionProvider
const renderWithExtensionProvider = (component: React.ReactElement) => {
  return render(
    <ExtensionProvider>
      {component}
    </ExtensionProvider>
  );
};

// Mock window.location
const mockReload = jest.fn();
// @ts-ignore
delete window.location;
// @ts-ignore
window.location = {
  reload: mockReload,
  href: 'http://localhost:3000',
  origin: 'http://localhost:3000',
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('ExtAuthPage', () => {
  const mockPush = jest.fn();
  const mockSupabaseClient = {
    auth: {
      getSession: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);
    (global.fetch as jest.Mock).mockClear();
    mockPostMessage.mockClear();
  });

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('test-nonce-123'),
      });

      renderWithExtensionProvider(<ExtAuthPage />);

      expect(screen.getByText('Completing device pairing...')).toBeInTheDocument();
      // Check for the loading spinner by its class instead of role
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('Error Handling - No Nonce', () => {
    it('should show error when no nonce is provided', async () => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue(null),
      });

      renderWithExtensionProvider(<ExtAuthPage />);

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText('No nonce provided')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling - Authentication', () => {
    it('should show auth error when user is not logged in', async () => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('test-nonce-123'),
      });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      renderWithExtensionProvider(<ExtAuthPage />);

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText('You must be logged in to pair your device. Please log in first.')).toBeInTheDocument();
        expect(screen.getByText('You need to be logged in to pair your device with JReader.')).toBeInTheDocument();
        expect(screen.getByText('Log In & Continue Pairing')).toBeInTheDocument();
      });
    });

    it('should redirect to login with correct URL when auth error occurs', async () => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('test-nonce-123'),
      });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      renderWithExtensionProvider(<ExtAuthPage />);

      await waitFor(() => {
        expect(screen.getByText('Log In & Continue Pairing')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Log In & Continue Pairing'));

      expect(mockPush).toHaveBeenCalledWith('/login?redirect=%2F%3Fnonce%3Dtest-nonce-123');
    });
  });

  describe('Error Handling - Session Error', () => {
    it('should show general error when session fetch fails', async () => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('test-nonce-123'),
      });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Session fetch failed'),
      });

      renderWithExtensionProvider(<ExtAuthPage />);

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText('Failed to get user session')).toBeInTheDocument();
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling - Network Errors', () => {
    it('should show network error when fetch fails', async () => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('test-nonce-123'),
      });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null,
      });

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Failed to fetch'));

      renderWithExtensionProvider(<ExtAuthPage />);

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText('Network error - server may be unreachable or URL is incorrect')).toBeInTheDocument();
        expect(screen.getByText('There was a network issue. Please check your connection and try again.')).toBeInTheDocument();
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });

    it('should show timeout error when request times out', async () => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('test-nonce-123'),
      });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null,
      });

      const abortError = new Error('Request timed out');
      abortError.name = 'AbortError';
      (global.fetch as jest.Mock).mockRejectedValue(abortError);

      renderWithExtensionProvider(<ExtAuthPage />);

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText('Request timed out - server may be unreachable')).toBeInTheDocument();
        expect(screen.getByText('There was a network issue. Please check your connection and try again.')).toBeInTheDocument();
      });
    });
  });

  describe('Success Flow', () => {
    it('should show success when pairing completes successfully', async () => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('test-nonce-123'),
      });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null,
      });

      const mockSessionData = {
        type: 'SET_SUPABASE_SESSION',
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_at: 1234567890,
        supabase_url: 'https://test.supabase.co',
        supabase_anon_key: 'anon-key',
      };

      // Mock fetch with proper headers
      const mockHeaders = new Map();
      mockHeaders.set('content-type', 'application/json');
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: mockHeaders,
        json: async () => ({ ok: true, session_data: mockSessionData }),
      });

      await act(async () => {
        renderWithExtensionProvider(<ExtAuthPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Success!')).toBeInTheDocument();
        expect(screen.getByText('Device paired successfully! You can close this tab manually.')).toBeInTheDocument();
      });

      // Verify postMessage was called with nonce first
      expect(mockPostMessage).toHaveBeenCalledWith(
        {
          type: 'PAIR_NONCE',
          nonce: 'test-nonce-123',
        },
        window.location.origin
      );

      // Verify postMessage was called with session data after delay
      await waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalledWith(
          {
            type: 'SET_SUPABASE_SESSION',
            nonce: 'test-nonce-123',
            session: mockSessionData,
          },
          window.location.origin
        );
      }, { timeout: 200 });
    });

    it('should handle server error response', async () => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('test-nonce-123'),
      });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null,
      });

      // Mock fetch with proper headers
      const mockHeaders = new Map();
      mockHeaders.set('content-type', 'text/plain');
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: mockHeaders,
        text: async () => 'Server error',
      });

      await act(async () => {
        renderWithExtensionProvider(<ExtAuthPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText('Complete request failed: 500 Internal Server Error - Server error')).toBeInTheDocument();
      });
    });
  });

  describe('Retry Functionality', () => {
    it('should show retry button for network errors', async () => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn().mockReturnValue('test-nonce-123'),
      });

      // Mock a network error to trigger the "Try Again" button
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null,
      });

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Failed to fetch'));

      renderWithExtensionProvider(<ExtAuthPage />);

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });

      // The retry button is present and clickable (functionality tested in other tests)
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

});
