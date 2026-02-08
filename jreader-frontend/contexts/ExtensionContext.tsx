'use client'
import type { ContentScriptEventExtensionAvailabilityCheckResponse} from '@jreader/shared-types-ts/extensionAvailability';
import { CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK_RESPONSE, CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK, CONTENT_SCRIPT_EVENT_EXTENSION_STATUS_CHANGED, ExtensionAvailabilityKind } from '@jreader/shared-types-ts/extensionAvailability'
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react'

interface ExtensionStatus {
  available: boolean | null
  paired: boolean | null
}

interface ExtensionContextType {
  extensionStatus: ExtensionStatus
  checkExtension: () => Promise<void>
  isChecking: boolean
}

const ExtensionContext = createContext<ExtensionContextType | undefined>(undefined)

interface ExtensionProviderProps {
  children: ReactNode
}

export function ExtensionProvider({ children }: ExtensionProviderProps) {
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus>({
    available: null,
    paired: null
  })
  const [isChecking, setIsChecking] = useState(false)

  const checkExtension = async () => {
    console.log('🔍 [ExtensionContext]: Checking extension status')
    setIsChecking(true)

    try {
      // Send extension availability check message (must match extension constant)
      const checkMessage = { type: CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK }
      window.postMessage(checkMessage, window.location.origin)

      // Wait for response
      const response = await new Promise<{ available: boolean; paired: boolean }>((resolve) => {
        let responded = false
        const handleResponse = (event: MessageEvent) => {
          console.log('🔍 [ExtensionContext]: Received response from extension:', event)
          if (event.origin !== window.location.origin) return

          if (event.data?.type === CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK_RESPONSE) {
            const contentScriptEventExtensionAvailabilityCheckResponse = event.data as ContentScriptEventExtensionAvailabilityCheckResponse;
            console.log(`[ExtensionContext] checkExtension.handleExtensionResponse; got response, extensionAvailability=${JSON.stringify(contentScriptEventExtensionAvailabilityCheckResponse.extensionAvailability)}`);
            console.log(`[ExtensionContext] CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK_RESPONSE - Got ${JSON.stringify(contentScriptEventExtensionAvailabilityCheckResponse)}`);
            responded = true
            window.removeEventListener('message', handleResponse)
            // TODO: Handle all cases, or directly set this in resolve() so we can display all cases differently in the UI
            const available =
              contentScriptEventExtensionAvailabilityCheckResponse.extensionAvailability.kind ===
              ExtensionAvailabilityKind.AVAILABLE_AUTH;
            resolve({
              available,
              // TODO: Remove this legacy field
              paired: available
            })
          }
        }

        window.addEventListener('message', handleResponse)

        // Timeout after 2 seconds
        setTimeout(() => {
          if (!responded) {
            window.removeEventListener('message', handleResponse)
            console.log("[ExtensionContext] Timed out requesting status from extension...");
            resolve({ available: false, paired: false })
          }
        }, 2000)
      })

      setExtensionStatus(response)
    } catch (error) {
      console.error('Error checking extension:', error)
      setExtensionStatus({ available: false, paired: false })
    } finally {
      setIsChecking(false)
    }
  }

  // Check extension status on mount
  useEffect(() => {
    checkExtension()
  }, [])

  // Listen for extension status changes (when user logs in/out via extension)
  useEffect(() => {
    const handleStatusChange = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return

      if (event.data?.type === CONTENT_SCRIPT_EVENT_EXTENSION_STATUS_CHANGED) {
        console.log('🔄 [ExtensionContext] Extension status changed, re-checking...')
        checkExtension()
      }
    }

    window.addEventListener('message', handleStatusChange)

    return () => {
      window.removeEventListener('message', handleStatusChange)
    }
  }, [])

  return (
    <ExtensionContext.Provider value={{
      extensionStatus,
      checkExtension,
      isChecking
    }}>
      {children}
    </ExtensionContext.Provider>
  )
}

export function useExtension() {
  const context = useContext(ExtensionContext)
  if (context === undefined) {
    throw new Error('useExtension must be used within an ExtensionProvider')
  }
  return context
}
