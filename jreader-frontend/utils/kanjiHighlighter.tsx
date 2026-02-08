import React from 'react';

import { KanjiInfoCard } from '@/components/KanjiInfoCard';
import { KanjiState, kanjiStateToClass } from '@/utils/kanjiState';

interface KanjiHighlighter {
    wrapKanji: (node: Text) => void;
    knownKanji: Set<string>;
    encounteredKanji: Set<string>;
  }
  
  export function createKanjiHighlighter(knownKanji: string[], encounteredKanji: string[], shouldHighlight: boolean = true) {
    const knownSet = new Set(knownKanji);
    const encounteredSet = new Set(encounteredKanji);
  
    return {
      wrapKanji(textNode: Text) {
        const text = textNode.textContent || '';
        const container = textNode.parentElement;
        if (!container) return;
  
        // Find the parent container (paragraph or any block element)
        const paragraph = container.closest('p') || container.closest('div') || container.closest('body') || container;
        if (!paragraph) return;
  
        // Get the full text content of the paragraph
        let fullText = '';
        const walker = document.createTreeWalker(
          paragraph,
          NodeFilter.SHOW_TEXT,
          null
        );
        let node;
        while (node = walker.nextNode()) {
          // Skip ruby readings (rt elements)
          if (!node.parentElement?.closest('rt')) {
            fullText += node.textContent;
          }
        }
  
        const fragments: string[] = [];
        // Calculate the offset of this text node within the paragraph
        let offset = 0;
        const precedingWalker = document.createTreeWalker(
          paragraph,
          NodeFilter.SHOW_TEXT,
          null
        );
        while ((node = precedingWalker.nextNode()) !== textNode) {
          if (!node.parentElement?.closest('rt')) {
            offset += node.textContent?.length || 0;
          }
        }
  
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const position = offset + i;
          
          // Find sentence boundaries around this position
          let sentenceStart = position;
          let sentenceEnd = position + 1;
  
          // Look backwards for sentence start (。.!?、「」)
          while (sentenceStart > 0) {
            const prevChar = fullText[sentenceStart - 1];
            if ('。.!?、「'.includes(prevChar)) {
              break;
            }
            sentenceStart--;
          }
  
          // Look forwards for sentence end
          while (sentenceEnd < fullText.length) {
            const nextChar = fullText[sentenceEnd];
            if ('。.!?、」'.includes(nextChar)) {
              sentenceEnd++;
              break;
            }
            sentenceEnd++;
          }
  
          const sentenceText = fullText.slice(sentenceStart, sentenceEnd);
          const relativePosition = position - sentenceStart;
          
          if (/[\u4e00-\u9faf]/.test(char)) {
            // Kanji handling
            if (shouldHighlight) {
              let state: KanjiState;
              if (knownSet.has(char)) {
                state = KanjiState.KNOWN;
              } else if (encounteredSet.has(char)) {
                state = KanjiState.ENCOUNTERED;
              } else {
                state = KanjiState.NOT_MINED;
              }
              fragments.push(`<span class="kanji-${kanjiStateToClass(state)} cursor-pointer" data-kanji="${char}" data-text="${sentenceText}" data-position="${relativePosition}">${char}</span>`);
            } else {
              // No highlighting, but keep click functionality
              fragments.push(`<span class="cursor-pointer" data-kanji="${char}" data-text="${sentenceText}" data-position="${relativePosition}">${char}</span>`);
            }
          } else if (/[\u3040-\u309f\u30a0-\u30ff]/.test(char)) {
            // Hiragana and Katakana
            fragments.push(`<span class="char-wrapper" data-text="${sentenceText}" data-position="${relativePosition}">${char}</span>`);
          } else {
            // Other characters
            fragments.push(`<span data-text="${sentenceText}" data-position="${relativePosition}">${char}</span>`);
          }
        }
  
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = fragments.join('');
        while (tempDiv.firstChild) {
          container.insertBefore(tempDiv.firstChild, textNode);
        }
        textNode.remove();
      }
    };
  }

export function highlightKanjiInText(
  text: string, 
  knownKanji: string[], 
  encounteredKanji: string[],
  preserveClickHandlers: boolean = false
): React.ReactNode {
  const knownSet = new Set(knownKanji);
  const encounteredSet = new Set(encounteredKanji);

  // Split text into segments that are either Japanese or non-Japanese
  const segments = text.split(/([^\u0000-\u007F]+)/g);

  return segments.map((segment, index) => {
    const isJapanese = /[^\u0000-\u007F]/.test(segment);
    
    if (isJapanese) {
      return (
        <span key={index}>
          {[...segment].map((char, charIndex) => {
            if (/[\u4e00-\u9faf]/.test(char)) {
              // Kanji handling
              let state: KanjiState;
              if (knownSet.has(char)) {
                state = KanjiState.KNOWN;
              } else if (encounteredSet.has(char)) {
                state = KanjiState.ENCOUNTERED;
              } else {
                state = KanjiState.NOT_MINED;
              }
              
              return (
                <KanjiInfoCard key={charIndex} kanji={char}>
                  <span
                    className={`kanji-${kanjiStateToClass(state)} ${preserveClickHandlers ? 'cursor-pointer' : ''}`}
                    data-kanji={char}
                    onClick={preserveClickHandlers ? (e) => {
                      e.stopPropagation();
                      const scrollContainer = document.querySelector('.overflow-y-auto')
                      const scrollY = scrollContainer?.scrollTop || 0
                      console.log('💾(1) Saving scroll position:', scrollY)
                      
                      window.dispatchEvent(new CustomEvent('searchupdate', {
                        detail: {
                          text: segment,
                          position: charIndex,
                          shouldOpenDictionary: true,
                          fromTextPane: false,
                          scrollY
                        }
                      }));
                    } : undefined}
                  >
                    {char}
                  </span>
                </KanjiInfoCard>
              );
            } else if (/[\u3040-\u309f\u30a0-\u30ff]/.test(char)) {
              // Hiragana and Katakana
              return (
                <span 
                  key={charIndex} 
                  className={`char-wrapper ${preserveClickHandlers ? 'cursor-pointer' : ''}`}
                  onClick={preserveClickHandlers ? (e) => {
                    e.stopPropagation();
                    const scrollContainer = document.querySelector('.overflow-y-auto')
                    const scrollY = scrollContainer?.scrollTop || 0
                    console.log('💾(1) Saving scroll position:', scrollY)
                    
                    window.dispatchEvent(new CustomEvent('searchupdate', {
                      detail: {
                        text: segment,
                        position: charIndex,
                        shouldOpenDictionary: true,
                        fromTextPane: false,
                        scrollY
                      }
                    }));
                  } : undefined}
                >
                  {char}
                </span>
              );
            } else {
              // Other characters
              return (
                <span 
                  key={charIndex}
                  className={preserveClickHandlers ? 'cursor-pointer' : ''}
                  onClick={preserveClickHandlers ? (e) => {
                    e.stopPropagation();
                    const scrollContainer = document.querySelector('.overflow-y-auto')
                    const scrollY = scrollContainer?.scrollTop || 0
                    console.log('💾(1) Saving scroll position:', scrollY)
                    
                    window.dispatchEvent(new CustomEvent('searchupdate', {
                      detail: {
                        text: segment,
                        position: charIndex,
                        shouldOpenDictionary: true,
                        fromTextPane: false,
                        scrollY
                      }
                    }));
                  } : undefined}
                >
                  {char}
                </span>
              );
            }
          })}
        </span>
      );
    }
    
    // For non-Japanese text, preserve click handlers if requested
    if (preserveClickHandlers && segment.trim()) {
      return (
        <span
          key={index}
          className="cursor-pointer rounded px-0.5"
          onClick={(e) => {
            e.stopPropagation();
            const scrollContainer = document.querySelector('.overflow-y-auto')
            const scrollY = scrollContainer?.scrollTop || 0
            console.log('💾(2) Saving scroll position:', scrollY)
            const event = new CustomEvent('searchupdate', {
              detail: {
                text: segment,
                position: 0,
                shouldOpenDictionary: true,
                fromTextPane: false,
                scrollY
              }
            });
            window.dispatchEvent(event);
          }}
        >
          {segment}
        </span>
      );
    }
    
    return <span key={index}>{segment}</span>;
  });
}