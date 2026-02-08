'use client'

import { useAuth } from '@/contexts/AuthContext'

interface KanjiLegendProps {
  mobileOnly?: boolean;
}

export function KanjiLegend({ mobileOnly = false }: KanjiLegendProps) {
  const { user } = useAuth()

  // Don't render if user is not authenticated
  if (!user) {
    return null
  }

  // Mobile-only version - just show abbreviated letters
  if (mobileOnly) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <span className="kanji-not-mined px-1 rounded font-mono">U</span>
        <span className="kanji-encountered px-1 rounded font-mono">E</span>
      </div>
    )
  }

  // Desktop version - responsive behavior
  return (
    <div className="flex flex-col items-center gap-1 p-2 text-xs group-data-[collapsible=icon]:p-1">
      <div className="hidden group-data-[collapsible=icon]:flex items-center gap-1">
        <span className="kanji-not-mined px-1 rounded font-mono">U</span>
        <span className="kanji-encountered px-1 rounded font-mono">E</span>
      </div>
      <div className="flex flex-col items-center gap-2 text-muted-foreground group-data-[collapsible=icon]:hidden">
        <div className="kanji-not-mined px-2 py-1 rounded">Unknown</div>
        <div className="kanji-encountered px-2 py-1 rounded">Encountered</div>
      </div>
    </div>
  )
}
