'use client'

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState } from 'react'

interface AutoSyncContextType {
  autoSyncEnabled: boolean
  setAutoSyncEnabled: (enabled: boolean) => void
}

const AutoSyncContext = createContext<AutoSyncContextType | undefined>(undefined)

interface AutoSyncProviderProps {
  children: ReactNode
  initialValue?: boolean
}

export function AutoSyncProvider({ children, initialValue = true }: AutoSyncProviderProps) {
  // Get initial value from localStorage if available, otherwise use prop
  const getInitialValue = () => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('autoSyncEnabled')
        if (stored !== null) {
          return stored === 'true'
        }
      } catch (error) {
        console.warn('Failed to read from localStorage:', error)
      }
    }
    return initialValue
  }
  
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState(getInitialValue)
  
  // Wrapper function that also saves to localStorage
  const setAutoSyncEnabled = (enabled: boolean) => {
    setAutoSyncEnabledState(enabled)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('autoSyncEnabled', enabled.toString())
      } catch (error) {
        console.warn('Failed to save to localStorage:', error)
      }
    }
  }

  return (
    <AutoSyncContext.Provider value={{ autoSyncEnabled, setAutoSyncEnabled }}>
      {children}
    </AutoSyncContext.Provider>
  )
}

export function useAutoSync() {
  const context = useContext(AutoSyncContext)
  if (context === undefined) {
    throw new Error('useAutoSync must be used within an AutoSyncProvider')
  }
  return context
}
