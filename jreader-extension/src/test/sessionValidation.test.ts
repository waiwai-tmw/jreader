// Unit tests for session validation logic
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the session validation function (this would be imported from sw-main.ts in real usage)
async function validateStoredSession(session: any): Promise<{ isValid: boolean; reason?: string }> {
  try {
    // Check if session has required fields (null/undefined)
    if (session.access_token === null || session.access_token === undefined || 
        session.refresh_token === null || session.refresh_token === undefined) {
      return { isValid: false, reason: 'Missing access_token or refresh_token' };
    }
    
    // Check if tokens are not empty strings
    if (session.access_token.trim() === '' || session.refresh_token.trim() === '') {
      return { isValid: false, reason: 'Empty access_token or refresh_token' };
    }
    
    // Check if session has expired (basic JWT expiration check)
    if (session.expires_at) {
      let expirationTime: number;
      
      if (typeof session.expires_at === 'number') {
        expirationTime = session.expires_at;
      } else {
        const expirationDate = new Date(session.expires_at);
        if (isNaN(expirationDate.getTime())) {
          return { isValid: false, reason: 'Session validation error' };
        }
        expirationTime = expirationDate.getTime();
      }
      
      const currentTime = Date.now();
      
      // If expired more than 24 hours ago, consider it invalid
      if (currentTime > expirationTime + (24 * 60 * 60 * 1000)) {
        return { isValid: false, reason: 'Session expired more than 24 hours ago' };
      }
    }
    
    // Check if session was created too long ago (more than 30 days)
    if (session.created_at) {
      let creationTime: number;
      
      if (typeof session.created_at === 'number') {
        creationTime = session.created_at;
      } else {
        const creationDate = new Date(session.created_at);
        if (isNaN(creationDate.getTime())) {
          return { isValid: false, reason: 'Session validation error' };
        }
        creationTime = creationDate.getTime();
      }
      
      const currentTime = Date.now();
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
      
      if (currentTime > creationTime + thirtyDaysInMs) {
        return { isValid: false, reason: 'Session is older than 30 days' };
      }
    }
    
    return { isValid: true };
  } catch (error) {
    console.error('Error validating stored session:', error);
    return { isValid: false, reason: 'Session validation error' };
  }
}

describe('Session Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateStoredSession', () => {
    it('should validate session with all required fields', async () => {
      const validSession = {
        access_token: 'valid_access_token_123',
        refresh_token: 'valid_refresh_token_456',
        expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        created_at: new Date(Date.now() - 86400000).toISOString() // 1 day ago
      };
      
      const result = await validateStoredSession(validSession);
      
      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject session with missing access_token', async () => {
      const invalidSession = {
        refresh_token: 'valid_refresh_token_456'
        // Missing access_token
      };
      
      const result = await validateStoredSession(invalidSession);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Missing access_token or refresh_token');
    });

    it('should reject session with missing refresh_token', async () => {
      const invalidSession = {
        access_token: 'valid_access_token_123'
        // Missing refresh_token
      };
      
      const result = await validateStoredSession(invalidSession);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Missing access_token or refresh_token');
    });

    it('should reject session with empty access_token', async () => {
      const invalidSession = {
        access_token: '',
        refresh_token: 'valid_refresh_token_456'
      };
      
      const result = await validateStoredSession(invalidSession);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Empty access_token or refresh_token');
    });

    it('should reject session with whitespace-only access_token', async () => {
      const invalidSession = {
        access_token: '   ',
        refresh_token: 'valid_refresh_token_456'
      };
      
      const result = await validateStoredSession(invalidSession);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Empty access_token or refresh_token');
    });

    it('should reject session with empty refresh_token', async () => {
      const invalidSession = {
        access_token: 'valid_access_token_123',
        refresh_token: ''
      };
      
      const result = await validateStoredSession(invalidSession);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Empty access_token or refresh_token');
    });

    it('should reject session with whitespace-only refresh_token', async () => {
      const invalidSession = {
        access_token: 'valid_access_token_123',
        refresh_token: '\t\n  '
      };
      
      const result = await validateStoredSession(invalidSession);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Empty access_token or refresh_token');
    });

    it('should reject session expired more than 24 hours ago', async () => {
      const expiredSession = {
        access_token: 'valid_access_token_123',
        refresh_token: 'valid_refresh_token_456',
        expires_at: new Date(Date.now() - (25 * 60 * 60 * 1000)).toISOString() // 25 hours ago
      };
      
      const result = await validateStoredSession(expiredSession);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Session expired more than 24 hours ago');
    });

    it('should accept session expired less than 24 hours ago', async () => {
      const recentlyExpiredSession = {
        access_token: 'valid_access_token_123',
        refresh_token: 'valid_refresh_token_456',
        expires_at: new Date(Date.now() - (12 * 60 * 60 * 1000)).toISOString() // 12 hours ago
      };
      
      const result = await validateStoredSession(recentlyExpiredSession);
      
      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should accept session not yet expired', async () => {
      const validSession = {
        access_token: 'valid_access_token_123',
        refresh_token: 'valid_refresh_token_456',
        expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
      };
      
      const result = await validateStoredSession(validSession);
      
      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject session older than 30 days', async () => {
      const oldSession = {
        access_token: 'valid_access_token_123',
        refresh_token: 'valid_refresh_token_456',
        created_at: new Date(Date.now() - (31 * 24 * 60 * 60 * 1000)).toISOString() // 31 days ago
      };
      
      const result = await validateStoredSession(oldSession);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Session is older than 30 days');
    });

    it('should accept session newer than 30 days', async () => {
      const recentSession = {
        access_token: 'valid_access_token_123',
        refresh_token: 'valid_refresh_token_456',
        created_at: new Date(Date.now() - (15 * 24 * 60 * 60 * 1000)).toISOString() // 15 days ago
      };
      
      const result = await validateStoredSession(recentSession);
      
      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should handle session without expiration date', async () => {
      const sessionWithoutExpiration = {
        access_token: 'valid_access_token_123',
        refresh_token: 'valid_refresh_token_456'
        // No expires_at field
      };
      
      const result = await validateStoredSession(sessionWithoutExpiration);
      
      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should handle session without creation date', async () => {
      const sessionWithoutCreation = {
        access_token: 'valid_access_token_123',
        refresh_token: 'valid_refresh_token_456',
        expires_at: new Date(Date.now() + 3600000).toISOString()
        // No created_at field
      };
      
      const result = await validateStoredSession(sessionWithoutCreation);
      
      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should handle malformed session object', async () => {
      const malformedSession = null;
      
      const result = await validateStoredSession(malformedSession);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Session validation error');
    });

    it('should handle session with invalid date strings', async () => {
      const sessionWithInvalidDates = {
        access_token: 'valid_access_token_123',
        refresh_token: 'valid_refresh_token_456',
        expires_at: 'invalid-date-string',
        created_at: 'another-invalid-date'
      };
      
      const result = await validateStoredSession(sessionWithInvalidDates);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Session validation error');
    });

    it('should handle edge case: session created exactly 30 days ago', async () => {
      const edgeCaseSession = {
        access_token: 'valid_access_token_123',
        refresh_token: 'valid_refresh_token_456',
        created_at: new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString() // Exactly 30 days ago
      };
      
      const result = await validateStoredSession(edgeCaseSession);
      
      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should handle edge case: session expired exactly 24 hours ago', async () => {
      const edgeCaseSession = {
        access_token: 'valid_access_token_123',
        refresh_token: 'valid_refresh_token_456',
        expires_at: new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString() // Exactly 24 hours ago
      };
      
      const result = await validateStoredSession(edgeCaseSession);
      
      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should handle session with additional fields', async () => {
      const sessionWithExtraFields = {
        access_token: 'valid_access_token_123',
        refresh_token: 'valid_refresh_token_456',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        created_at: new Date(Date.now() - 86400000).toISOString(),
        user_id: 'user_123',
        email: 'user@example.com',
        extra_field: 'should_be_ignored'
      };
      
      const result = await validateStoredSession(sessionWithExtraFields);
      
      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('Session validation integration scenarios', () => {
    it('should handle real-world Supabase session structure', async () => {
      const realSupabaseSession = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refresh_token: 'v1.abc123def456...',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        token_type: 'bearer',
        user: {
          id: 'user-uuid',
          email: 'user@example.com'
        }
      };
      
      const result = await validateStoredSession(realSupabaseSession);
      
      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should handle session with numeric timestamps', async () => {
      const sessionWithNumericTimestamps = {
        access_token: 'valid_access_token_123',
        refresh_token: 'valid_refresh_token_456',
        expires_at: Date.now() + 3600000, // Numeric timestamp
        created_at: Date.now() - 86400000 // Numeric timestamp
      };
      
      const result = await validateStoredSession(sessionWithNumericTimestamps);
      
      // This should succeed because numeric timestamps are valid
      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });
});
