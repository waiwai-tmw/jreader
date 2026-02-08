/**
 * Definition processing utilities for converting structured definitions to HTML
 * and extracting image paths for Anki sync.
 */

/**
 * Formats a list of dictionary entries into Yomitan-style HTML
 * @param entries Array of dictionary entries with type, content, and dictionary properties
 * @returns Object with HTML string and image path information
 */
function formatDictionaryEntriesToYomitan(entries: any[]): { html: string; imagePaths: string[]; dictionaryNames: string[]; imagePathsWithDictionary: Array<{path: string, dictionary: string, index: number}> } {
  if (!entries || entries.length === 0) {
    return { html: '', imagePaths: [], dictionaryNames: [], imagePathsWithDictionary: [] };
  }

  const allImagePaths: string[] = [];
  const allDictionaryNames: string[] = [];
  const imagePathsWithDictionary: Array<{path: string, dictionary: string, index: number}> = [];
  const listItems: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    if (typeof entry === 'object' && entry !== null) {
      if (entry.type === 'structured' && entry.content) {
        // If content is a JSON string, parse it first
        let contentToProcess = entry.content;
        if (typeof entry.content === 'string' && (entry.content.trim().startsWith('[') || entry.content.trim().startsWith('{'))) {
          try {
            contentToProcess = JSON.parse(entry.content);
          } catch (parseError) {
            contentToProcess = entry.content;
          }
        }
        
        const imagePaths: string[] = [];
        const dictionaryNames: string[] = [];
        // Use dictionary_origin for image paths (for filename logic)
        const dictionaryForImages = entry.dictionary_origin || entry.dictionary || 'unknown';
        const html = extractTextFromDefinition(contentToProcess, imagePaths, dictionaryNames, dictionaryForImages);
        
        // Collect image paths and dictionary names
        allImagePaths.push(...imagePaths);
        allDictionaryNames.push(...dictionaryNames);
        
        // Collect image paths with dictionary information (use origin for image paths)
        imagePaths.forEach((path, index) => {
          imagePathsWithDictionary.push({
            path,
            dictionary: dictionaryForImages,
            index: index
          });
        });
        
        // Create list item with Yomitan format (use title for display)
        const dictionaryForDisplay = entry.dictionary_title || entry.dictionary || 'unknown';
        const listItem = dictionaryForDisplay ? `<li data-dictionary="${dictionaryForDisplay}"><i>${dictionaryForDisplay}</i> ${html}</li>` : `<li>${html}</li>`;
        listItems.push(listItem);
        
      } else if (entry.type === 'simple' && entry.content) {
        // Simple definition
        const dictionaryForDisplay = entry.dictionary_title || entry.dictionary || 'unknown';
        const listItem = dictionaryForDisplay ? `<li data-dictionary="${dictionaryForDisplay}"><i>${dictionaryForDisplay}</i> ${entry.content}</li>` : `<li>${entry.content}</li>`;
        listItems.push(listItem);
      }
    } else if (typeof entry === 'string' && entry.trim()) {
      // Simple string definition
      const listItem = `<li>${entry.trim()}</li>`;
      listItems.push(listItem);
    }
  }

  // Wrap all list items in Yomitan-style container
  const html = listItems.length > 0 ? `<div style="text-align: left;" class="yomitan-glossary"><ol>${listItems.join('')}</ol></div>` : '';
  
  return { html, imagePaths: allImagePaths, dictionaryNames: allDictionaryNames, imagePathsWithDictionary };
}

// Helper function to convert style object to CSS string
export function objectToStyleString(styleObj: any): string {
  if (!styleObj || typeof styleObj !== 'object') return '';
  
  return Object.entries(styleObj)
    .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
    .join('; ') + ';';
}

/**
 * Builds HTML attributes from content object properties
 * Handles all properties generically without hardcoding
 */
function buildAttributesFromContent(content: any, imagePaths: string[] = [], dictionaryNames: string[] = [], currentDictionary: string = ''): string {
  const attributes: string[] = [];
  
  // Handle special properties that need custom logic
  const specialProperties = ['tag', 'content', 'data', 'style'];
  
  // Process all properties except special ones
  Object.entries(content).forEach(([key, value]) => {
    if (specialProperties.includes(key)) {
      return; // Skip special properties, they're handled separately
    }
    
    // Handle different property types
    if (value !== null && value !== undefined && value !== '') {
      if (key === 'path' && content.tag === 'img') {
        // Special handling for image src - use placeholder
        handleImageSrc(value as string, imagePaths, dictionaryNames, currentDictionary);
        const imageIndex = imagePaths.length - 1;
        // Use per-dictionary placeholder to avoid cross-contamination
        // currentDictionary should be the origin (directory name) for consistent hashing
        const dictHash = currentDictionary ? currentDictionary.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36) : 'unknown';
        attributes.push(`src="ANKI_IMAGE_PLACEHOLDER_${dictHash}_${imageIndex}"`);
      } else if (key === 'href' && content.tag === 'a') {
        // Handle href attribute
        attributes.push(`href="${value}"`);
      } else if (key === 'title') {
        // Handle title attribute
        attributes.push(`title="${value}"`);
      } else if (key === 'alt' && content.tag === 'img') {
        // Handle alt attribute for images
        attributes.push(`alt="${value}"`);
      } else if (key === 'width' || key === 'height') {
        // Handle width/height - convert to style if sizeUnits is present
        const sizeUnits = content.sizeUnits || 'px';
        const styleKey = key === 'width' ? 'width' : 'height';
        const styleValue = `${value}${sizeUnits}`;
        
        // Add to style object if it doesn't exist
        if (!content.style) {
          content.style = {};
        }
        content.style[styleKey] = styleValue;
      } else if (key === 'sizeUnits') {
        // Skip sizeUnits as it's handled with width/height
        return;
      } else if (key === 'verticalAlign') {
        // Handle verticalAlign - convert to style
        if (!content.style) {
          content.style = {};
        }
        content.style['vertical-align'] = value;
      } else if (key === 'collapsed' || key === 'collapsible') {
        // Handle data attributes
        attributes.push(`data-${key}="${value}"`);
      } else if (typeof value === 'boolean') {
        // Handle boolean attributes
        if (value) {
          attributes.push(key);
        }
      } else if (typeof value === 'string' || typeof value === 'number') {
        // Handle regular attributes
        attributes.push(`${key}="${value}"`);
      }
    }
  });
  
  // Handle style object
  if (content.style && typeof content.style === 'object') {
    const styleString = objectToStyleString(content.style);
    if (styleString) {
      attributes.push(`style="${styleString}"`);
    }
  }
  
  // Handle data object
  if (content.data && typeof content.data === 'object') {
    Object.entries(content.data).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        attributes.push(`data-${key}="${value}"`);
      }
    });
  }
  
  return attributes.length > 0 ? ' ' + attributes.join(' ') : '';
}

/**
 * Handles image src processing for Anki sync
 */
function handleImageSrc(imagePath: string, imagePaths: string[] = [], dictionaryNames: string[] = [], currentDictionary: string = ''): void {
  if (imagePath) {
    // Add image path with dictionary name to collection for later processing
    // currentDictionary should be the origin (directory name) for image path logic
    const fullImagePath = currentDictionary ? `${currentDictionary}/${imagePath}` : imagePath;
    imagePaths.push(fullImagePath);
    dictionaryNames.push(currentDictionary);
    console.log('🖼️ DEBUG: Added image path to collection:', fullImagePath, 'dictionary:', currentDictionary, 'imagePaths now:', imagePaths);
  }
}

// Helper function to extract text from structured definition content and collect image paths
export function extractTextFromDefinition(content: any, imagePaths: string[] = [], dictionaryNames: string[] = [], currentDictionary: string = ''): string {
  console.log('extractTextFromDefinition called with:', content);
  console.log('Content type:', typeof content);
  
  if (typeof content === 'string') {
    console.log('Returning string:', content);
    return content;
  }
  
  if (Array.isArray(content)) {
    console.log('Processing array with', content.length, 'items');
    const result = content.map((item, index) => {
      console.log(`Processing array item ${index}:`, item);
      return extractTextFromDefinition(item, imagePaths, dictionaryNames, currentDictionary);
    }).join('');
    console.log('Array result:', result);
    return result;
  }
  
  if (content && typeof content === 'object') {
    const tag = content.tag || 'div';
    const innerContent = content.content ? extractTextFromDefinition(content.content, imagePaths, dictionaryNames, currentDictionary) : '';
    
    console.log(`Processing object with tag: ${tag}`);
    console.log('Inner content:', innerContent);
    console.log('Content object:', content);
    
    // Build attributes dynamically from all properties
    const attributes = buildAttributesFromContent(content, imagePaths, dictionaryNames, currentDictionary);
    
    // Handle self-closing tags
    const selfClosingTags = ['img', 'br', 'hr', 'input', 'meta', 'link'];
    const isSelfClosing = selfClosingTags.includes(tag);
    
    let result = '';
    if (isSelfClosing) {
      result = `<${tag}${attributes} />`;
    } else {
      result = `<${tag}${attributes}>${innerContent}</${tag}>`;
    }
    
    console.log(`Generated HTML for ${tag}:`, result);
    return result;
  }
  
  console.log('Unknown content type, returning empty string');
  return '';
}

// Helper function to extract main definition from structured definitions
export function getMainDefinition(definitions: any): { html: string; imagePaths: string[]; dictionaryNames: string[]; imagePathsWithDictionary: Array<{path: string, dictionary: string, index: number}> } {
  console.log('=== getMainDefinition DEBUG START ===');
  console.log('Input definitions:', definitions);
  console.log('Type of definitions:', typeof definitions);
  
  if (!definitions) {
    console.log('No definitions provided, returning empty result');
    return { html: '', imagePaths: [], dictionaryNames: [], imagePathsWithDictionary: [] };
  }
  
  try {
    let parsed;
    if (typeof definitions === 'string') {
      // Try to parse as JSON first
      try {
        parsed = JSON.parse(definitions);
        console.log('Successfully parsed as JSON');
      } catch (jsonError) {
        console.log('Failed to parse as JSON, treating as plain text');
        // If JSON parsing fails, treat the entire string as a single definition
        parsed = [definitions];
      }
    } else {
      parsed = definitions;
    }
    
    console.log('Parsed definitions:', parsed);
    console.log('Is array?', Array.isArray(parsed));
    console.log('Array length:', Array.isArray(parsed) ? parsed.length : 'N/A');
    
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Get the first item (index 0) for main definition
      const firstItem = parsed[0];
      console.log('First item for main definition:', firstItem);
      
      // Use the new formatter function with just the first item
      const result = formatDictionaryEntriesToYomitan([firstItem]);
      console.log('Generated HTML for main definition:', result.html);
      console.log('Extracted image paths:', result.imagePaths);
      console.log('Extracted dictionary names:', result.dictionaryNames);
      console.log('=== getMainDefinition DEBUG END ===');
      return result;
    }
    
    console.log('No definitions found, returning empty result');
    console.log('=== getMainDefinition DEBUG END ===');
    return { html: '', imagePaths: [], dictionaryNames: [], imagePathsWithDictionary: [] };
  } catch (error) {
    console.error('Error in getMainDefinition:', error);
    console.log('=== getMainDefinition DEBUG END ===');
    return { html: '', imagePaths: [], dictionaryNames: [], imagePathsWithDictionary: [] };
  }
}

// Helper function to extract glossary (all definitions) from structured definitions
export function getGlossary(definitions: any, fieldMappings: any): { html: string; imagePaths: string[]; dictionaryNames: string[]; imagePathsWithDictionary: Array<{path: string, dictionary: string, index: number}> } {
  console.log('=== getGlossary DEBUG START ===');
  console.log('Input definitions:', definitions);
  console.log('Field mappings:', fieldMappings);
  
  if (!definitions) {
    console.log('No definitions provided, returning empty result');
    return { html: '', imagePaths: [], dictionaryNames: [], imagePathsWithDictionary: [] };
  }
  
  try {
    let parsed;
    if (typeof definitions === 'string') {
      // Try to parse as JSON first
      try {
        parsed = JSON.parse(definitions);
        console.log('Successfully parsed as JSON');
      } catch (jsonError) {
        console.log('Failed to parse as JSON, treating as plain text');
        // If JSON parsing fails, treat the entire string as a single definition
        parsed = [definitions];
      }
    } else {
      parsed = definitions;
    }
    
    console.log('Parsed definitions:', parsed);
    console.log('Is array?', Array.isArray(parsed));
    console.log('Array length:', Array.isArray(parsed) ? parsed.length : 'N/A');
    
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.log('No definitions found, returning empty result');
      return { html: '', imagePaths: [], dictionaryNames: [], imagePathsWithDictionary: [] };
    }
    
    // We want to include all definitions in the glossary
    let definitionsToProcess = parsed;
    
    console.log('Definitions to process for glossary:', definitionsToProcess);
    
    // Use the new formatter function with all remaining definitions
    const result = formatDictionaryEntriesToYomitan(definitionsToProcess);
    console.log('Generated HTML for glossary:', result.html);
    console.log('Extracted image paths:', result.imagePaths);
    console.log('Extracted dictionary names:', result.dictionaryNames);
    console.log('=== getGlossary DEBUG END ===');
    return result;
    
  } catch (error) {
    console.error('Error in getGlossary:', error);
    console.log('=== getGlossary DEBUG END ===');
    return { html: '', imagePaths: [], dictionaryNames: [], imagePathsWithDictionary: [] };
  }
}
