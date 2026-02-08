'use client'

import { RefreshCw, CheckCircle, XCircle, AlertCircle, Settings } from "lucide-react"

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

export function AutoSyncButton() {
  const { autoSyncEnabled, setAutoSyncEnabled } = useAutoSync();
  const { healthStatus, checkAnkiHealth, isChecking } = useAnkiHealth();
  const { extensionStatus } = useExtension();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-4">
        <div className="space-y-4">
          <div className="pt-2 border-t">
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
                    <button
                      onClick={checkAnkiHealth}
                      disabled={isChecking}
                      className="p-1 hover:bg-muted rounded"
                      title="Refresh AnkiConnect status"
                    >
                      <RefreshCw className={`h-3 w-3 ${isChecking ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {healthStatus.available ? (
                    healthStatus.configured ? (
                      <>
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span className="text-green-600">Connected & Configured</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3 text-yellow-500" />
                        <span className="text-yellow-600">Connected but not configured</span>
                      </>
                    )
                  ) : (
                    <>
                      <XCircle className="h-3 w-3 text-red-500" />
                      <span className="text-red-600">Not connected</span>
                    </>
                  )}
                </div>
              </div>
            )}
            
            {/* Extension Status */}
            <div className="text-xs text-muted-foreground">
              Extension: {extensionStatus.available ? (
                extensionStatus.paired ? (
                  <span className="text-green-600">Connected</span>
                ) : (
                  <span className="text-yellow-600">Available but not paired</span>
                )
              ) : (
                <span className="text-red-600">Not available</span>
              )}
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
