'use client'

import { PartyPopper, User } from "lucide-react"

import { useSubscription } from "@/hooks/useSubscription"

interface TierIndicatorProps {
  className?: string
  showLabel?: boolean
  variant?: 'default' | 'compact'
}

export function TierIndicator({ className = "", showLabel = true, variant = 'default' }: TierIndicatorProps) {
  const { data: subscriptionData, isLoading } = useSubscription()
  
  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="h-4 w-4 rounded-full bg-muted animate-pulse" />
        {showLabel && <span className="text-xs text-muted-foreground">Loading...</span>}
      </div>
    )
  }

  const tier = subscriptionData?.tier || 0

  const getTierInfo = () => {
    switch (tier) {
      case 0:
        return {
          icon: User,
          label: 'Community',
          color: 'bg-muted text-muted-foreground',
          iconColor: 'text-muted-foreground'
        }
      case 1:
        return {
          icon: PartyPopper,
          label: 'Supporter',
          color: 'bg-accent text-accent-foreground',
          iconColor: 'text-accent-foreground'
        }
      default:
        return {
          icon: User,
          label: 'Community',
          color: 'bg-muted text-muted-foreground',
          iconColor: 'text-muted-foreground'
        }
    }
  }

  const tierInfo = getTierInfo()
  const IconComponent = tierInfo.icon

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <IconComponent className={`h-3 w-3 ${tierInfo.iconColor}`} />
        {showLabel && (
          <span className={`text-xs font-medium ${tierInfo.color} px-1.5 py-0.5 rounded-full`}>
            {tierInfo.label}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <IconComponent className={`h-4 w-4 ${tierInfo.iconColor}`} />
      {showLabel && (
        <span className={`text-xs font-medium ${tierInfo.color} px-2 py-1 rounded-full`}>
          {tierInfo.label}
        </span>
      )}
    </div>
  )
}
