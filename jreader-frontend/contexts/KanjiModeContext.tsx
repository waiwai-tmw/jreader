'use client'

import React, { createContext, useContext, useState, useEffect } from 'react';

import { debug } from '@/utils/debug';

type KanjiModeContextType = {
  isKanjiMode: boolean;
  toggleKanjiMode: () => void;
};

const KanjiModeContext = createContext<KanjiModeContextType | undefined>(undefined);

export function KanjiModeProvider({ children }: { children: React.ReactNode }) {
  const [isKanjiMode, setIsKanjiMode] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Alt' || event.key === 'Option' || event.keyCode === 18) {
        event.preventDefault();
        event.stopPropagation();
        setIsKanjiMode(prev => {
          const newState = !prev;
          debug(`Toggled Kanji mode to: ${newState ? 'KANJI' : 'READ'}`);
          return newState;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const toggleKanjiMode = () => setIsKanjiMode(prev => !prev);

  return (
    <KanjiModeContext.Provider value={{ isKanjiMode, toggleKanjiMode }}>
      {children}
    </KanjiModeContext.Provider>
  );
}

export function useKanjiMode() {
  const context = useContext(KanjiModeContext);
  if (context === undefined) {
    throw new Error('useKanjiMode must be used within a KanjiModeProvider');
  }
  return context;
} 