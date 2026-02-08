/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

import type { SignedUrlOptions } from '../signedUrl';
import { generateSignedUrl } from '../signedUrl';

// Mock Supabase client
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn()
}));

describe('signedUrl utility', () => {
  let mockSupabase: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = require('@/utils/supabase/server');
    
    // Set up default mock implementation
    mockSupabase.createClient.mockReturnValue({
      auth: {
        getUser: jest.fn()
      }
    });

    // Set up environment variables for testing
    process.env.MEDIA_URL_KEY = 'test-media-key-for-testing';
    process.env.NEXT_PUBLIC_API_URL = 'https://test-api.example.com';
  });

  const createMockRequest = (path: string): NextRequest => {
    return new NextRequest(`http://localhost:3000/api/test?path=${encodeURIComponent(path)}`);
  };

  describe('generateSignedUrl', () => {
    it('should generate a valid signed URL for audio', async () => {
      // Mock authenticated user
      mockSupabase.createClient().auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      });

      const req = createMockRequest('test-audio.opus');
      const options: SignedUrlOptions = {
        pathPrefix: '/media/',
        ttlSeconds: 180
      };

      const response = await generateSignedUrl(req, 'test-audio.opus', options);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('url');
      expect(data.url).toContain('/media/test-audio.opus');
      expect(data.url).toContain('exp=');
      expect(data.url).toContain('sig=');
    });

    it('should generate a valid signed URL for images', async () => {
      // Mock authenticated user
      mockSupabase.createClient().auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      });

      const req = createMockRequest('test-image.png');
      const options: SignedUrlOptions = {
        pathPrefix: '/media/img/',
        ttlSeconds: 180
      };

      const response = await generateSignedUrl(req, 'test-image.png', options);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('url');
      expect(data.url).toContain('/media/img/test-image.png');
      expect(data.url).toContain('exp=');
      expect(data.url).toContain('sig=');
    });

    it('should use default TTL when not specified', async () => {
      // Mock authenticated user
      mockSupabase.createClient().auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      });

      const req = createMockRequest('test.opus');
      const options: SignedUrlOptions = {
        pathPrefix: '/media/'
        // ttlSeconds not specified, should default to 180
      };

      const response = await generateSignedUrl(req, 'test.opus', options);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.url).toContain('exp=');
      
      // Extract expiry from URL and verify it's roughly 3 minutes from now
      const url = new URL(data.url);
      const exp = parseInt(url.searchParams.get('exp')!);
      const now = Math.floor(Date.now() / 1000);
      expect(exp).toBeGreaterThan(now);
      expect(exp).toBeLessThanOrEqual(now + 181); // Allow 1 second tolerance
    });

    it('should return 400 for missing path', async () => {
      const req = createMockRequest('');
      const options: SignedUrlOptions = {
        pathPrefix: '/media/'
      };

      const response = await generateSignedUrl(req, '', options);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing path');
    });

    it('should return 401 for unauthenticated user', async () => {
      // Mock unauthenticated user
      mockSupabase.createClient().auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const req = createMockRequest('test.opus');
      const options: SignedUrlOptions = {
        pathPrefix: '/media/'
      };

      const response = await generateSignedUrl(req, 'test.opus', options);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 for authentication error', async () => {
      // Mock authentication error
      mockSupabase.createClient().auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Auth error')
      });

      const req = createMockRequest('test.opus');
      const options: SignedUrlOptions = {
        pathPrefix: '/media/'
      };

      const response = await generateSignedUrl(req, 'test.opus', options);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 500 when MEDIA_URL_KEY is not configured', async () => {
      // Mock authenticated user
      mockSupabase.createClient().auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      });

      // Temporarily remove MEDIA_URL_KEY
      const originalKey = process.env.MEDIA_URL_KEY;
      delete process.env.MEDIA_URL_KEY;

      const req = createMockRequest('test.opus');
      const options: SignedUrlOptions = {
        pathPrefix: '/media/'
      };

      const response = await generateSignedUrl(req, 'test.opus', options);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Server configuration error');

      // Restore environment variable
      if (originalKey) {
        process.env.MEDIA_URL_KEY = originalKey;
      }
    });
  });
});
