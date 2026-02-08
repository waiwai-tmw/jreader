export function applySettings(doc: Document, fontSize: number, verticalMargin: number, theme: string = 'light') {
  console.log('🎨 applySettings called:', { fontSize, verticalMargin, theme });

  const style = doc.createElement('style');
  style.setAttribute('data-reader-settings', 'true');

  // Get the actual color values based on the theme
  let backgroundColor, textColor, linkColor, borderColor;
  
  if (theme === 'asuka') {
    backgroundColor = 'hsl(0 100% 15%)'; // Asuka red background
    textColor = 'hsl(0 0% 95%)'; // Asuka foreground
    linkColor = 'hsl(0 100% 60%)'; // Asuka primary red
    borderColor = 'hsl(0 100% 20%)'; // Asuka border
  } else if (theme === 'solarized-dark') {
    backgroundColor = 'hsl(193 100% 10%)'; // Solarized Dark background
    textColor = 'hsl(193 10% 90%)'; // Solarized Dark foreground
    linkColor = 'hsl(193 10% 90%)'; // Solarized Dark primary
    borderColor = 'hsl(193 100% 15%)'; // Solarized Dark border
  } else if (theme === 'solarized-light') {
    backgroundColor = 'hsl(44 100% 97%)'; // Solarized Light background
    textColor = 'hsl(44 10% 20%)'; // Solarized Light foreground
    linkColor = 'hsl(44 10% 20%)'; // Solarized Light primary
    borderColor = 'hsl(44 20% 85%)'; // Solarized Light border
  } else if (theme === 'dark') {
    backgroundColor = 'hsl(0 0% 0%)'; // Pure black background
    textColor = 'hsl(0 0% 95%)'; // Light gray text
    linkColor = 'hsl(0 0% 95%)'; // Light gray links
    borderColor = 'hsl(0 0% 15%)'; // Very dark gray borders
  } else {
    // Light theme (default)
    backgroundColor = 'hsl(0 0% 100%)'; // Light background
    textColor = 'hsl(222.2 84% 4.9%)'; // Light foreground
    linkColor = 'hsl(222.2 47.4% 11.2%)'; // Light primary
    borderColor = 'hsl(214.3 31.8% 91.4%)'; // Light border
  }

  const cssContent = `
    :root {
      font-size: ${fontSize}em;
      /* Set actual color values instead of CSS variables */
      --epub-background: ${backgroundColor};
      --epub-foreground: ${textColor};
      --epub-text-color: ${textColor};
      --epub-link-color: ${linkColor};
      --epub-border-color: ${borderColor};
    }
    html {
      background-color: ${backgroundColor} !important;
      color: ${textColor} !important;
    }
    body {
      padding: ${verticalMargin}vh 0;
      margin: 0;
      background-color: ${backgroundColor} !important;
      color: ${textColor} !important;
    }
    /* Override any existing background/foreground colors */
    * {
      color: inherit;
    }
    /* Ensure text elements use theme colors */
    p, div, span, h1, h2, h3, h4, h5, h6, pre, code, blockquote {
      color: ${textColor} !important;
    }
    /* Style links */
    a {
      color: ${linkColor} !important;
    }
    /* Style images and SVGs */
    img, svg {
      max-height: 90vh;
      max-width: 100%;
      width: auto;
      height: auto;
      display: block;
      margin: 1em auto;
    }
    svg image {
      max-height: inherit;
      max-width: inherit;
    }
    /* Override any hardcoded colors in the EPUB */
    [style*="color: black"], [style*="color: #000"], [style*="color: #000000"],
    [style*="color: rgb(0,0,0)"], [style*="color: rgb(0, 0, 0)"] {
      color: ${textColor} !important;
    }
    [style*="background-color: white"], [style*="background-color: #fff"], [style*="background-color: #ffffff"],
    [style*="background-color: rgb(255,255,255)"], [style*="background-color: rgb(255, 255, 255)"] {
      background-color: ${backgroundColor} !important;
    }
    /* Handle tables and other elements */
    table {
      border-color: ${borderColor} !important;
    }
    td, th {
      border-color: ${borderColor} !important;
      color: ${textColor} !important;
    }
    /* Override any existing CSS classes that might have hardcoded colors */
    .text-black, .text-dark, .dark-text {
      color: ${textColor} !important;
    }
    .bg-white, .bg-light, .light-bg {
      background-color: ${backgroundColor} !important;
    }
    /* Handle any EPUB-specific styling */
    .epub-content, .book-content, .chapter-content {
      background-color: ${backgroundColor} !important;
      color: ${textColor} !important;
    }
    /* Override any inline styles that might override our theme */
    [style*="background"] {
      background-color: ${backgroundColor} !important;
    }
    [style*="color"] {
      color: ${textColor} !important;
    }
  `;
  
  style.textContent = cssContent;
  
  const existingStyle = doc.querySelector('style[data-reader-settings]');
  if (existingStyle) {
    console.log('🔄 Removing existing reader settings style');
    existingStyle.remove();
  }
  
  doc.head.appendChild(style);
  console.log('✅ applySettings completed, style injected into document head');
  console.log('📄 Document head now contains:', doc.head.innerHTML.length, 'characters');
}

export function injectSettings(content: string, fontSize: number, verticalMargin: number, theme: string = 'light'): string {
  console.log('🎨 injectSettings called:', { fontSize, verticalMargin, theme, contentLength: content.length });

  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');

  console.log('📄 Parsed document:', {
    hasHead: !!doc.head,
    hasBody: !!doc.body,
    headLength: doc.head?.innerHTML.length || 0,
    bodyLength: doc.body?.innerHTML.length || 0
  });

  applySettings(doc, fontSize, verticalMargin, theme);

  const result = new XMLSerializer().serializeToString(doc);
  console.log('✅ injectSettings completed, result length:', result.length);

  return result;
}