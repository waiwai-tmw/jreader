'use client'

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react'

import { useAutoSync } from './AutoSyncContext'
import { useExtension } from './ExtensionContext'

import { EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH, EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH_RESPONSE } from '@/types/events'

interface AnkiHealthStatus {
  available: boolean
  configured: boolean
  error?: string
  lastChecked?: Date
  checking: boolean
}

interface AnkiHealthContextType {
  healthStatus: AnkiHealthStatus
  checkAnkiHealth: () => Promise<void>
  isChecking: boolean
}

const AnkiHealthContext = createContext<AnkiHealthContextType | undefined>(undefined)

interface AnkiHealthProviderProps {
  children: ReactNode
}

export function AnkiHealthProvider({ children }: AnkiHealthProviderProps) {
  console.log('[AnkiHealth] Initializing provider');
  // Initialize with checking: true since we'll do a health check right away
  const [healthStatus, setHealthStatus] = useState<AnkiHealthStatus>({
    available: false,
    configured: false,
    checking: true
  })
  
  // Get auto-sync context to auto-disable when AnkiConnect becomes unavailable
  const { autoSyncEnabled, setAutoSyncEnabled } = useAutoSync()
  
  // Get extension context to check extension status
  const { extensionStatus } = useExtension()
  
  // Track if this is the first health check to avoid showing toast on page refresh
  const [isFirstCheck, setIsFirstCheck] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('autoSyncEnabled')
      return stored !== 'true' // If auto-sync was enabled, this is likely a refresh
    }
    return true
  })
  
  // We don't need to track disabled state anymore - we just check if Anki is available and enable/disable accordingly

  // Update auto-sync state when health status changes
  useEffect(() => {
    console.log('[AnkiHealth] Health status changed. Current state:', {
      autoSyncEnabled,
      healthStatus
    });

    // If health check is complete, update auto-sync state based on Anki availability
    if (!healthStatus.checking) {
      if (healthStatus.available && healthStatus.configured) {
        // Anki is available, enable auto-sync
        setAutoSyncEnabled(true);
      } else {
        // Anki is not available, disable auto-sync
        setAutoSyncEnabled(false);
      }
    }
  }, [healthStatus.available, healthStatus.configured, healthStatus.checking])

  const checkAnkiHealth = async () => {
    // Set health status to checking
    setHealthStatus(prev => ({ ...prev, checking: true }));
    
    try {
      // Wait for extension status to be initialized
      if (extensionStatus.available === null || extensionStatus.paired === null) {
        // Extension status not ready yet, keep checking state
        return;
      }

      // Check if extension is available (but authentication is not required for health check)
      if (!extensionStatus.available) {
        // Extension is not available - disable auto-sync
        if (autoSyncEnabled) {
          setAutoSyncEnabled(false);
        }

        setHealthStatus({
          available: false,
          configured: false,
          error: 'Extension not available',
          checking: false
        })
        setIsFirstCheck(false)
        return
      }

      // Note: We don't check extensionStatus.paired here because AnkiConnect
      // health check should work regardless of JReader authentication status.
      // The extension can ping AnkiConnect even if user isn't signed in.
      
      // Extension is available, now check AnkiConnect health
      const healthCheckMessage = { type: EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH }
      window.postMessage(healthCheckMessage, window.location.origin)
      
      const healthResponse = await new Promise<{ available: boolean; configured: boolean; error?: string }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Health check timeout'))
        }, 5000)
        
        const handleMessage = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return
          
          if (event.data?.type === EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH_RESPONSE) {
            clearTimeout(timeout)
            window.removeEventListener('message', handleMessage)
            resolve(event.data)
          }
        }
        
        window.addEventListener('message', handleMessage)
      })
      
      const newHealthStatus = {
        available: healthResponse.available,
        configured: healthResponse.configured,
        error: healthResponse.error,
        lastChecked: new Date(),
        checking: false
      }
      
      setHealthStatus(newHealthStatus)
      
      // Handle extension context invalidation from the extension response
      if (healthResponse.error && healthResponse.error.includes('Extension was reloaded')) {
        if (typeof window !== 'undefined' && window.location.pathname !== '/ext-auth') {
          const { toast } = await import('sonner')
          toast.warning('Extension was reloaded', {
            description: 'Please refresh the page to reconnect with the extension.',
            action: {
              label: 'Refresh',
              onClick: () => window.location.reload()
            }
          })
        }
      }
      
      // Mark that the first check is complete
      if (isFirstCheck) {
        setIsFirstCheck(false)
      }
      
      // Auto-sync state will be updated by the useEffect when health status changes
      
    } catch (error) {
      console.error('Error checking Anki health:', error)
      
      // Handle extension context invalidation specifically
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const isExtensionReloaded = errorMessage.includes('Extension was reloaded')
      
      const errorStatus = {
        available: false,
        configured: false,
        error: errorMessage,
        checking: false
      }
      
      setHealthStatus(errorStatus)
      
      // Reload page if extension was reloaded
      if (isExtensionReloaded && typeof window !== 'undefined') {
        window.location.reload()
      }
      
      // Mark that the first check is complete
      if (isFirstCheck) {
        setIsFirstCheck(false)
      }
      
      // Auto-disable auto-sync only if health check fails due to connectivity issues
      const isConnectivityError = errorMessage.includes('Failed to fetch') || 
                                  errorMessage.includes('Network error') ||
                                  errorMessage.includes('Connection refused') ||
                                  errorMessage.includes('timeout') ||
                                  errorMessage.includes('ECONNREFUSED');
      
      if (isConnectivityError && autoSyncEnabled) {
        console.log('[AnkiHealth] Disabling auto-sync due to connectivity failure. Current state:', {
          autoSyncEnabled,
          healthStatus,
          errorMessage
        })
        
        // Capture the current state before we change it
        const wasEnabled = autoSyncEnabled
        setAutoSyncEnabled(false)
        
        // Auto-sync state will be updated by the useEffect when health status changes
      }
    }
  }

  // Check health on mount (but not on ext-auth page)
  useEffect(() => {
    // Only run health checks in browser
    if (typeof window === 'undefined') {
      return
    }
    checkAnkiHealth()
  }, [])

  // Re-check health when extension status changes (but not on ext-auth page)
  useEffect(() => {
    // Only run health checks in browser
    if (typeof window === 'undefined') {
      return
    }
    if (extensionStatus.available !== null && extensionStatus.paired !== null) {
      checkAnkiHealth()
    }
  }, [extensionStatus.available, extensionStatus.paired])


  return (
    <AnkiHealthContext.Provider value={{ 
      healthStatus, 
      checkAnkiHealth,
      isChecking: healthStatus.checking
    }}>
      {children}
    </AnkiHealthContext.Provider>
  )
}

export function useAnkiHealth() {
  const context = useContext(AnkiHealthContext)
  if (context === undefined) {
    throw new Error('useAnkiHealth must be used within an AnkiHealthProvider')
  }
  return context
}
