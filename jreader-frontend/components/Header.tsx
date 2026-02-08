'use client'

import { MoreVertical } from "lucide-react"

import { AutoSyncIndicator } from "@/components/AutoSyncIndicator"
import { BookmarkInfoCard } from "@/components/BookmarkInfoCard"
import { ExtensionIndicator } from "@/components/ExtensionIndicator"
import { FullscreenButton } from "@/components/FullscreenButton"
import { BookmarkIcon } from "@/components/icons/BookmarkIcon"
import { KanjiModeIndicator } from "@/components/KanjiModeIndicator"
import { SettingsButton } from "@/components/SettingsButton"
import { TableOfContents } from "@/components/TableOfContents"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useKanjiMode } from '@/contexts/KanjiModeContext'

interface HeaderProps {
  onNavigate?: (pageNumber: number) => void
  bookTitle?: string
  isAtBookmark?: boolean
  isAuthenticated?: boolean
  supabaseUploadId: string
  tocEntries?: Array<{
    label: string
    page_number: number
    play_order: number
  }>
}

export function Header({
  onNavigate = () => {},
  bookTitle = "Loading...",
  isAtBookmark = false,
  isAuthenticated = false,
  supabaseUploadId,
  tocEntries
}: HeaderProps) {
  const isPortraitMode = typeof window !== 'undefined' && window.innerWidth < window.innerHeight;
  const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 768;
  const isIPhone = typeof window !== 'undefined' && /iPhone|iPod/.test(navigator.userAgent);
  const { isKanjiMode, toggleKanjiMode } = useKanjiMode();

  return (
    <header className="flex h-10 shrink-0 items-center gap-2 border-b z-[5] relative bg-background">
      <div className="flex items-center gap-2 px-2 flex-shrink-0">
        <SidebarTrigger className="-ml-1" />
      </div>
      <div className={`flex-1 flex justify-center items-center ${isPortraitMode ? 'text-sm' : ''} min-w-0`}>
        <div className={`${isPortraitMode && isSmallScreen ? 'max-w-[220px]' : isPortraitMode ? 'max-w-[550px]' : 'max-w-[700px]'} w-full flex justify-center`}>
          <TableOfContents 
            onNavigate={onNavigate}
            bookTitle={bookTitle}
            supabaseUploadId={supabaseUploadId}
            tocEntries={tocEntries}
          />
        </div>
      </div>
      <div className="flex items-center gap-1 px-2 flex-shrink-0">
        <BookmarkInfoCard isDisabled={!isAuthenticated}>
          <BookmarkIcon
            className={`w-5 h-5 transition-colors ${
              isAtBookmark ? 'text-red-500' : 'text-muted-foreground'
            }`}
            isDisabled={!isAuthenticated}
            title={isAuthenticated ? 'Bookmark' : 'Sign in to bookmark'}
          />
        </BookmarkInfoCard>
        {isPortraitMode && isSmallScreen && (
          <button
            onClick={toggleKanjiMode}
            className={`
              w-6 h-6 text-xs font-mono font-bold
              border rounded cursor-pointer
              transition-colors flex items-center justify-center
              hover:opacity-80
              ${isKanjiMode 
                ? 'bg-yellow-100 dark:bg-yellow-900 border-yellow-200 dark:border-yellow-800 text-yellow-900 dark:text-yellow-100' 
                : 'border-border text-muted-foreground'
              }
            `}
            title={`Switch to ${isKanjiMode ? 'READ' : 'KANJI'} mode`}
          >
            {isKanjiMode ? 'K' : 'R'}
          </button>
        )}
        {isPortraitMode && isSmallScreen ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2">
                <MoreVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="p-2 flex items-center gap-2">
                <ExtensionIndicator />
                <span>Extension Status</span>
              </div>
              <div className="p-2 flex items-center gap-2">
                <AutoSyncIndicator />
                <span>Auto-sync Status</span>
              </div>
              <div className="p-2 flex items-center gap-2">
                <SettingsButton />
                <span>Settings</span>
              </div>
              <div className="p-2 flex items-center gap-2">
                <KanjiModeIndicator />
                <span>Kanji Mode</span>
              </div>
              <div className="p-2 flex items-center gap-2">
                <FullscreenButton />
                <span>Fullscreen</span>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            <ExtensionIndicator />
            <AutoSyncIndicator />
            <SettingsButton />
            <KanjiModeIndicator />
            <FullscreenButton />
          </>
        )}
      </div>
    </header>
  )
}