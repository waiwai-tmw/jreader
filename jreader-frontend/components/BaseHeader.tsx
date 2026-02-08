'use client'

import { AutoSyncIndicator } from "@/components/AutoSyncIndicator"
import { ExtensionIndicator } from "@/components/ExtensionIndicator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/AuthContext"
import { useIsSafari } from "@/hooks/useIsSafari"
import { useShowExtensionComponents } from "@/hooks/useShowExtensionComponents"

interface BaseHeaderProps {
  title?: string;
  children?: React.ReactNode;
}

export function BaseHeader({ title, children }: BaseHeaderProps) {
  const { user } = useAuth();
  const isSafari = useIsSafari();

  // Use the custom hook to determine if extension components should be shown
  const showExtensionComponents = useShowExtensionComponents(user, isSafari);

  return (
    <header className="flex h-10 shrink-0 items-center gap-2 border-b z-[5] relative bg-background pr-2">
      <div className="flex items-center gap-2 px-2">
        <SidebarTrigger className="-ml-1" />
      </div>
      {title && (
        <div className="flex-1 flex items-center">
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>
      )}
      <div className="flex items-center gap-2">
        {showExtensionComponents && (
          <>
            <ExtensionIndicator />
            <AutoSyncIndicator />
          </>
        )}
        {children}
      </div>
    </header>
  )
} 