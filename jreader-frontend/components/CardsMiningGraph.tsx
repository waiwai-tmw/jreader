'use client'

import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'

interface DataPoint {
  date: string
  totalCards: number
  document_title?: string // For tooltip
}

export default function CardsMiningGraph() {
  const supabase = createClient()
  const { user } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: ['cardsMiningData'],
    queryFn: async () => {
      if (!user) return []

      const { data: cardsData, error } = await supabase
        .from('cards')
        .select('created_at, document_title')
        .eq('user_id', user.id)
        .is('deleted_at', null) // Only include non-deleted cards
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching cards data:', error)
        throw error
      }

      // Process data to create cumulative counts by date
      const dailyData = new Map<string, {
        totalCards: number,
        document_title?: string
      }>()
      
      let totalCards = 0

      cardsData.forEach(entry => {
        const date = new Date(entry.created_at).toISOString().split('T')[0]
        totalCards++
        
        dailyData.set(date, { 
          totalCards,
          document_title: entry.document_title
        })
      })

      // Convert to array format for Recharts
      return Array.from(dailyData.entries()).map(([date, counts]) => ({
        date,
        ...counts
      }))
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    cacheTime: 30 * 60 * 1000, // Keep data in cache for 30 minutes
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cards Mining Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cards Mining Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500">Error loading cards data</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cards Mining Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                angle={-45}
                textAnchor="end"
                height={60}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone"
                name="Total Cards"
                dataKey="totalCards"
                stroke="#dc2626"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6, fill: "#dc2626", stroke: "white", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
