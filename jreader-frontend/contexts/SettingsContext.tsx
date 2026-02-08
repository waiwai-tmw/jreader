'use client'

import type { DropResult } from '@hello-pangea/dnd'
import { createContext, useContext } from 'react'

interface SettingsContextType {
  fontSize: number
  verticalMargin: number
  preferences: {
    dictionaryOrder: string[]
    disabledDictionaries: string[]
    spoilerDictionaries: string[]
    freqDictionaryOrder: string[]
    freqDisabledDictionaries: string[]
    shouldHighlightKanjiInSearch?: boolean
    shouldHighlightKanjiInText?: boolean
  } | null
  updateSetting: (type: 'fontSize' | 'verticalMargin' | 'einkMode', value: number | boolean) => void
  onDragEnd: (result: DropResult) => Promise<void>
  toggleSpoiler: (dict: string) => void
  toggleFrequencyDictionary: (dict: { title: string, revision: string }) => Promise<void>
  toggleKanjiHighlightingInSearch: () => Promise<void>
  toggleKanjiHighlightingInText: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextType | null>(null)

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}

export const SettingsProvider = SettingsContext.Provider 