'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { AnnouncementBanner } from "@/components/AnnouncementBanner"
import { BaseHeader } from "@/components/BaseHeader"
import LibraryPane from "@/components/LibraryPane"
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import type { BookSelectEvent } from '@/types'

export default function LibraryPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  usePageTitle('Library - JReader');

  useEffect(() => {
    const handleBookSelect = (e: BookSelectEvent) => {
      // Navigate to /library/[supabase_upload_id]
      router.push(`/library/${e.detail.supabase_upload_id}`)
    }

    window.addEventListener('bookselect', handleBookSelect as EventListener)
    return () => {
      window.removeEventListener('bookselect', handleBookSelect as EventListener)
    }
  }, [router])

  return (
    <div className="absolute inset-0 flex flex-col">
      <BaseHeader title="Library" />
      <main className="flex-1 overflow-y-auto p-6">
        <LibraryPane setActivePane={() => {}} isAuthenticated={!!user} isAuthLoading={isLoading} />
      </main>
    </div>
  )
} 