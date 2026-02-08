import { useState, useEffect } from 'react';

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function useIsIOS(): boolean {
  const [iOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(isIOS());
  }, []);

  return iOS;
}
