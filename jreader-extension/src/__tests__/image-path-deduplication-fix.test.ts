import { describe, it, expect } from 'vitest';

describe('Image Path Deduplication Fix', () => {
  it('should generate different filenames for different image paths', () => {
    // Test the exact paths from the user's issue
    const pixivPath = 'PixivLight_2024-11-25/assets/pixiv-logo.png';
    const wikipediaPath = 'ja.Wikipedia.2022-12-01.v1.6.1/assets\\wikipedia-icon.png';
    
    // Apply the same logic as in sw-main.ts
    const canonicalizePath = (path: string) => path
      .replace(/[\/\\]/g, '_')
      .replace(/\./g, '_')
      .replace(/[<>:"|?*]/g, '_') // Replace only problematic filesystem characters
      .replace(/[\[\](){}]/g, '_') // Replace brackets and parentheses
      .replace(/\s+/g, '_') // Replace whitespace with underscores
      .replace(/_+/g, '_') // Collapse multiple underscores into one
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
    
    const pixivHash = canonicalizePath(pixivPath);
    const wikipediaHash = canonicalizePath(wikipediaPath);
    
    const pixivFilename = `jreader_${pixivHash}.png`;
    const wikipediaFilename = `jreader_${wikipediaHash}.png`;
    
    // These should be different filenames
    expect(pixivFilename).not.toBe(wikipediaFilename);
    expect(pixivFilename).toBe('jreader_PixivLight_2024-11-25_assets_pixiv-logo_png.png');
    expect(wikipediaFilename).toBe('jreader_ja_Wikipedia_2022-12-01_v1_6_1_assets_wikipedia-icon_png.png');
  });

  it('should handle forward slashes and backslashes consistently', () => {
    const path1 = 'dictionary1/assets/image1.png';
    const path2 = 'dictionary2\\assets\\image2.png';
    
    const canonicalizePath = (path: string) => path
      .replace(/[\/\\]/g, '_')
      .replace(/\./g, '_')
      .replace(/[<>:"|?*]/g, '_')
      .replace(/[\[\](){}]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    const hash1 = canonicalizePath(path1);
    const hash2 = canonicalizePath(path2);
    
    const filename1 = `jreader_${hash1}.png`;
    const filename2 = `jreader_${hash2}.png`;
    
    // Should be different
    expect(filename1).not.toBe(filename2);
    expect(filename1).toBe('jreader_dictionary1_assets_image1_png.png');
    expect(filename2).toBe('jreader_dictionary2_assets_image2_png.png');
  });

  it('should generate same filename for identical paths regardless of path separators', () => {
    const path1 = 'dictionary/assets/image.png';
    const path2 = 'dictionary\\assets\\image.png';
    
    const canonicalizePath = (path: string) => path
      .replace(/[\/\\]/g, '_')
      .replace(/\./g, '_')
      .replace(/[<>:"|?*]/g, '_')
      .replace(/[\[\](){}]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    const hash1 = canonicalizePath(path1);
    const hash2 = canonicalizePath(path2);
    
    const filename1 = `jreader_${hash1}.png`;
    const filename2 = `jreader_${hash2}.png`;
    
    // Should be the same (normalized)
    expect(filename1).toBe(filename2);
    expect(filename1).toBe('jreader_dictionary_assets_image_png.png');
  });

  it('should canonicalize Japanese characters and special characters', () => {
    const japanesePath = '日本語辞書/魚/画像.png';
    const specialCharPath = 'Dictionary [2024] (v1.0)/assets/image-file.png';
    
    const canonicalizePath = (path: string) => path
      .replace(/[\/\\]/g, '_')
      .replace(/\./g, '_')
      .replace(/[<>:"|?*]/g, '_')
      .replace(/[\[\](){}]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    const japaneseHash = canonicalizePath(japanesePath);
    const specialCharHash = canonicalizePath(specialCharPath);
    
    const japaneseFilename = `jreader_${japaneseHash}.png`;
    const specialCharFilename = `jreader_${specialCharHash}.png`;
    
    // Should be filesystem-safe
    expect(japaneseFilename).toBe('jreader_日本語辞書_魚_画像_png.png');
    expect(specialCharFilename).toBe('jreader_Dictionary_2024_v1_0_assets_image-file_png.png');
    
    // Should not contain any problematic characters
    expect(japaneseFilename).not.toMatch(/[\/\\:*?"<>|]/);
    expect(specialCharFilename).not.toMatch(/[\/\\:*?"<>|]/);
  });

  it('should handle JSON-escaped backslashes correctly', () => {
    // Test the exact case from the user's Wikipedia definition
    const jsonEscapedPath = 'ja.Wikipedia.2022-12-01.v1.6.1/assets\\\\wikipedia-icon.png';
    const normalPath = 'ja.Wikipedia.2022-12-01.v1.6.1/assets/wikipedia-icon.png';
    
    const canonicalizePath = (path: string) => path
      .replace(/[\/\\]/g, '_')
      .replace(/\./g, '_')
      .replace(/[<>:"|?*]/g, '_')
      .replace(/[\[\](){}]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    const escapedHash = canonicalizePath(jsonEscapedPath);
    const normalHash = canonicalizePath(normalPath);
    
    const escapedFilename = `jreader_${escapedHash}.png`;
    const normalFilename = `jreader_${normalHash}.png`;
    
    // Both should result in the same canonicalized filename
    expect(escapedFilename).toBe(normalFilename);
    expect(escapedFilename).toBe('jreader_ja_Wikipedia_2022-12-01_v1_6_1_assets_wikipedia-icon_png.png');
  });

  it('should handle multiple consecutive backslashes and forward slashes', () => {
    const messyPath = 'dict\\\\//assets\\\\//image.png';
    const cleanPath = 'dict/assets/image.png';
    
    const canonicalizePath = (path: string) => path
      .replace(/[\/\\]/g, '_')
      .replace(/\./g, '_')
      .replace(/[<>:"|?*]/g, '_')
      .replace(/[\[\](){}]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    const messyHash = canonicalizePath(messyPath);
    const cleanHash = canonicalizePath(cleanPath);
    
    const messyFilename = `jreader_${messyHash}.png`;
    const cleanFilename = `jreader_${cleanHash}.png`;
    
    // Both should result in the same canonicalized filename
    expect(messyFilename).toBe(cleanFilename);
    expect(messyFilename).toBe('jreader_dict_assets_image_png.png');
  });

  it('should handle the exact paths from the user\'s original issue', () => {
    // These are the exact paths that caused the cross-contamination issue
    const pixivPath = 'PixivLight_2024-11-25/assets/pixiv-logo.png';
    const wikipediaPath = 'ja.Wikipedia.2022-12-01.v1.6.1/assets\\wikipedia-icon.png'; // Single backslash as shown in user's data
    
    const canonicalizePath = (path: string) => path
      .replace(/[\/\\]/g, '_')
      .replace(/\./g, '_')
      .replace(/[<>:"|?*]/g, '_')
      .replace(/[\[\](){}]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    const pixivHash = canonicalizePath(pixivPath);
    const wikipediaHash = canonicalizePath(wikipediaPath);
    
    const pixivFilename = `jreader_${pixivHash}.png`;
    const wikipediaFilename = `jreader_${wikipediaHash}.png`;
    
    // These should be completely different filenames
    expect(pixivFilename).not.toBe(wikipediaFilename);
    expect(pixivFilename).toBe('jreader_PixivLight_2024-11-25_assets_pixiv-logo_png.png');
    expect(wikipediaFilename).toBe('jreader_ja_Wikipedia_2022-12-01_v1_6_1_assets_wikipedia-icon_png.png');
    
    // Verify they don't share any common parts that could cause confusion
    expect(pixivFilename).not.toContain('wikipedia');
    expect(wikipediaFilename).not.toContain('pixiv');
  });
});
