'use client'

import { Blocks } from 'lucide-react'
import React from 'react'

import { ExtensionInfoCard } from './ExtensionInfoCard'

import { useExtension } from '@/contexts/ExtensionContext'
import { cn } from '@/lib/utils'


interface ExtensionIndicatorProps {
  className?: string
}

export function ExtensionIndicator({ className }: ExtensionIndicatorProps) {
  const { extensionStatus, isChecking } = useExtension()

  // Only log on status changes, not every render
  React.useEffect(() => {
    console.log('🎨 [ExtensionIndicator] Status changed:', extensionStatus, 'isChecking:', isChecking)
  }, [extensionStatus.available, extensionStatus.paired, isChecking])

  const getStatusInfo = () => {
    if (extensionStatus.available === null) {
      return {
        color: "text-muted-foreground animate-pulse",
        title: "Checking extension status...",
        state: "checking"
      }
    }

    if (!extensionStatus.available) {
      return {
        color: "text-muted-foreground",
        title: "JReader Extension Not Available",
        state: "unavailable"
      }
    }

    return {
      color: "text-green-500",
      title: "JReader Extension Active & Authenticated",
      state: "paired"
    }
  }

  const statusInfo = getStatusInfo()

  return (
    <ExtensionInfoCard>
      <div className={cn("flex items-center", className)} title={statusInfo.title}>
        <Blocks
          className={cn("h-4 w-4", statusInfo.color)}
        />
      </div>
    </ExtensionInfoCard>
  )
}
