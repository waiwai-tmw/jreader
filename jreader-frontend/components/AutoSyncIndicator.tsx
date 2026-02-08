'use client'

import { Plug2, RefreshCw, CheckCircle, XCircle, AlertCircle, ChevronDown } from 'lucide-react'
import React from 'react'

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { useAnkiHealth } from '@/contexts/AnkiHealthContext'
import { useAutoSync } from '@/contexts/AutoSyncContext'
import { useExtension } from '@/contexts/ExtensionContext'
import { cn } from '@/lib/utils'

interface AutoSyncIndicatorProps {
  className?: string
}

export function AutoSyncIndicator({ className }: AutoSyncIndicatorProps) {
  const { healthStatus, checkAnkiHealth, isChecking } = useAnkiHealth()
  const { autoSyncEnabled, setAutoSyncEnabled } = useAutoSync()
  const { extensionStatus } = useExtension()

  const getStatusInfo = () => {
    if (healthStatus.checking) {
      return {
        color: "text-muted-foreground animate-pulse",
        title: "Checking AnkiConnect status...",
        state: "checking"
      }
    }

    if (!healthStatus.available || !healthStatus.configured) {
      return {
        color: "text-muted-foreground",
        title: "Auto-sync disabled - AnkiConnect not available",
        state: "unavailable"
      }
    }

    if (!autoSyncEnabled) {
      return {
        color: "text-red-500",
        title: "Auto-sync disabled",
        state: "disabled"
      }
    }

    return {
      color: "text-green-500",
      title: "Auto-sync enabled",
      state: "enabled"
    }
  }

  const statusInfo = getStatusInfo()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={cn("h-8 px-2 gap-1", className)} title={statusInfo.title}>
          <Plug2 className={cn("h-4 w-4", statusInfo.color)} />
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-4">
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm font-medium mb-3">
              <span>Auto-sync to Anki</span>
              <Switch
                checked={autoSyncEnabled}
                onCheckedChange={setAutoSyncEnabled}
                disabled={!extensionStatus.available || !extensionStatus.paired || !healthStatus.available || !healthStatus.configured}
              />
            </div>

            {/* AnkiConnect Status with Refresh Button - only show when extension is available and paired */}
            {extensionStatus.available && extensionStatus.paired && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">AnkiConnect Status:</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {isChecking ? (
                        <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                      ) : healthStatus.available ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : healthStatus.configured ? (
                        <XCircle className="h-3 w-3 text-red-500" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-yellow-500" />
                      )}
                      <span className={`text-xs ${
                        healthStatus.available ? 'text-green-600' :
                        healthStatus.configured ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        {isChecking ? 'Checking...' :
                         healthStatus.available ? 'Available' :
                         healthStatus.configured ? 'Unavailable' : 'Not configured'}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={checkAnkiHealth}
                      disabled={isChecking}
                      className="h-5 w-5 p-0"
                    >
                      <RefreshCw className={`h-3 w-3 ${isChecking ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>

                {healthStatus.error && (
                  <p className="text-xs text-red-500 mb-1">
                    {healthStatus.error}
                  </p>
                )}

                {healthStatus.lastChecked && (
                  <p className="text-xs text-muted-foreground">
                    Last checked: {healthStatus.lastChecked.toLocaleTimeString()}
                  </p>
                )}
              </div>
            )}

            {/* Description */}
            <p className="text-xs text-muted-foreground">
              {!extensionStatus.available ? "JReader extension is not available. Install the extension and keep Anki open with AnkiConnect to enable auto-sync" :
               !extensionStatus.paired ? "Extension is not paired. Pair the extension to enable auto-sync" :
               !healthStatus.configured ? "Configure AnkiConnect in extension settings to enable auto-sync" :
               !healthStatus.available ? "AnkiConnect is not running. Start Anki to enable auto-sync" :
               autoSyncEnabled
                ? "Cards will automatically sync to Anki after creation"
                : "Cards will be created locally. Use the extension to sync manually."}
            </p>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
