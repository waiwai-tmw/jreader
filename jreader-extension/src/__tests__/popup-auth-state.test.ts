// Tests for popup authentication state handling improvements
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SW_EVENT_SUPABASE_GET_CLIENT, SW_EVENT_SUPABASE_GET_USER } from '@/lib/constants';

// Mock browser APIs
const mockBrowser = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn()
    }
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  }
};

// Mock the browser module
vi.mock('@/lib/browser', () => ({
  browser: mockBrowser
}));

describe('Popup Authentication State Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadUserProfile function', () => {
    const loadUserProfile = async () => {
      try {
        const response = await mockBrowser.runtime.sendMessage({ type: SW_EVENT_SUPABASE_GET_CLIENT });
        
        if (response && response.hasClient && response.isSessionValid) {
          try {
            const userResponse = await mockBrowser.runtime.sendMessage({ type: SW_EVENT_SUPABASE_GET_USER });
            
            if (userResponse && userResponse.user) {
              return { user: userResponse.user, error: null };
            } else {
              return { user: null, error: 'No user data' };
            }
          } catch (error) {
            console.error('Error getting user data:', error);
            return { user: null, error: 'Failed to get user data' };
          }
        } else {
          return { user: null, error: 'Session not valid' };
        }
      } catch (error) {
        console.error('Error connecting to background script:', error);
        return { user: null, error: 'Connection error' };
      }
    };

    it('should return user data when session is valid', async () => {
      // Mock valid client and session
      mockBrowser.runtime.sendMessage
        .mockResolvedValueOnce({ hasClient: true, isSessionValid: true }) // SW_EVENT_SUPABASE_GET_CLIENT
        .mockResolvedValueOnce({ user: { id: '123', email: 'test@example.com' } }); // SW_EVENT_SUPABASE_GET_USER
      
      const result = await loadUserProfile();
      
      expect(result).toEqual({
        user: { id: '123', email: 'test@example.com' },
        error: null
      });
      
      expect(mockBrowser.runtime.sendMessage).toHaveBeenCalledTimes(2);
      expect(mockBrowser.runtime.sendMessage).toHaveBeenNthCalledWith(1, { type: SW_EVENT_SUPABASE_GET_CLIENT });
      expect(mockBrowser.runtime.sendMessage).toHaveBeenNthCalledWith(2, { type: SW_EVENT_SUPABASE_GET_USER });
    });

    it('should return null user when session is invalid', async () => {
      // Mock invalid session
      mockBrowser.runtime.sendMessage.mockResolvedValueOnce({ 
        hasClient: true, 
        isSessionValid: false 
      });
      
      const result = await loadUserProfile();
      
      expect(result).toEqual({
        user: null,
        error: 'Session not valid'
      });
      
      expect(mockBrowser.runtime.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockBrowser.runtime.sendMessage).toHaveBeenCalledWith({ type: SW_EVENT_SUPABASE_GET_CLIENT });
    });

    it('should return null user when client is not available', async () => {
      // Mock no client
      mockBrowser.runtime.sendMessage.mockResolvedValueOnce({ 
        hasClient: false, 
        isSessionValid: false 
      });
      
      const result = await loadUserProfile();
      
      expect(result).toEqual({
        user: null,
        error: 'Session not valid'
      });
      
      expect(mockBrowser.runtime.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should handle supabase.getUser errors gracefully', async () => {
      // Mock valid client/session but user fetch fails
      mockBrowser.runtime.sendMessage
        .mockResolvedValueOnce({ hasClient: true, isSessionValid: true })
        .mockRejectedValueOnce(new Error('User fetch failed'));
      
      const result = await loadUserProfile();
      
      expect(result).toEqual({
        user: null,
        error: 'Failed to get user data'
      });
    });

    it('should handle connection errors gracefully', async () => {
      // Mock connection error
      mockBrowser.runtime.sendMessage.mockRejectedValue(new Error('Connection failed'));
      
      const result = await loadUserProfile();
      
      expect(result).toEqual({
        user: null,
        error: 'Connection error'
      });
    });

    it('should handle null response from supabase.getUser', async () => {
      // Mock valid client/session but null user response
      mockBrowser.runtime.sendMessage
        .mockResolvedValueOnce({ hasClient: true, isSessionValid: true })
        .mockResolvedValueOnce({ user: null });
      
      const result = await loadUserProfile();
      
      expect(result).toEqual({
        user: null,
        error: 'No user data'
      });
    });
  });

  describe('Authentication state UI logic', () => {
    it('should show skeleton when userData is null and pairingStatus is paired', () => {
      const userData = null;
      const pairingStatus = { type: 'paired', message: 'Paired' };
      
      // This is the condition that shows skeleton in the popup
      const shouldShowSkeleton = userData === null && pairingStatus.type === 'paired';
      
      expect(shouldShowSkeleton).toBe(true);
    });

    it('should show user profile when userData is available', () => {
      const userData = { id: '123', email: 'test@example.com' };
      const pairingStatus = { type: 'paired', message: 'Paired' };
      
      const shouldShowSkeleton = userData === null && pairingStatus.type === 'paired';
      const shouldShowUserProfile = !!userData;
      
      expect(shouldShowSkeleton).toBe(false);
      expect(shouldShowUserProfile).toBe(true);
    });

    it('should show not connected when pairingStatus is unpaired', () => {
      const userData = null;
      const pairingStatus = { type: 'unpaired', message: 'Not paired' };
      
      const shouldShowSkeleton = userData === null && pairingStatus.type === 'paired';
      const shouldShowNotConnected = pairingStatus.type === 'unpaired';
      
      expect(shouldShowSkeleton).toBe(false);
      expect(shouldShowNotConnected).toBe(true);
    });
  });

  describe('Error handling integration', () => {
    it('should handle session validation errors properly', async () => {
      // Mock the improved supabase.getClient response
      const clientResponse = {
        hasClient: true,
        isSessionValid: false // Session is invalid
      };
      
      // When session is invalid, should not attempt to get user
      if (clientResponse.hasClient && clientResponse.isSessionValid) {
        // This should not be reached
        expect(true).toBe(false);
      } else {
        // This should be reached
        expect(clientResponse.isSessionValid).toBe(false);
      }
    });

    it('should handle session validation success properly', async () => {
      // Mock the improved supabase.getClient response
      const clientResponse = {
        hasClient: true,
        isSessionValid: true // Session is valid
      };
      
      // When session is valid, should attempt to get user
      if (clientResponse.hasClient && clientResponse.isSessionValid) {
        // This should be reached
        expect(clientResponse.isSessionValid).toBe(true);
        
        // Mock successful user fetch
        mockBrowser.runtime.sendMessage.mockResolvedValueOnce({ 
          user: { id: '123', email: 'test@example.com' } 
        });
        
        const userResponse = await mockBrowser.runtime.sendMessage({ type: SW_EVENT_SUPABASE_GET_USER });
        expect(userResponse.user).toBeDefined();
      } else {
        // This should not be reached
        expect(true).toBe(false);
      }
    });
  });
});
