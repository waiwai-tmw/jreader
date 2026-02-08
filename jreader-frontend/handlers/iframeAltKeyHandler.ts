export function attachIframeAltKeyHandler(iframeRef: React.RefObject<HTMLIFrameElement>) {
  if (!iframeRef.current) return;

  const handleIframeLoad = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;

    const handleAltKey = (event: KeyboardEvent) => {
      if (event.key === 'Alt' || event.key === 'Option' || event.keyCode === 18) {
        event.preventDefault();
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Alt',
          keyCode: 18,
          bubbles: true
        }));
      }
    };

    doc.addEventListener('keydown', handleAltKey, true);
    return () => doc.removeEventListener('keydown', handleAltKey, true);
  };

  iframeRef.current.addEventListener('load', handleIframeLoad);
  return () => iframeRef.current?.removeEventListener('load', handleIframeLoad);
} 