'use client'

import { useQuery } from '@tanstack/react-query'
import { Info } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'

interface Announcement {
  id: number
  message: string
  created_at: string
}

export function AnnouncementBanner() {
  const { user } = useAuth()
  
  const { data: announcements, isLoading } = useQuery<Announcement[]>({
    queryKey: ['announcements'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('announcements')
        .select('id, message, created_at')
        .order('created_at', { ascending: false })
        .limit(5) // Only show the 5 most recent announcements
      
      if (error) {
        console.error('Failed to fetch announcements from Supabase:', error)
        return []
      }
      
      return data || []
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    enabled: !!user, // Only fetch when user is logged in
  })

  // Don't render anything if user is not logged in, loading, or no announcements
  if (!user || isLoading || !announcements || announcements.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      {announcements.map((announcement) => (
        <div
          key={announcement.id}
          className="flex items-start gap-3 px-4 py-3 bg-muted/50 border-l-4 border-muted-foreground/20 rounded-r-md"
        >
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground flex-1 leading-relaxed">
            {announcement.message}
          </p>
        </div>
      ))}
    </div>
  )
}