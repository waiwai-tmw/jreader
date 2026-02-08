/**
 * @jest-environment node
 */

import { GET } from './route';

describe('/api/ext-auth/status', () => {
  it('should return pending status for non-completed nonce', async () => {
    const testNonce = 'test-nonce-1234567890abcdef';
    const mockRequest = {
      method: 'GET',
      url: `http://localhost:3000/api/ext-auth/status?nonce=${testNonce}`,
    } as any;

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      status: 'pending'
    });
  });

  it('should return claimed status for completed nonce', async () => {
    const testNonce = 'test-nonce-completed';
    
    // Directly set up the nonce in the shared storage to simulate completion
    const { ensureMap } = await import('../shared');
    const noncesMap = ensureMap();
    noncesMap.set(testNonce, {
      device_token: 'jrdr_dev_dummy',
      session_data: null
    });
    
    // Then check status
    const mockRequest = {
      method: 'GET',
      url: `http://localhost:3000/api/ext-auth/status?nonce=${testNonce}`,
    } as any;

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      status: 'claimed',
      device_token: 'jrdr_dev_dummy',
      session_data: {
        device_token: 'jrdr_dev_dummy',
        session_data: null
      }
    });
  });

  it('should handle missing nonce parameter', async () => {
    const mockRequest = {
      method: 'GET',
      url: 'http://localhost:3000/api/ext-auth/status',
    } as any;

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      status: 'pending'
    });
  });

  it('should handle empty nonce parameter', async () => {
    const mockRequest = {
      method: 'GET',
      url: 'http://localhost:3000/api/ext-auth/status?nonce=',
    } as any;

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      status: 'pending'
    });
  });
});
