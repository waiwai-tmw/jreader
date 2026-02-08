'use client'

import { usePathname } from 'next/navigation'

import Providers from './providers'

import { AppSidebar } from '@/components/AppSidebar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { AnkiHealthProvider } from '@/contexts/AnkiHealthContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { AutoSyncProvider } from '@/contexts/AutoSyncContext'
import { EinkModeProvider } from '@/contexts/EinkModeContext'
import { ExtensionProvider } from '@/contexts/ExtensionContext'
import { KanjiModeProvider } from '@/contexts/KanjiModeContext'

export default function ClientRoot({ children, defaultOpen }: { children: React.ReactNode; defaultOpen: boolean }) {
  const pathname = usePathname()
  const isStandalone = pathname === '/' || pathname?.startsWith('/landing')

  if (isStandalone) {
    // Keep core providers needed for auth-dependent UI, but hide sidebar
    // Use an internal scroll container since body uses overflow-hidden globally
    return (
      <Providers>
        <AuthProvider>
          <EinkModeProvider>
            <ExtensionProvider>
              <AutoSyncProvider>
                <AnkiHealthProvider>
                  <main className="h-[100dvh] overflow-auto">
                    {children}
                  </main>
                </AnkiHealthProvider>
              </AutoSyncProvider>
            </ExtensionProvider>
          </EinkModeProvider>
        </AuthProvider>
      </Providers>
    )
  }

  return (
    <Providers>
      <AuthProvider>
        <EinkModeProvider>
          <ExtensionProvider>
            <AutoSyncProvider>
              <AnkiHealthProvider>
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
              </AnkiHealthProvider>
            </AutoSyncProvider>
          </ExtensionProvider>
        </EinkModeProvider>
      </AuthProvider>
    </Providers>
  )
}


