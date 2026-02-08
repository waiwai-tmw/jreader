/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

import { GET } from '../route';

// Mock the shared utility
jest.mock('@/utils/signedUrl', () => ({
  generateSignedUrl: jest.fn()
}));

describe('sign-image-url API route', () => {
  let mockGenerateSignedUrl: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateSignedUrl = require('@/utils/signedUrl').generateSignedUrl;
  });

  const createMockRequest = (path: string): NextRequest => {
    return new NextRequest(`http://localhost:3000/api/sign-image-url?path=${encodeURIComponent(path)}`);
  };

  it('should call generateSignedUrl with correct parameters for images', async () => {
    const mockResponse = new Response(JSON.stringify({ url: 'https://example.com/signed-url' }));
    mockGenerateSignedUrl.mockResolvedValue(mockResponse);

    const req = createMockRequest('test-image.png');
    const response = await GET(req);

    expect(mockGenerateSignedUrl).toHaveBeenCalledWith(
      req,
      'test-image.png',
      {
        pathPrefix: '/media/img/',
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
        pathPrefix: '/media/img/',
        ttlSeconds: 180
      }
    );
  });

  it('should handle missing path parameter', async () => {
    const mockResponse = new Response(JSON.stringify({ error: 'Missing path' }), { status: 400 });
    mockGenerateSignedUrl.mockResolvedValue(mockResponse);

    const req = new NextRequest('http://localhost:3000/api/sign-image-url');
    const response = await GET(req);

    expect(mockGenerateSignedUrl).toHaveBeenCalledWith(
      req,
      '',
      {
        pathPrefix: '/media/img/',
        ttlSeconds: 180
      }
    );
  });

  it('should handle complex image paths with Windows backslashes', async () => {
    const mockResponse = new Response(JSON.stringify({ url: 'https://example.com/signed-url' }));
    mockGenerateSignedUrl.mockResolvedValue(mockResponse);

    const complexPath = 'ja.Wikipedia.2022-12-01.v1.6.1/assets\\wikipedia-icon.png';
    const req = createMockRequest(complexPath);
    const response = await GET(req);

    expect(mockGenerateSignedUrl).toHaveBeenCalledWith(
      req,
      complexPath,
      {
        pathPrefix: '/media/img/',
        ttlSeconds: 180
      }
    );
  });

  it('should handle dictionary image paths', async () => {
    const mockResponse = new Response(JSON.stringify({ url: 'https://example.com/signed-url' }));
    mockGenerateSignedUrl.mockResolvedValue(mockResponse);

    const dictPath = 'dicts/example-image.jpg';
    const req = createMockRequest(dictPath);
    const response = await GET(req);

    expect(mockGenerateSignedUrl).toHaveBeenCalledWith(
      req,
      dictPath,
      {
        pathPrefix: '/media/img/',
        ttlSeconds: 180
      }
    );
  });
});
