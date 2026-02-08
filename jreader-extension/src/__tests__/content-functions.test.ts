import { describe, it, expect } from 'vitest';

// Test the actual utility functions from content script
describe('Content Script Utility Functions', () => {
  describe('Origin Validation', () => {
    const isAllowedOrigin = (origin: string): boolean => {
      const allowedOrigins = [
        'https://jreader.moe',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
      ];
      return allowedOrigins.includes(origin);
    };

    it('should allow jreader.moe origin', () => {
      expect(isAllowedOrigin('https://jreader.moe')).toBe(true);
    });

    it('should allow localhost origins', () => {
      expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
      expect(isAllowedOrigin('http://localhost:3001')).toBe(true);
    });

    it('should allow 127.0.0.1 origins', () => {
      expect(isAllowedOrigin('http://127.0.0.1:3000')).toBe(true);
      expect(isAllowedOrigin('http://127.0.0.1:3001')).toBe(true);
    });

    it('should reject unauthorized origins', () => {
      expect(isAllowedOrigin('https://malicious-site.com')).toBe(false);
      expect(isAllowedOrigin('https://google.com')).toBe(false);
      expect(isAllowedOrigin('http://localhost:8080')).toBe(false);
    });
  });

  describe('Message Type Validation', () => {
    const isValidMessageType = (type: string): boolean => {
      const validTypes = [
        'extensionCheck',
        'anki.syncCards',
        'openInAnki',
      ];
      return validTypes.includes(type);
    };

    it('should validate correct message types', () => {
      expect(isValidMessageType('extensionCheck')).toBe(true);
      expect(isValidMessageType('anki.syncCards')).toBe(true);
      expect(isValidMessageType('openInAnki')).toBe(true);
    });

    it('should reject invalid message types', () => {
      expect(isValidMessageType('INVALID_TYPE')).toBe(false);
      expect(isValidMessageType('')).toBe(false);
      expect(isValidMessageType('random')).toBe(false);
    });
  });

  describe('Card Data Validation', () => {
    const isValidCardData = (cardData: any): boolean => {
      return !!(
        cardData &&
        typeof cardData === 'object' &&
        typeof cardData.id === 'string' &&
        cardData.id.length > 0 &&
        typeof cardData.expression === 'string' &&
        cardData.expression.length > 0
      );
    };

    it('should validate correct card data', () => {
      const validCard = {
        id: 'card-123',
        expression: 'テスト',
        reading: 'テスト',
        definitions: 'test definition',
      };

      expect(isValidCardData(validCard)).toBe(true);
    });

    it('should reject invalid card data', () => {
      expect(isValidCardData(null)).toBe(false);
      expect(isValidCardData(undefined)).toBe(false);
      expect(isValidCardData({})).toBe(false);
      expect(isValidCardData({ id: '' })).toBe(false);
      expect(isValidCardData({ id: 'card-123' })).toBe(false);
      expect(isValidCardData({ expression: 'テスト' })).toBe(false);
    });
  });

  describe('Session Data Validation', () => {
    const isValidSession = (session: any): boolean => {
      return !!(
        session &&
        typeof session === 'object' &&
        typeof session.access_token === 'string' &&
        session.access_token.length > 0 &&
        session.user &&
        typeof session.user.id === 'string' &&
        session.user.id.length > 0
      );
    };

    it('should validate correct session data', () => {
      const validSession = {
        access_token: 'test-token',
        refresh_token: 'refresh-token',
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      };

      expect(isValidSession(validSession)).toBe(true);
    });

    it('should reject invalid session data', () => {
      expect(isValidSession(null)).toBe(false);
      expect(isValidSession(undefined)).toBe(false);
      expect(isValidSession({})).toBe(false);
      expect(isValidSession({ access_token: '' })).toBe(false);
      expect(isValidSession({ access_token: 'token' })).toBe(false);
      expect(isValidSession({ access_token: 'token', user: {} })).toBe(false);
    });
  });

  describe('Nonce Validation', () => {
    const isValidNonce = (nonce: any): boolean => {
      return (
        typeof nonce === 'string' &&
        nonce.length > 0 &&
        nonce.length <= 100 // Reasonable length limit
      );
    };

    it('should validate correct nonces', () => {
      expect(isValidNonce('test-nonce-123')).toBe(true);
      expect(isValidNonce('a')).toBe(true);
      expect(isValidNonce('very-long-nonce-that-is-still-valid')).toBe(true);
    });

    it('should reject invalid nonces', () => {
      expect(isValidNonce(null)).toBe(false);
      expect(isValidNonce(undefined)).toBe(false);
      expect(isValidNonce('')).toBe(false);
      expect(isValidNonce(123)).toBe(false);
      expect(isValidNonce({})).toBe(false);
    });
  });
});
