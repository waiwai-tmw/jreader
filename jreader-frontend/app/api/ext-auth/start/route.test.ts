/**
 * @jest-environment node
 */

import { POST } from './route';

describe('/api/ext-auth/start', () => {
  it('should generate a nonce and return it', async () => {
    const mockRequest = {
      method: 'POST',
    } as any;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('nonce');
    expect(typeof data.nonce).toBe('string');
    expect(data.nonce).toHaveLength(32); // 16 bytes = 32 hex characters
  });

  it('should generate unique nonces on multiple calls', async () => {
    const mockRequest = {
      method: 'POST',
    } as any;

    const response1 = await POST(mockRequest);
    const response2 = await POST(mockRequest);
    
    const data1 = await response1.json();
    const data2 = await response2.json();

    expect(data1.nonce).not.toBe(data2.nonce);
  });
});
