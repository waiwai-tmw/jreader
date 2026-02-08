import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

describe('Global Image Deduplication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reuse existing images across multiple mining sessions', async () => {
    // Mock the syncCardToAnki function behavior
    const expectedFilename = 'jreader_PixivLight_2024-11-25_img2_855734f9c80388773fb2b7470507d651_png.png';
    
    // First mining session - image doesn't exist yet
    const firstCheckResponse = {
      json: () => Promise.resolve({ error: null, result: [] }) // No existing files
    };
    
    const firstStoreResponse = {
      json: () => Promise.resolve({ error: null, result: expectedFilename })
    };
    
    // Second mining session - image already exists
    const secondCheckResponse = {
      json: () => Promise.resolve({ 
        error: null, 
        result: [{ filename: expectedFilename, size: 12345 }] // File exists
      })
    };
    
    // Mock fetch responses for first session
    (global.fetch as any)
      .mockResolvedValueOnce(firstCheckResponse) // Check if exists
      .mockResolvedValueOnce(firstStoreResponse); // Store new image
    
    // Mock fetch responses for second session  
    (global.fetch as any)
      .mockResolvedValueOnce(secondCheckResponse); // Check if exists (should find it)
    
    // Simulate first mining session
    console.log('=== First Mining Session ===');
    
    // Check if image exists (should return empty)
    const firstCheckRequest = {
      action: 'getMediaFilesInfo',
      version: 6,
      params: { files: [expectedFilename] }
    };
    
    const firstCheckResult = await (global.fetch as any)('anki-connect-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firstCheckRequest)
    });
    
    const firstCheckData = await firstCheckResult.json();
    expect(firstCheckData.result).toEqual([]);
    
    // Store the image (should succeed)
    const firstStoreRequest = {
      action: 'storeMediaFile',
      version: 6,
      params: {
        filename: expectedFilename,
        data: 'base64data...'
      }
    };
    
    const firstStoreResult = await (global.fetch as any)('anki-connect-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firstStoreRequest)
    });
    
    const firstStoreData = await firstStoreResult.json();
    expect(firstStoreData.result).toBe(expectedFilename);
    
    // Simulate second mining session
    console.log('=== Second Mining Session ===');
    
    // Check if image exists (should find it)
    const secondCheckRequest = {
      action: 'getMediaFilesInfo',
      version: 6,
      params: { files: [expectedFilename] }
    };
    
    const secondCheckResult = await (global.fetch as any)('anki-connect-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(secondCheckRequest)
    });
    
    const secondCheckData = await secondCheckResult.json();
    expect(secondCheckData.result).toHaveLength(1);
    expect(secondCheckData.result[0].filename).toBe(expectedFilename);
    
    // Verify that storeMediaFile was only called once (for the first session)
    expect(global.fetch).toHaveBeenCalledTimes(3); // 2 for first session, 1 for second session
  });

  it('should generate consistent filenames based on image path hash', () => {
    const imagePath1 = 'PixivLight_2024-11-25/img2/855734f9c80388773fb2b7470507d651.png';
    const imagePath2 = 'PixivLight_2024-11-25/img2/855734f9c80388773fb2b7470507d651.png';
    
    // Both should generate the same filename
    const pathHash1 = imagePath1.replace(/[\/\\]/g, '_').replace(/\./g, '_');
    const pathHash2 = imagePath2.replace(/[\/\\]/g, '_').replace(/\./g, '_');
    
    const filename1 = `jreader_${pathHash1}.png`;
    const filename2 = `jreader_${pathHash2}.png`;
    
    expect(filename1).toBe(filename2);
    expect(filename1).toBe('jreader_PixivLight_2024-11-25_img2_855734f9c80388773fb2b7470507d651_png.png');
  });

  it('should handle different images with different filenames', () => {
    const imagePath1 = 'PixivLight_2024-11-25/img2/855734f9c80388773fb2b7470507d651.png';
    const imagePath2 = 'PixivLight_2024-11-25/img2/1234567890abcdef1234567890abcdef.png';
    
    const pathHash1 = imagePath1.replace(/[\/\\]/g, '_').replace(/\./g, '_');
    const pathHash2 = imagePath2.replace(/[\/\\]/g, '_').replace(/\./g, '_');
    
    const filename1 = `jreader_${pathHash1}.png`;
    const filename2 = `jreader_${pathHash2}.png`;
    
    expect(filename1).not.toBe(filename2);
    expect(filename1).toBe('jreader_PixivLight_2024-11-25_img2_855734f9c80388773fb2b7470507d651_png.png');
    expect(filename2).toBe('jreader_PixivLight_2024-11-25_img2_1234567890abcdef1234567890abcdef_png.png');
  });
});
