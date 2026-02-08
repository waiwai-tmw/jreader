import { useState, useEffect } from 'react';

export const useDeviceDetect = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if window.matchMedia is available
    if (!window.matchMedia) return;

    // Use pointer:coarse to detect touch devices more reliably
    const isTouchDevice = window.matchMedia("(pointer:coarse)").matches;
    
    // Additional check for tablets/iPads specifically
    const isTablet = /iPad|tablet|Tablet|Pad/i.test(navigator.userAgent);
    
    setIsMobile(isTouchDevice || isTablet);

    // Optional: Add listener for changes (e.g., if someone connects/disconnects a touch screen)
    const mediaQuery = window.matchMedia("(pointer:coarse)");
    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches || isTablet);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}; 