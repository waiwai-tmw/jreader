/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

import { GET } from '../route';

// Mock the shared utility
jest.mock('@/utils/signedUrl', () => ({
  generateSignedUrl: jest.fn()
}));

describe('sign-audio-url API route', () => {
  let mockGenerateSignedUrl: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateSignedUrl = require('@/utils/signedUrl').generateSignedUrl;
  });

  const createMockRequest = (path: string): NextRequest => {
    return new NextRequest(`http://localhost:3000/api/sign-audio-url?path=${encodeURIComponent(path)}`);
  };

  it('should call generateSignedUrl with correct parameters for audio', async () => {
    const mockResponse = new Response(JSON.stringify({ url: 'https://example.com/signed-url' }));
    mockGenerateSignedUrl.mockResolvedValue(mockResponse);

    const req = createMockRequest('test-audio.opus');
    const response = await GET(req);

    expect(mockGenerateSignedUrl).toHaveBeenCalledWith(
      req,
      'test-audio.opus',
      {
        pathPrefix: '/media/',
        ttlSeconds: 180
      }
    );
    expect(response).toBe(mockResponse);
  });

  it('should handle empty path parameter', async () => {
    const mockResponse = new Response(JSON.stringify({ error: 'Missing path' }), { status: 400 });
    mockGenerateSignedUrl.mockResolvedValue(mockResponse);

    const req = createMockRequest('');
    const response = await GET(req);

    expect(mockGenerateSignedUrl).toHaveBeenCalledWith(
      req,
      '',
      {
        pathPrefix: '/media/',
        ttlSeconds: 180
      }
    );
  });

  it('should handle missing path parameter', async () => {
    const mockResponse = new Response(JSON.stringify({ error: 'Missing path' }), { status: 400 });
    mockGenerateSignedUrl.mockResolvedValue(mockResponse);

    const req = new NextRequest('http://localhost:3000/api/sign-audio-url');
    const response = await GET(req);

    expect(mockGenerateSignedUrl).toHaveBeenCalledWith(
      req,
      '',
      {
        pathPrefix: '/media/',
        ttlSeconds: 180
      }
    );
  });

  it('should handle complex audio paths', async () => {
    const mockResponse = new Response(JSON.stringify({ url: 'https://example.com/signed-url' }));
    mockGenerateSignedUrl.mockResolvedValue(mockResponse);

    const complexPath = 'jpod_files/media/11788e3c041be6760952b9dc7c0876c3.opus';
    const req = createMockRequest(complexPath);
    const response = await GET(req);

    expect(mockGenerateSignedUrl).toHaveBeenCalledWith(
      req,
      complexPath,
      {
        pathPrefix: '/media/',
        ttlSeconds: 180
      }
    );
  });
});
