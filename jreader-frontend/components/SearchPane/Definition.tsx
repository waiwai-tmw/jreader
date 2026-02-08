import React, { useState, useEffect } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import type { Definition } from '@/types/backend-types';
import { highlightKanjiInText } from '@/utils/kanjiHighlighter';

// Component for loading images with signed URLs
export function SignedImage({
  path,
  width,
  height,
  verticalAlign
}: {
  path: string;
  width?: string;
  height?: string;
  verticalAlign?: string;
}) {
  const { user } = useAuth();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Skip API call if user is not logged in
    if (!user) {
      setError(true);
      return;
    }

    const loadSignedUrl = async () => {
      try {
        const response = await fetch(`/api/sign-image-url?path=${encodeURIComponent(path)}`);
        if (!response.ok) {
          throw new Error('Failed to get signed URL');
        }
        const { url } = await response.json();
        setImageUrl(url);
      } catch (err) {
        console.error('🖼️ Failed to load signed image URL:', err);
        setError(true);
      }
    };

    loadSignedUrl();
  }, [path, user]);

  if (error) {
    // Hide icon/logo images completely when not logged in (pixiv, wikipedia icons, etc.)
    if (path.includes('-icon.png') || path.includes('-logo.png')) {
      return null;
    }

    return (
      <div
        style={{
          width: width || 'auto',
          height: height || 'auto',
          maxWidth: '200px',
          maxHeight: '200px',
          backgroundColor: '#f3f4f6',
          border: '1px solid #d1d5db',
          borderRadius: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          color: '#6b7280'
        }}
        data-testid="image-error"
      >
        Log in to view image
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div
        style={{
          width: width || 'auto',
          height: height || 'auto',
          backgroundColor: '#f3f4f6',
          borderRadius: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div
          className="w-4 h-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"
          data-testid="loading-spinner"
        />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt=""
      data-testid="signed-image"
      style={{
        width: width || undefined,
        height: height || undefined,
        verticalAlign: verticalAlign || undefined,
        backgroundColor: 'white',
        padding: '2px',
        borderRadius: '2px',
      }}
    />
  );
}

type DefinitionViewProps = {
  definition: Definition,
  dictionaryOrigin: string,
  knownKanji?: string[],
  encounteredKanji?: string[]
}

export function DefinitionView(viewProps: DefinitionViewProps) {
    // console.log('Definition object:', viewProps.definition);
    // console.log('Dictionary origin:', viewProps.dictionaryOrigin);

    const renderText = (text: string) => {
      // Use kanji highlighting if kanji states are provided
      if (viewProps.knownKanji && viewProps.knownKanji.length > 0 ||
          viewProps.encounteredKanji && viewProps.encounteredKanji.length > 0) {
        return highlightKanjiInText(text, viewProps.knownKanji || [], viewProps.encounteredKanji || [], true);
      }

      // Fallback to original behavior
      const segments = text.split(/([^\u0000-\u007F]+)/g);

      return segments.map((segment, index) => {
        const isJapanese = /[^\u0000-\u007F]/.test(segment);

        if (isJapanese) {
          return (
            <span
              key={index}
              className="cursor-pointer rounded px-0.5"
            >
              {[...segment].map((char, charIndex) => (
                <span
                  key={charIndex}
                  onClick={(e) => {
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
                        scrollY  // Add scroll position to existing event
                      }
                    }));
                  }}
                  className="cursor-pointer"
                >
                  {char}
                </span>
              ))}
            </span>
          );
        }
        return <span key={index}>{segment}</span>;
      });
    };

    const renderStructuredContent = (content: any): React.ReactNode => {
      if (typeof content === 'string') {
        return renderText(content);
      }

      if (Array.isArray(content)) {
        return content.map((item, index) => (
          <React.Fragment key={index}>
            {renderStructuredContent(item)}
          </React.Fragment>
        ));
      }

      if (typeof content === 'object') {
        const {
          tag = 'span',
          content: innerContent,
          style = {},
          data = {},
          href,
          path,
        } = content;

        // Special handling for all table-related tags
        if (tag === 'table' || tag === 'tbody' || tag === 'thead' || tag === 'tr') {
          return (
            <div
              style={{
                ...style,
                display: 'flex',
                flexDirection: 'column',
                gap: tag === 'tr' ? '0.5rem' : '0',
                alignItems: tag === 'tr' ? 'center' : 'stretch'
              }}
            >
              {innerContent && renderStructuredContent(innerContent)}
            </div>
          );
        }

        if (tag === 'td' || tag === 'th') {
          return (
            <div style={style}>
              {innerContent && renderStructuredContent(innerContent)}
            </div>
          );
        }

        // Add special handling for lists to prevent invalid nesting
        if (tag === 'li') {
          const props: any = {
            className: '',
            style,
          };
          return (
            <ul className="list-none m-0 p-0">
              <li {...props}>
                {innerContent && renderStructuredContent(innerContent)}
              </li>
            </ul>
          );
        }

        const TagName = tag as keyof JSX.IntrinsicElements;
        const props: any = {
          className: '',
          style,
        };

        // Modify the style object if it's a Wikipedia term-specifier
        if (data.wikipedia === 'term-specifier') {
          props.style = {
            ...style,
            fontSize: '1rem',
            color: '#e5007f'
          };
        } else if (data.wikipedia === 'abstract') {
          props.style = {
            ...style,
            marginTop: '0.5rem',
            color: 'var(--tw-prose-body)'
          };
        } else if (data.wikipedia === 'footer') {
          props.style = {
            ...style,
            marginTop: '0.5rem',
            fontSize: '0.875rem',
            color: 'var(--tw-prose-captions)',
            textAlign: 'right'
          };
        }

        // Handle special cases for tags
        if (tag === 'img') {
          // Normalize Windows backslashes to forward slashes
          const normalizedPath = path.replace(/\\/g, '/');
          const imagePath = `${viewProps.dictionaryOrigin}/${normalizedPath}`;
          return (
            <SignedImage
              path={imagePath}
              width={content.width ? `${content.width}em` : undefined}
              height={content.height ? `${content.height}em` : undefined}
              verticalAlign={content.verticalAlign}
            />
          );
        }

        if (tag === 'a' && href) {
          props.href = href;
          props.target = "_blank";
          props.rel = "noopener noreferrer";
        }

        return (
          <TagName {...props}>
            {innerContent && renderStructuredContent(innerContent)}
          </TagName>
        );
      }

      return null;
    };

    // Check if we have structured content
    if (viewProps.definition.type === 'structured' && viewProps.definition.content !== '') {
      try {
        const structuredContent = JSON.parse(viewProps.definition.content);
        return (
          <div className="structured-definition">
            {renderStructuredContent(structuredContent)}
          </div>
        );
      } catch (e) {
        console.error('Failed to parse structured content:', e);
        return (
          <div>
            <span className="font-medium">{viewProps.definition.type}:</span>
            <span className="ml-2">{renderText(viewProps.definition.content)}</span>
          </div>
        );
      }
    }

    return <div>{renderText(viewProps.definition.content)}</div>;
  }

export function DefinitionText({
  text,
  knownKanji = [],
  encounteredKanji = [],
  preserveClickHandlers = true
}: {
  text: string | undefined;
  knownKanji?: string[];
  encounteredKanji?: string[];
  preserveClickHandlers?: boolean;
}) {
    if (!text) return null;

    // Use kanji highlighting if kanji states are provided
    if (knownKanji.length > 0 || encounteredKanji.length > 0) {
        return (
            <span>
                {highlightKanjiInText(text, knownKanji, encounteredKanji, preserveClickHandlers)}
            </span>
        );
    }

    // Fallback to original behavior if no kanji states
    const segments = text.split(/([^\u0000-\u007F]+)/g);

    return (
        <span>
        {segments.map((segment, index) => {
            // Check if segment contains Japanese characters
            const isJapanese = /[^\u0000-\u007F]/.test(segment);

            if (isJapanese) {
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
                        scrollY  // Add scroll position to existing event
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
        })}
        </span>
    );
}
