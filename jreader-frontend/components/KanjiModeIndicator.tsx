'use client'

import { useKanjiMode } from '@/contexts/KanjiModeContext'

export function KanjiModeIndicator() {
  const { isKanjiMode, toggleKanjiMode } = useKanjiMode()

  return (
    <span 
      onClick={toggleKanjiMode}
      className={`
        w-12 h-6 text-xs font-mono font-bold
        border rounded cursor-pointer
        transition-colors flex items-center justify-center
        hover:opacity-80
        ${isKanjiMode 
          ? 'bg-yellow-100 dark:bg-yellow-900 border-yellow-200 dark:border-yellow-800 text-yellow-900 dark:text-yellow-100' 
          : 'border-border text-muted-foreground'
        }
      `}
    >
      {isKanjiMode ? 'KANJI' : 'READ'}
    </span>
  )
} 