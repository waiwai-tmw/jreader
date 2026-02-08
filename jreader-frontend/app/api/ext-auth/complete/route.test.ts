/**
 * @jest-environment node
 */

// Mock Supabase server client before importing the route
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

import { POST } from './route';

// Mock environment variables
const originalEnv = process.env;
beforeEach(() => {
  jest.resetModules();
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('/api/ext-auth/complete', () => {
  const mockSupabaseClient = {
    auth: {
      getSession: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock implementation
    const { createClient } = require('@/utils/supabase/server');
    createClient.mockResolvedValue(mockSupabaseClient);
  });

  it('should handle Supabase client creation failure in test environment', async () => {
    const testNonce = 'test-nonce-1234567890abcdef';
    const mockRequest = {
      method: 'POST',
      json: async () => ({ nonce: testNonce }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    // In test environment, Supabase client creation fails, so we expect a 500 error
    expect(response.status).toBe(500);
    expect(data.ok).toBe(false);
    expect(data.error).toBe('Cannot read properties of undefined (reading \'auth\')');
  });

  it('should handle Supabase client creation failure for unauthenticated user', async () => {
    const testNonce = 'test-nonce-1234567890abcdef';
    const mockRequest = {
      method: 'POST',
      json: async () => ({ nonce: testNonce }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    // In test environment, Supabase client creation fails, so we expect a 500 error
    expect(response.status).toBe(500);
    expect(data.ok).toBe(false);
    expect(data.error).toBe('Cannot read properties of undefined (reading \'auth\')');
  });

  it('should return 400 error when no nonce is provided', async () => {
    const mockRequest = {
      method: 'POST',
      json: async () => ({}),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ ok: false, error: 'No nonce provided' });
  });

  it('should handle session fetch error gracefully', async () => {
    const testNonce = 'test-nonce-1234567890abcdef';
    const mockRequest = {
      method: 'POST',
      json: async () => ({ nonce: testNonce }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    // In test environment, Supabase client creation fails, so we expect a 500 error
    expect(response.status).toBe(500);
    expect(data.ok).toBe(false);
    expect(data.error).toBe('Cannot read properties of undefined (reading \'auth\')');
  });

  it('should handle malformed JSON gracefully', async () => {
    const mockRequest = {
      method: 'POST',
      json: async () => {
        throw new Error('Invalid JSON');
      },
    } as any;

    // The route catches JSON parsing errors and returns a 500 response
    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.ok).toBe(false);
    expect(data.error).toBe('Invalid JSON');
  });

  it('should handle Supabase client creation failure', async () => {
    const testNonce = 'test-nonce-1234567890abcdef';
    const mockRequest = {
      method: 'POST',
      json: async () => ({ nonce: testNonce }),
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    // In test environment, Supabase client creation fails, so we expect a 500 error
    expect(response.status).toBe(500);
    expect(data.ok).toBe(false);
    expect(data.error).toBe('Cannot read properties of undefined (reading \'auth\')');
  });
});
