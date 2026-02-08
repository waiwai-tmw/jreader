'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import React, { useState, useRef, useEffect } from 'react'
import { ActivityCalendar } from 'react-activity-calendar'
import { Tooltip as ReactTooltip } from 'react-tooltip'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'

interface Activity {
  date: string
  count: number
  level: number
}

interface ActivityHeatmapProps {
  variant?: 'default' | 'large'
}

export default function ActivityHeatmap({ variant = 'default' }: ActivityHeatmapProps) {
  const supabase = createClient()
  const { user } = useAuth()
  const { resolvedTheme } = useTheme()
  const [width, setWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.offsetWidth)
      }
    }

    // Initial width
    updateWidth()

    // Update width on resize
    const observer = new ResizeObserver(updateWidth)
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const { data, isLoading, error } = useQuery({
    queryKey: ['activityHeatmap'],
    queryFn: async () => {
      if (!user) return []

      // Get kanji activity (excluding imports)
      const { data: kanjiData, error: kanjiError } = await supabase
        .from('User Kanji')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('is_import', false)
        .order('created_at', { ascending: true })

      if (kanjiError) {
        console.error('Error fetching kanji data:', kanjiError)
        throw kanjiError
      }

      // Get card mining activity
      const { data: cardsData, error: cardsError } = await supabase
        .from('cards')
        .select('created_at')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

      if (cardsError) {
        console.error('Error fetching cards data:', cardsError)
        throw cardsError
      }

      // Combine and count activities by date
      const activityMap = new Map<string, number>()
      
      // Count kanji activities
      kanjiData?.forEach(entry => {
        const date = new Date(entry.created_at).toISOString().split('T')[0]
        activityMap.set(date, (activityMap.get(date) || 0) + 1)
      })

      // Count card activities
      cardsData?.forEach(entry => {
        const date = new Date(entry.created_at).toISOString().split('T')[0]
        activityMap.set(date, (activityMap.get(date) || 0) + 1)
      })

      // Convert to array and calculate levels
      return Array.from(activityMap.entries())
        .map(([date, count]): Activity => ({
          date,
          count,
          level: count === 0 ? 0 
            : count <= 2 ? 1 
            : count <= 5 ? 2 
            : count <= 10 ? 3 
            : 4
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500">Error loading activity data</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="w-full" ref={containerRef}>
            <>
              <ActivityCalendar
                data={data}
                colorScheme={resolvedTheme === 'dark' ? 'dark' : 'light'}
                blockSize={variant === 'large' 
                  ? (width < 800 ? 14 : 16)
                  : (width < 500 ? 10 : width < 700 ? 12 : 14)
                }
                blockMargin={variant === 'large'
                  ? (width < 800 ? 4 : 5)
                  : (width < 500 ? 2 : width < 700 ? 3 : 4)
                }
                fontSize={variant === 'large' ? 14 : (width < 500 ? 10 : 12)}
                labels={{
                  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                  weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                  totalCount: '{{count}} activities in {{year}}'
                }}
                renderBlock={(block, activity) =>
                  React.cloneElement(block, {
                    'data-tooltip-id': 'activity-tooltip',
                    'data-tooltip-html': `${activity.count} ${activity.count === 1 ? 'activity' : 'activities'} on ${new Date(activity.date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}`
                  })
                }
              />
              <ReactTooltip id="activity-tooltip" />
            </>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}