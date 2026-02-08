'use client'

import { useTheme } from 'next-themes';
import React, { createContext, useContext, useState, useEffect } from 'react';

type EinkModeContextType = {
  isEinkMode: boolean;
  toggleEinkMode: () => void;
  setEinkMode: (enabled: boolean) => void;
};

const EinkModeContext = createContext<EinkModeContextType | undefined>(undefined);

export function EinkModeProvider({ children }: { children: React.ReactNode }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  
  const [isEinkMode, setIsEinkMode] = useState(() => {
    // Check localStorage on initialization
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('global-einkMode');
      return saved === 'true';
    }
    return false;
  });

  // Apply e-ink mode to document when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (isEinkMode) {
        document.documentElement.classList.add('eink-mode');
      } else {
        document.documentElement.classList.remove('eink-mode');
      }
    }
  }, [isEinkMode]);

  // Persist to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('global-einkMode', String(isEinkMode));
    }
  }, [isEinkMode]);



  const toggleEinkMode = () => {
    const newEinkMode = !isEinkMode;
    setIsEinkMode(newEinkMode);
    
    // Handle theme switching when enabling e-ink mode
    if (newEinkMode && theme && resolvedTheme) {
      const currentTheme = theme === 'system' ? resolvedTheme : theme;
      
      // Auto-switch to appropriate theme for e-ink mode
      if (currentTheme === 'solarized-light') {
        setTheme('light');
      } else if (currentTheme === 'solarized-dark' || currentTheme === 'asuka') {
        setTheme('dark');
      }
      // Light and Dark themes are already compatible, no change needed
    }
  };
  
  const setEinkMode = (enabled: boolean) => {
    setIsEinkMode(enabled);
    
    // Handle theme switching when enabling e-ink mode
    if (enabled && theme && resolvedTheme) {
      const currentTheme = theme === 'system' ? resolvedTheme : theme;
      
      // Auto-switch to appropriate theme for e-ink mode
      if (currentTheme === 'solarized-light') {
        setTheme('light');
      } else if (currentTheme === 'solarized-dark' || currentTheme === 'asuka') {
        setTheme('dark');
      }
      // Light and Dark themes are already compatible, no change needed
    }
  };

  return (
    <EinkModeContext.Provider value={{ isEinkMode, toggleEinkMode, setEinkMode }}>
      {children}
    </EinkModeContext.Provider>
  );
}

export function useEinkMode() {
  const context = useContext(EinkModeContext);
  if (context === undefined) {
    throw new Error('useEinkMode must be used within an EinkModeProvider');
  }
  return context;
}
