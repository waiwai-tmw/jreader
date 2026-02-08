import { useState, useEffect } from 'react';

import { isSafari } from '@/utils/deviceDetection';

export function useIsSafari(): boolean {
  const [safari, setSafari] = useState(false);

  useEffect(() => {
    setSafari(isSafari());
  }, []);

  return safari;
}
