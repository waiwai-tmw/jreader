import { transformEpubContent, normalizeWritingModeCSS } from '../EpubContentTransformer';

  describe('normalizeWritingModeCSS function', () => {
    it('should normalize -epub-writing-mode to include standard writing-mode', () => {
      const inputCSS = `
        body {
          -epub-writing-mode: vertical-rl;
          text-orientation: mixed;
        }
      `;

      const result = normalizeWritingModeCSS(inputCSS);

      expect(result).toContain('-epub-writing-mode: vertical-rl');
      expect(result).toContain('writing-mode: vertical-rl');
      expect(result).toContain('text-orientation: mixed');
    });

    it('should normalize -webkit-writing-mode to include standard writing-mode', () => {
      const inputCSS = `
        body {
          -webkit-writing-mode: vertical-rl;
          text-orientation: mixed;
        }
      `;

      const result = normalizeWritingModeCSS(inputCSS);

      expect(result).toContain('-webkit-writing-mode: vertical-rl');
      expect(result).toContain('writing-mode: vertical-rl');
    });

    it('should apply writing-mode to both html and body when only body is specified', () => {
      const inputCSS = `
        body {
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }
      `;

      const result = normalizeWritingModeCSS(inputCSS);

      expect(result).toContain('html, body {');
      expect(result).toContain('writing-mode: vertical-rl');
      expect(result).toContain('text-orientation: mixed');
    });

    it('should not duplicate html selector if it already exists', () => {
      const inputCSS = `
        html, body {
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }
      `;

      const result = normalizeWritingModeCSS(inputCSS);

      const htmlBodyMatches = (result.match(/html,\s*body\s*{/g) || []).length;
      expect(htmlBodyMatches).toBe(1);
    });

    it('should handle multiple vendor-prefixed properties in the same rule', () => {
      const inputCSS = `
        body {
          -epub-writing-mode: vertical-rl;
          -webkit-writing-mode: vertical-rl;
          text-orientation: mixed;
        }
      `;

      const result = normalizeWritingModeCSS(inputCSS);

      expect(result).toContain('-epub-writing-mode: vertical-rl');
      expect(result).toContain('-webkit-writing-mode: vertical-rl');
      expect(result).toContain('writing-mode: vertical-rl');
    });

    it('should not modify CSS without writing-mode properties', () => {
      const inputCSS = `
        body {
          font-size: 16px;
          line-height: 1.5;
          color: black;
        }
      `;

      const result = normalizeWritingModeCSS(inputCSS);

      expect(result).not.toContain('writing-mode:');
      expect(result).not.toContain('-epub-writing-mode:');
      expect(result).not.toContain('-webkit-writing-mode:');
    });

    it('should handle CSS with comments and complex selectors', () => {
      const inputCSS = `
        /* Japanese book styles */
        body, .content {
          -epub-writing-mode: vertical-rl;
          text-orientation: mixed;
        }
        
        .chapter {
          margin: 1em;
        }
      `;

      const result = normalizeWritingModeCSS(inputCSS);

      expect(result).toContain('-epub-writing-mode: vertical-rl');
      expect(result).toContain('writing-mode: vertical-rl');
      expect(result).toContain('text-orientation: mixed');
      expect(result).toContain('/* Japanese book styles */');
    });
  });

  describe('transformEpubContent integration', () => {
    const mockGetSignedUrl = jest.fn().mockResolvedValue('https://example.com/mock-url');
    const mockSupabaseUploadId = 'test-book-123';

    beforeEach(() => {
      jest.clearAllMocks();
    });

      describe('Integration with transformEpubContent', () => {
    it('should normalize -epub-writing-mode to include standard writing-mode', async () => {
      const inputCSS = `
        body {
          -epub-writing-mode: vertical-rl;
          text-orientation: mixed;
        }
      `;

      const inputHTML = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <p>縦書きテスト</p>
  </body>
</html>`;

      // Mock the fetch for the CSS file
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(inputCSS)
      });

      const result = await transformEpubContent(
        inputHTML,
        mockSupabaseUploadId,
        mockGetSignedUrl,
        'test-path.xhtml'
      );

      // Check that the normalized CSS includes both vendor-prefixed and standard properties
      expect(result.content).toContain('-epub-writing-mode: vertical-rl');
      expect(result.content).toContain('writing-mode: vertical-rl');
      expect(result.content).toContain('text-orientation: mixed');
    });

    it('should normalize -webkit-writing-mode to include standard writing-mode', async () => {
      const inputCSS = `
        body {
          -webkit-writing-mode: vertical-rl;
          text-orientation: mixed;
        }
      `;

      const inputHTML = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <p>縦書きテスト</p>
  </body>
</html>`;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(inputCSS)
      });

      const result = await transformEpubContent(
        inputHTML,
        mockSupabaseUploadId,
        mockGetSignedUrl,
        'test-path.xhtml'
      );

      expect(result.content).toContain('-webkit-writing-mode: vertical-rl');
      expect(result.content).toContain('writing-mode: vertical-rl');
    });

    it('should apply writing-mode to both html and body when only body is specified', async () => {
      const inputCSS = `
        body {
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }
      `;

      const inputHTML = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <p>縦書きテスト</p>
  </body>
</html>`;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(inputCSS)
      });

      const result = await transformEpubContent(
        inputHTML,
        mockSupabaseUploadId,
        mockGetSignedUrl,
        'test-path.xhtml'
      );

      // Should have both html and body selectors
      expect(result.content).toContain('html, body {');
      expect(result.content).toContain('writing-mode: vertical-rl');
      expect(result.content).toContain('text-orientation: mixed');
    });

    it('should not duplicate html selector if it already exists', async () => {
      const inputCSS = `
        html, body {
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }
      `;

      const inputHTML = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <p>縦書きテスト</p>
  </body>
</html>`;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(inputCSS)
      });

      const result = await transformEpubContent(
        inputHTML,
        mockSupabaseUploadId,
        mockGetSignedUrl,
        'test-path.xhtml'
      );

      // Should not add duplicate html selectors
      const htmlBodyMatches = (result.content.match(/html,\s*body\s*{/g) || []).length;
      expect(htmlBodyMatches).toBe(1);
    });

    it('should handle multiple vendor-prefixed properties in the same rule', async () => {
      const inputCSS = `
        body {
          -epub-writing-mode: vertical-rl;
          -webkit-writing-mode: vertical-rl;
          text-orientation: mixed;
        }
      `;

      const inputHTML = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <p>縦書きテスト</p>
  </body>
</html>`;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(inputCSS)
      });

      const result = await transformEpubContent(
        inputHTML,
        mockSupabaseUploadId,
        mockGetSignedUrl,
        'test-path.xhtml'
      );

      // Should have all three writing-mode properties
      expect(result.content).toContain('-epub-writing-mode: vertical-rl');
      expect(result.content).toContain('-webkit-writing-mode: vertical-rl');
      expect(result.content).toContain('writing-mode: vertical-rl');
    });

    it('should not modify CSS without writing-mode properties', async () => {
      const inputCSS = `
        body {
          font-size: 16px;
          line-height: 1.5;
          color: black;
        }
      `;

      const inputHTML = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <p>Horizontal text</p>
  </body>
</html>`;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(inputCSS)
      });

      const result = await transformEpubContent(
        inputHTML,
        mockSupabaseUploadId,
        mockGetSignedUrl,
        'test-path.xhtml'
      );

      // Should not add any writing-mode properties
      expect(result.content).not.toContain('writing-mode:');
      expect(result.content).not.toContain('-epub-writing-mode:');
      expect(result.content).not.toContain('-webkit-writing-mode:');
    });

    it('should handle CSS with comments and complex selectors', async () => {
      const inputCSS = `
        /* Japanese book styles */
        body, .content {
          -epub-writing-mode: vertical-rl;
          text-orientation: mixed;
        }
        
        .chapter {
          margin: 1em;
        }
      `;

      const inputHTML = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <p>縦書きテスト</p>
  </body>
</html>`;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(inputCSS)
      });

      const result = await transformEpubContent(
        inputHTML,
        mockSupabaseUploadId,
        mockGetSignedUrl,
        'test-path.xhtml'
      );

      expect(result.content).toContain('-epub-writing-mode: vertical-rl');
      expect(result.content).toContain('writing-mode: vertical-rl');
      expect(result.content).toContain('text-orientation: mixed');
      expect(result.content).toContain('/* Japanese book styles */');
    });
  });

    describe('Error handling', () => {
    it('should handle CSS fetch errors gracefully', async () => {
      const inputHTML = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <p>Test content</p>
  </body>
</html>`;

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await transformEpubContent(
        inputHTML,
        mockSupabaseUploadId,
        mockGetSignedUrl,
        'test-path.xhtml'
      );

      // Should still return valid content even if CSS fetch fails
      expect(result.content).toContain('<html');
      expect(result.content).toContain('<body>');
    });
  });
});
