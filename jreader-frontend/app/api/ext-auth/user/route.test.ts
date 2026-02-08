/**
 * @jest-environment node
 */

import { GET } from './route';

describe('/api/ext-auth/user', () => {
  it('should return user data for valid device token', async () => {
    const mockRequest = {
      method: 'GET',
      url: 'http://localhost:3000/api/ext-auth/user?device_token=jrdr_dev_dummy',
    } as any;

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      id: "user_123",
      name: "Test User",
      email: "test@example.com",
      image: "https://cdn.discordapp.com/avatars/123456789/abcdef123456.png",
      discord_id: "123456789",
      discord_username: "testuser",
      discord_discriminator: "1234"
    });
  });

  it('should return 401 for invalid device token', async () => {
    const mockRequest = {
      method: 'GET',
      url: 'http://localhost:3000/api/ext-auth/user?device_token=invalid_token',
    } as any;

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Invalid device token" });
  });

  it('should return 400 for missing device token', async () => {
    const mockRequest = {
      method: 'GET',
      url: 'http://localhost:3000/api/ext-auth/user',
    } as any;

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "Device token required" });
  });

  it('should return 400 for empty device token', async () => {
    const mockRequest = {
      method: 'GET',
      url: 'http://localhost:3000/api/ext-auth/user?device_token=',
    } as any;

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "Device token required" });
  });

  it('should return different user data for different valid tokens', async () => {
    const mockRequest1 = {
      method: 'GET',
      url: 'http://localhost:3000/api/ext-auth/user?device_token=jrdr_dev_test_1',
    } as any;

    const mockRequest2 = {
      method: 'GET',
      url: 'http://localhost:3000/api/ext-auth/user?device_token=jrdr_dev_test_2',
    } as any;

    const response1 = await GET(mockRequest1);
    const response2 = await GET(mockRequest2);
    
    const data1 = await response1.json();
    const data2 = await response2.json();

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);
    expect(data1.name).toBe("John Doe");
    expect(data2.name).toBe("Jane Smith");
    expect(data1.id).not.toBe(data2.id);
  });
});
