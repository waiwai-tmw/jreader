/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

import { GET } from '../route';

// Mock the shared utility
jest.mock('@/utils/signedUrl', () => ({
  generateSignedUrl: jest.fn()
}));

describe('extension sign-image-url API route', () => {
  let mockGenerateSignedUrl: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateSignedUrl = require('@/utils/signedUrl').generateSignedUrl;
  });

  const createMockRequest = (path: string): NextRequest => {
    return new NextRequest(`http://localhost:3000/api/extension/sign-image-url?path=${encodeURIComponent(path)}`);
  };

  it('should call generateSignedUrl with correct parameters for extension images', async () => {
    const mockResponse = new Response(JSON.stringify({ url: 'https://example.com/signed-url' }));
    mockGenerateSignedUrl.mockResolvedValue(mockResponse);

    const req = createMockRequest('Dictionary Name/img2/test-image.png');
    const response = await GET(req);

    expect(mockGenerateSignedUrl).toHaveBeenCalledWith(
      req,
      'Dictionary Name/img2/test-image.png',
      {
        pathPrefix: '/media/img/',
        ttlSeconds: 180
      }
    );
    expect(response).toBe(mockResponse);
  });

  it('should handle empty path parameter', async () => {
    const req = createMockRequest('');
    const response = await GET(req);

    // Should return 400 error without calling generateSignedUrl
    expect(response.status).toBe(400);
    const responseData = await response.json();
    expect(responseData.error).toBe('Missing path parameter');
    expect(mockGenerateSignedUrl).not.toHaveBeenCalled();
  });

  it('should handle missing path parameter', async () => {
    const req = new NextRequest('http://localhost:3000/api/extension/sign-image-url');
    const response = await GET(req);

    // Should return 400 error without calling generateSignedUrl
    expect(response.status).toBe(400);
    const responseData = await response.json();
    expect(responseData.error).toBe('Missing path parameter');
    expect(mockGenerateSignedUrl).not.toHaveBeenCalled();
  });

  it('should handle complex image paths with dictionary names', async () => {
    const mockResponse = new Response(JSON.stringify({ url: 'https://example.com/signed-url' }));
    mockGenerateSignedUrl.mockResolvedValue(mockResponse);

    const complexPath = '[JA-JA Yoji] 四字熟語の百科事典 [2024-06-30]/img2/855734f9c80388773fb2b7470507d651.png';
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
    expect(response).toBe(mockResponse);
  });

  it('should handle errors from generateSignedUrl', async () => {
    const mockError = new Error('Failed to generate signed URL');
    mockGenerateSignedUrl.mockRejectedValue(mockError);

    const req = createMockRequest('test-image.png');
    const response = await GET(req);

    expect(response.status).toBe(500);
    const responseData = await response.json();
    expect(responseData.error).toBe('Failed to generate signed URL');
  });
});
