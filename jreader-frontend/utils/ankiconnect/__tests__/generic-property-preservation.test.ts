import { extractTextFromDefinition } from '@/utils/ankiconnect/definitionProcessing';

describe('Generic Property Preservation', () => {
  it('should preserve all image properties including alt, width, height, verticalAlign, and data attributes', () => {
    const imagePaths: string[] = [];
    const dictionaryNames: string[] = [];
    
    const imageContent = {
      "alt": "pixiv",
      "collapsed": false,
      "collapsible": false,
      "height": 1,
      "path": "assets/pixiv-logo.png",
      "sizeUnits": "em",
      "tag": "img",
      "verticalAlign": "middle",
      "width": 1,
      "style": {
        "marginBottom": "0.5em"
      },
      "data": {
        "pixiv": "logo"
      }
    };
    
    const result = extractTextFromDefinition(imageContent, imagePaths, dictionaryNames, "PixivLight_2024-11-25");
    
    // Check that all properties are preserved
    expect(result).toContain('alt="pixiv"');
    expect(result).toContain('data-collapsed="false"');
    expect(result).toContain('data-collapsible="false"');
    expect(result).toContain('data-pixiv="logo"');
    expect(result).toContain('style=');
    expect(result).toContain('margin-bottom: 0.5em');
    expect(result).toContain('height: 1em');
    expect(result).toContain('width: 1em');
    expect(result).toContain('vertical-align: middle');
    // Calculate the hash for "PixivLight_2024-11-25"
    const pixivHash = 'PixivLight_2024-11-25'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    expect(result).toContain(`src="ANKI_IMAGE_PLACEHOLDER_${pixivHash}_0"`);
    expect(result).toContain('<img');
    expect(result).toContain('/>');
    
    // Check that image path was collected
    expect(imagePaths).toContain('PixivLight_2024-11-25/assets/pixiv-logo.png');
    expect(dictionaryNames).toContain('PixivLight_2024-11-25');
  });

  it('should preserve all link properties including href, title, and data attributes', () => {
    const linkContent = {
      "tag": "a",
      "href": "https://dic.pixiv.net/a/魚",
      "title": "Read more on Pixiv",
      "content": "pixivで読む",
      "style": {
        "color": "blue",
        "textDecoration": "underline"
      },
      "data": {
        "pixiv": "read-more-link"
      }
    };
    
    const result = extractTextFromDefinition(linkContent);
    
    expect(result).toContain('href="https://dic.pixiv.net/a/魚"');
    expect(result).toContain('title="Read more on Pixiv"');
    expect(result).toContain('data-pixiv="read-more-link"');
    expect(result).toContain('style="color: blue; text-decoration: underline;"');
    expect(result).toContain('pixivで読む');
    expect(result).toContain('<a');
    expect(result).toContain('</a>');
  });

  it('should preserve all span properties including title and data attributes', () => {
    const spanContent = {
      "tag": "span",
      "title": "Tooltip text",
      "content": "Some text",
      "style": {
        "fontWeight": "bold",
        "color": "red"
      },
      "data": {
        "custom": "value",
        "another": "attribute"
      }
    };
    
    const result = extractTextFromDefinition(spanContent);
    
    expect(result).toContain('title="Tooltip text"');
    expect(result).toContain('data-custom="value"');
    expect(result).toContain('data-another="attribute"');
    expect(result).toContain('style="font-weight: bold; color: red;"');
    expect(result).toContain('Some text');
    expect(result).toContain('<span');
    expect(result).toContain('</span>');
  });

  it('should handle boolean attributes correctly', () => {
    const content = {
      "tag": "input",
      "type": "checkbox",
      "checked": true,
      "disabled": false,
      "required": true
    };
    
    const result = extractTextFromDefinition(content);
    
    expect(result).toContain('type="checkbox"');
    expect(result).toContain('checked'); // Boolean true should appear as attribute
    expect(result).toContain('required'); // Boolean true should appear as attribute
    expect(result).not.toContain('disabled'); // Boolean false should not appear
    expect(result).toContain('<input');
    expect(result).toContain('/>');
  });

  it('should handle unknown tags generically', () => {
    const customContent = {
      "tag": "custom-element",
      "customAttr": "customValue",
      "anotherAttr": 123,
      "content": "Custom content",
      "style": {
        "customStyle": "value"
      },
      "data": {
        "customData": "dataValue"
      }
    };
    
    const result = extractTextFromDefinition(customContent);
    
    expect(result).toContain('customAttr="customValue"');
    expect(result).toContain('anotherAttr="123"');
    expect(result).toContain('style="custom-style: value;"');
    expect(result).toContain('data-customData="dataValue"');
    expect(result).toContain('Custom content');
    expect(result).toContain('<custom-element');
    expect(result).toContain('</custom-element>');
  });

  it('should handle nested structures with all properties preserved', () => {
    const nestedContent = {
      "tag": "div",
      "style": { "marginBottom": "1em" },
      "data": { "container": "true" },
      "content": [
        {
          "tag": "span",
          "title": "Nested span",
          "content": "Nested text",
          "style": { "color": "green" },
          "data": { "nested": "value" }
        }
      ]
    };
    
    const result = extractTextFromDefinition(nestedContent);
    
    // Check outer div
    expect(result).toContain('style="margin-bottom: 1em;"');
    expect(result).toContain('data-container="true"');
    
    // Check inner span
    expect(result).toContain('title="Nested span"');
    expect(result).toContain('data-nested="value"');
    expect(result).toContain('style="color: green;"');
    expect(result).toContain('Nested text');
    
    // Check structure
    expect(result).toContain('<div');
    expect(result).toContain('</div>');
    expect(result).toContain('<span');
    expect(result).toContain('</span>');
  });
});
