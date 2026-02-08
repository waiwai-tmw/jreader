'use client'

import { usePathname } from 'next/navigation'

import { AppSidebar } from '@/components/AppSidebar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { KanjiModeProvider } from '@/contexts/KanjiModeContext'

export function AppShell({ children, defaultOpen }: { children: React.ReactNode; defaultOpen: boolean }) {
  const pathname = usePathname()
  const shouldHideSidebar = pathname?.startsWith('/landing')

  if (shouldHideSidebar) {
    return (
      <main className="flex-1">
        {children}
        <Toaster />
      </main>
    )
  }

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset>
        <KanjiModeProvider>
          <main className="flex-1">
            {children}
            <Toaster />
          </main>
        </KanjiModeProvider>
      </SidebarInset>
    </SidebarProvider>
  )
}


