export const isIOS = (): boolean => {
  if (typeof window === 'undefined') return false;

  const ua = navigator.userAgent || navigator.vendor || "";

  // iPhone and iPod
  if (/iPhone|iPod/.test(ua)) return true;

  // Old iPads (pre-iPadOS 13) — userAgent includes "iPad"
  if (/iPad/.test(ua)) return true;

  // iPadOS 13+ pretends to be Mac, but still has touch support
  if (/Macintosh/.test(ua) && "ontouchend" in document) {
    return true;
  }

  return false;
};

export const isSafari = (): boolean => {
  if (typeof window === 'undefined') return false;

  const ua = navigator.userAgent || navigator.vendor || '';
  const isSafariUA =
    /Safari\//.test(ua) &&
    !/Chrome|Chromium|OPR|Edg|Brave|Vivaldi|Firefox|SamsungBrowser/i.test(ua);

  // On iOS/iPadOS, all browsers use Safari engine (WebKit),
  // so this also detects WebView Safari.
  const isIOSWebKit = /AppleWebKit/.test(ua) && /Mobile\//.test(ua);

  return isSafariUA || isIOSWebKit;
};
