export async function transformEpubContent(
  content: string, 
  supabase_upload_id: string, 
  getSignedUrl: (path: string) => Promise<string>,
  currentPath?: string
) {
  // Detect content type
  const isXHTML = content.includes('<?xml') || content.includes('xmlns="http://www.w3.org/1999/xhtml"');
  const contentType = isXHTML ? 'application/xhtml+xml' : 'text/html';
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, contentType);
  
  console.log('Original content structure:', content.slice(0, 500));
  
  // Get the directory path of the current file, with safety check
  const basePath = currentPath ? currentPath.split('/').slice(0, -1).join('/') : '';
  
  if (!currentPath) {
    console.log('Warning: No currentPath provided, URLs will be resolved from root');
  }
  
  // Preserve the html element's classes and attributes
  const htmlElement = doc.documentElement;
  const originalHtmlClass = htmlElement.getAttribute('class');
  const originalXmlLang = htmlElement.getAttribute('xml:lang');
  
  // Add base element to help resolve relative URLs
  const base = doc.createElement('base');
  const baseUrl = `${basePath}/`.replace(/\/+/g, '/'); // Normalize slashes
  base.href = baseUrl;
  
  // Ensure head exists before inserting base element
  if (!doc.head) {
    console.warn('⚠️ Document head is null, creating head element');
    const head = doc.createElement('head');
    doc.documentElement.insertBefore(head, doc.documentElement.firstChild);
  }
  doc.head.insertBefore(base, doc.head.firstChild);
  console.log('Added base URL:', baseUrl);
  
  function resolveRelativePath(base: string, relative: string): string {
    // Handle absolute paths
    if (relative.startsWith('/')) {
      return relative.slice(1);
    }
    
    // Handle relative paths
    const parts = base.split('/');
    parts.pop(); // Remove filename
    
    const relativeParts = relative.split('/');
    for (const part of relativeParts) {
      if (part === '..') {
        parts.pop();
      } else if (part !== '.') {
        parts.push(part);
      }
    }
    
    return parts.join('/');
  }

  // Handle stylesheets
  const links = doc.getElementsByTagName('link');
  console.log('🔍 Found stylesheet links:', Array.from(links).map(link => ({
    href: link.getAttribute('href'),
    rel: link.getAttribute('rel')
  })));

  async function processCssImports(cssContent: string, basePath: string, getSignedUrl: (path: string) => Promise<string>): Promise<string> {
    const importRegex = /@import\s+(?:url\()?\s*["']?([^"'\)]*)["']?\s*\)?;/g;
    let processedCss = cssContent;
    let match;

    while ((match = importRegex.exec(cssContent)) !== null) {
      const [fullMatch, importPath] = match;
      try {
        // Resolve the import path relative to the current CSS file
        const resolvedPath = resolveRelativePath(basePath, importPath);
        const signedUrl = await getSignedUrl(resolvedPath);
        
        // Process the CSS import
        
        // Replace the @import statement with one using the signed URL
        processedCss = processedCss.replace(
          fullMatch,
          `@import url("${signedUrl}");`
        );
        
        console.log('✅ Processed CSS import:', {
          original: importPath,
          resolved: resolvedPath,
          signed: signedUrl
        });
      } catch (error) {
        console.error('Failed to process CSS import:', importPath, error);
      }
    }

    return processedCss;
  }

  for (const link of Array.from(links)) {
    const href = link.getAttribute('href');
    if (href && link.getAttribute('rel') === 'stylesheet' && currentPath) {
      const resolvedPath = resolveRelativePath(currentPath, href);
      console.log('🔗 CSS Link resolution:', {
        currentPath,
        href,
        resolvedPath
      });
      try {
        const signedUrl = await getSignedUrl(resolvedPath);
        
        // Fetch and process the CSS content
        const response = await fetch(signedUrl);
        const cssContent = await response.text();
        
        // Process any @import statements in the CSS
        const processedCss = await processCssImports(cssContent, resolvedPath, getSignedUrl);
        
        // Normalize vendor-prefixed writing-mode properties for Firefox compatibility
        const normalizedCss = normalizeWritingModeCSS(processedCss);
        
        // Create a style element with the processed CSS
        const style = doc.createElement('style');
        style.setAttribute('type', 'text/css');
        style.setAttribute('data-source', resolvedPath);
        style.textContent = normalizedCss;
        
        // Replace the link with the inline style
        link.parentNode?.replaceChild(style, link);
        
        console.log('✅ Inlined and processed CSS:', {
          source: resolvedPath,
          importCount: (processedCss.match(/@import/g) || []).length
        });
      } catch (error) {
        console.warn('⚠️ Failed to process stylesheet:', resolvedPath, error);
        
        // Try alternative path if the original failed and it was an item/ path
        if (resolvedPath.startsWith('item/')) {
          const alternativePath = resolvedPath.replace('item/', '');
          console.log('🔄 Trying alternative path:', alternativePath);
          
          try {
            const signedUrl = await getSignedUrl(alternativePath);
            const response = await fetch(signedUrl);
            const cssContent = await response.text();
            const processedCss = await processCssImports(cssContent, alternativePath, getSignedUrl);
            const normalizedCss = normalizeWritingModeCSS(processedCss);
            
            const style = doc.createElement('style');
            style.setAttribute('type', 'text/css');
            style.setAttribute('data-source', alternativePath);
            style.textContent = normalizedCss;
            
            link.parentNode?.replaceChild(style, link);
            
            console.log('✅ Successfully loaded CSS with alternative path:', alternativePath);
          } catch (altError) {
            console.error('❌ Alternative path also failed:', alternativePath, altError);
            // Remove the broken link element
            link.remove();
          }
        } else {
          // Remove the broken link element
          link.remove();
        }
      }
    }
  }

  // Handle scripts
  const scripts = doc.getElementsByTagName('script');
  console.log('🔍 Found scripts:', Array.from(scripts).map(script => script.getAttribute('src')));

  for (const script of Array.from(scripts)) {
    const src = script.getAttribute('src');
    if (src && currentPath) {
      const resolvedPath = resolveRelativePath(currentPath, src);
      try {
        const signedUrl = await getSignedUrl(resolvedPath);
        script.setAttribute('src', signedUrl);
      } catch (error) {
        console.error('Failed to get signed URL for:', resolvedPath, error);
      }
    }
  }

  // Handle SVG image elements with xlink:href
  const svgImages = doc.getElementsByTagNameNS('http://www.w3.org/2000/svg', 'image');
  for (const img of Array.from(svgImages)) {
    const xlinkHref = img.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
    if (xlinkHref) {
      const absolutePath = new URL(xlinkHref, `fake://root/${basePath}/`).pathname.slice(1);
      const resourcePath = `${supabase_upload_id}/${absolutePath}`;
      
      try {
        const signedUrl = await getSignedUrl(resourcePath);
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', signedUrl);
      } catch (error) {
        console.error('Failed to get signed URL for SVG image:', resourcePath, error);
      }
    }
  }

  // Handle regular img elements
  const imgElements = doc.querySelectorAll('img[src]');
  for (const img of imgElements) {
    const src = img.getAttribute('src');
    if (src) {
      const absolutePath = new URL(src, `fake://root/${basePath}/`).pathname.slice(1);
      const resourcePath = `${supabase_upload_id}/${absolutePath}`;
      
      try {
        const signedUrl = await getSignedUrl(resourcePath);
        img.setAttribute('src', signedUrl);
      } catch (error) {
        console.error('Failed to get signed URL for image:', resourcePath, error);
      }
    }
  }

  console.log('Final document structure:', {
    head: Array.from(doc.head.children).map(child => ({
      tagName: child.tagName,
      id: child.id,
      className: child.className,
      type: child instanceof HTMLElement ? child.getAttribute('type') : null,
      isStyle: child instanceof HTMLStyleElement,
      textLength: child instanceof HTMLStyleElement ? child.textContent?.length : 0
    })),
    styles: Array.from(doc.getElementsByTagName('style')).map(style => ({
      textLength: style.textContent?.length || 0,
      firstChars: style.textContent?.slice(0, 50) + '...'
    }))
  });

  // Also log the final transformed content
  // console.log('Transformed content preview:', transformedContent.slice(0, 3000));

  // Ensure the html element retains its original attributes
  if (originalHtmlClass) {
    htmlElement.setAttribute('class', originalHtmlClass);
  }
  if (originalXmlLang) {
    htmlElement.setAttribute('xml:lang', originalXmlLang);
  }

  return {
    content: new XMLSerializer().serializeToString(doc),
    contentType
  };
}

/**
 * Normalize vendor-prefixed writing-mode properties for Firefox compatibility
 * Adds standard writing-mode properties alongside vendor-prefixed ones
 */
export function normalizeWritingModeCSS(css: string): string {
  // Handle -epub-writing-mode and -webkit-writing-mode
  // Add standard writing-mode property alongside vendor-prefixed ones
  let normalized = css;
  
  // Replace -epub-writing-mode with both -epub-writing-mode and writing-mode
  normalized = normalized.replace(
    /(-epub-writing-mode:\s*([^;]+);)/g,
    '$1\n  writing-mode: $2;'
  );
  
  // Replace -webkit-writing-mode with both -webkit-writing-mode and writing-mode
  normalized = normalized.replace(
    /(-webkit-writing-mode:\s*([^;]+);)/g,
    '$1\n  writing-mode: $2;'
  );
  
  // Ensure writing-mode is applied to html and body for Firefox
  // Look for writing-mode rules and duplicate them for html if they're only on body
  const writingModeRegex = /([^{]+)\s*{\s*[^}]*writing-mode\s*:\s*vertical-rl[^}]*}/g;
  normalized = normalized.replace(writingModeRegex, (match, selector) => {
    // If the selector doesn't include html, add it
    if (!selector.includes('html') && !selector.includes(':root')) {
      const htmlSelector = selector.trim().split(',').map((s: string) => 
        s.trim().startsWith('body') ? `html, ${s.trim()}` : s.trim()
      ).join(', ');
      return `${htmlSelector} {\n  writing-mode: vertical-rl;\n  text-orientation: mixed;\n}\n${match}`;
    }
    return match;
  });
  
  return normalized;
}
