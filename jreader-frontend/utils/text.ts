import { debug } from './debug';

export function getClickedCharacterContext(element: Element, clickX: number, clickY: number) {
  // Find the paragraph or closest text container
  let container = element;
  while (container && !['p', 'div'].includes(container.tagName.toLowerCase())) {
    container = container.parentElement!;
  }
  if (!container) return null;

  // Try to get exact character using caretRangeFromPoint
  const doc = element.ownerDocument;
  const range = doc.caretRangeFromPoint(clickX, clickY);
  if (!range) {
    debug('Failed to get range from click point');
    return null;
  }

  debug(`Clicked on node type: ${range.startContainer.nodeType}`);
  debug(`Clicked text content: "${range.startContainer.textContent}"`);
  debug(`Clicked offset: ${range.startOffset}`);

  // Get the text content, replacing ruby elements with their base text
  const processTextContent = (el: Element): string => {
    let text = '';
    el.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        if (element.tagName.toLowerCase() === 'ruby') {
          // For ruby elements, skip the rt (reading) elements
          element.childNodes.forEach(rubyChild => {
            if (rubyChild.nodeType === Node.ELEMENT_NODE) {
              const rubyElement = rubyChild as Element;
              if (rubyElement.tagName.toLowerCase() !== 'rt') {
                text += rubyElement.textContent;
              }
            } else if (rubyChild.nodeType === Node.TEXT_NODE) {
              text += rubyChild.textContent;
            }
          });
        } else if (element.tagName.toLowerCase() !== 'rt') {
          text += processTextContent(element);
        }
      }
    });
    return text;
  };

  // Get the full text content of the container
  const fullText = processTextContent(container);
  debug(`Full paragraph text: ${fullText}`);

  // Find the clicked character's position
  let charIndex = -1;
  let clickedChar = '';

  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    // Direct text node click
    clickedChar = range.startContainer.textContent![range.startOffset];
    const textBefore = processTextContent(container).slice(0, fullText.indexOf(range.startContainer.textContent!) + range.startOffset);
    charIndex = textBefore.length;
  } else if (element.tagName.toLowerCase() === 'rt') {
    // Clicked on reading text, use the base character
    const rb = element.parentElement!.querySelector('rb');
    if (rb) {
      clickedChar = rb.textContent || '';
      charIndex = fullText.indexOf(clickedChar);
    }
  }

  debug(`Clicked character: "${clickedChar}" at index: ${charIndex}`);

  if (charIndex === -1) {
    debug('Failed to find character index');
    return null;
  }

  // Get the full sentence by looking for sentence boundaries
  let sentenceStart = charIndex;
  let sentenceEnd = charIndex;

  // Look backwards for sentence start (。.!?、「」)
  while (sentenceStart > 0) {
    const char = fullText[sentenceStart - 1];
    if ('。.!?、「'.includes(char)) break;
    sentenceStart--;
  }

  // Look forwards for sentence end
  while (sentenceEnd < fullText.length) {
    const char = fullText[sentenceEnd];
    if ('。.!?、」'.includes(char)) {
      sentenceEnd++;
      break;
    }
    sentenceEnd++;
  }

  const sentence = fullText.slice(sentenceStart, sentenceEnd);
  const positionInSentence = charIndex - sentenceStart;

  debug(`Found sentence: "${sentence}"`);
  debug(`Character position in sentence: ${positionInSentence}`);

  return {
    text: sentence,
    position: positionInSentence
  };
}

export function isJapaneseChar(char: string): boolean {
  return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/.test(char);
}

// Helper function to check if string contains kanji
export function containsKanji(text: string): boolean {
  return /[\u4E00-\u9FAF]/.test(text);
}