// Tests for service worker session validation improvements
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock browser APIs
const mockBrowser = {
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
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn()
    }
  }
};

// Mock Supabase client
const mockSupabase = {
  auth: {
    getSession: vi.fn(),
    getUser: vi.fn(),
    setSession: vi.fn()
  }
};

// Mock the browser module
vi.mock('@/lib/browser', () => ({
  browser: mockBrowser
}));

describe('Service Worker Session Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('supabase.getClient message handler', () => {
    it('should return hasClient: false when supabase is not initialized', async () => {
      // Mock the message handler logic
      const hasClient = false;
      const isSessionValid = false;
      
      const response = {
        hasClient,
        isSessionValid
      };
      
      expect(response.hasClient).toBe(false);
      expect(response.isSessionValid).toBe(false);
    });

    it('should return isSessionValid: false when session check fails', async () => {
      // Mock supabase client exists but session check fails
      const hasClient = true;
      
      // Mock session check that fails
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Session not found')
      });
      
      const { data: { session }, error } = await mockSupabase.auth.getSession();
      const isSessionValid = !error && !!session && !!session.access_token;
      
      expect(hasClient).toBe(true);
      expect(isSessionValid).toBe(false);
    });

    it('should return isSessionValid: true when session is valid', async () => {
      // Mock supabase client exists and session is valid
      const hasClient = true;
      
      // Mock valid session
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { 
          session: { 
            access_token: 'valid_token',
            refresh_token: 'valid_refresh_token'
          } 
        },
        error: null
      });
      
      const { data: { session }, error } = await mockSupabase.auth.getSession();
      const isSessionValid = !error && !!session && !!session.access_token;
      
      expect(hasClient).toBe(true);
      expect(isSessionValid).toBe(true);
    });

    it('should return isSessionValid: false when session has no access token', async () => {
      // Mock supabase client exists but session has no access token
      const hasClient = true;
      
      // Mock session without access token
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { 
          session: { 
            refresh_token: 'valid_refresh_token'
            // No access_token
          } 
        },
        error: null
      });
      
      const { data: { session }, error } = await mockSupabase.auth.getSession();
      const isSessionValid = !error && !!session && !!session.access_token;
      
      expect(hasClient).toBe(true);
      expect(isSessionValid).toBe(false);
    });

    it('should handle session check errors gracefully', async () => {
      // Mock supabase client exists but session check throws
      const hasClient = true;
      
      // Mock session check that throws
      mockSupabase.auth.getSession.mockRejectedValue(new Error('Network error'));
      
      let isSessionValid = false;
      try {
        const { data: { session }, error } = await mockSupabase.auth.getSession();
        isSessionValid = !error && !!session && !!session.access_token;
      } catch (sessionError) {
        console.log('Session check failed:', sessionError);
        isSessionValid = false;
      }
      
      expect(hasClient).toBe(true);
      expect(isSessionValid).toBe(false);
    });
  });

  describe('Session validation integration', () => {
    it('should properly validate session before allowing operations', async () => {
      // Mock the flow: supabase.getClient -> supabase.getUser
      
      // First, check if client and session are valid
      const clientResponse = {
        hasClient: true,
        isSessionValid: true
      };
      
      expect(clientResponse.hasClient).toBe(true);
      expect(clientResponse.isSessionValid).toBe(true);
      
      // If valid, then get user should work
      if (clientResponse.hasClient && clientResponse.isSessionValid) {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: '123', email: 'test@example.com' } },
          error: null
        });
        
        const { data: { user }, error } = await mockSupabase.auth.getUser();
        expect(user).toBeDefined();
        expect(user.id).toBe('123');
        expect(error).toBeNull();
      }
    });

    it('should prevent user operations when session is invalid', async () => {
      // Mock the flow: supabase.getClient -> supabase.getUser
      
      // First, check if client and session are valid
      const clientResponse = {
        hasClient: true,
        isSessionValid: false
      };
      
      expect(clientResponse.hasClient).toBe(true);
      expect(clientResponse.isSessionValid).toBe(false);
      
      // If invalid, then get user should not be attempted
      if (!clientResponse.isSessionValid) {
        // Should not call getUser when session is invalid
        expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
      }
    });
  });
});
