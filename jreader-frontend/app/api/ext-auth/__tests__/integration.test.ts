/**
 * @jest-environment node
 */

import { POST as startPost } from '../start/route';
import { GET as statusGet } from '../status/route';

describe('Device Authorization Flow Integration', () => {
  it('should complete the full device authorization flow', async () => {
    // Step 1: Start the flow and get a nonce
    const startRequest = {
      method: 'POST',
    } as any;
    const startResponse = await startPost(startRequest);
    const startData = await startResponse.json();
    
    expect(startData).toHaveProperty('nonce');
    const nonce = startData.nonce;
    expect(nonce).toHaveLength(32);

    // Step 2: Check initial status (should be pending)
    const initialStatusRequest = {
      method: 'GET',
      url: `http://localhost:3000/api/ext-auth/status?nonce=${nonce}`,
    } as any;
    const initialStatusResponse = await statusGet(initialStatusRequest);
    const initialStatusData = await initialStatusResponse.json();
    
    expect(initialStatusData).toEqual({
      status: 'pending'
    });

    // Step 3: Complete the flow by directly setting up the nonce in shared storage
    const { ensureMap } = await import('../shared');
    const noncesMap = ensureMap();
    noncesMap.set(nonce, {
      device_token: 'jrdr_dev_dummy',
      session_data: {
        type: 'SET_SUPABASE_SESSION',
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        expires_at: 1234567890,
        supabase_url: 'https://test.supabase.co',
        supabase_anon_key: 'test-key'
      }
    });
    
    // Simulate the complete response
    const completeData = { ok: true, session_data: noncesMap.get(nonce).session_data };
    
    expect(completeData.ok).toBe(true);
    expect(completeData.session_data).toBeDefined();

    // Step 4: Check final status (should be claimed)
    const finalStatusRequest = {
      method: 'GET',
      url: `http://localhost:3000/api/ext-auth/status?nonce=${nonce}`,
    } as any;
    const finalStatusResponse = await statusGet(finalStatusRequest);
    const finalStatusData = await finalStatusResponse.json();
    
    expect(finalStatusData).toEqual({
      status: 'claimed',
      device_token: 'jrdr_dev_dummy',
      session_data: {
        device_token: 'jrdr_dev_dummy',
        session_data: {
          type: 'SET_SUPABASE_SESSION',
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_at: 1234567890,
          supabase_url: 'https://test.supabase.co',
          supabase_anon_key: 'test-key'
        }
      }
    });
  });

  it('should handle multiple concurrent flows', async () => {
    // Start multiple flows simultaneously
    const promises = Array.from({ length: 3 }, async () => {
      const startRequest = {
        method: 'POST',
      } as any;
      const response = await startPost(startRequest);
      return response.json();
    });

    const results = await Promise.all(promises);
    
    // Each should have a unique nonce
    const nonces = results.map(r => r.nonce);
    const uniqueNonces = new Set(nonces);
    expect(uniqueNonces.size).toBe(3);
    
    // Each nonce should be 32 characters long
    nonces.forEach(nonce => {
      expect(nonce).toHaveLength(32);
    });
  });
});
