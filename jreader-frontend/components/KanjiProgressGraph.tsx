'use client'

import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'

interface DataPoint {
  date: string
  encounteredNatural: number
  encounteredImported: number
  knownNatural: number
  knownImported: number
}

export default function KanjiProgressGraph() {
  const supabase = createClient()
  const { user } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: ['kanjiProgressData'],
    queryFn: async () => {
      if (!user) return []

      const { data: kanjiData, error } = await supabase
        .from('User Kanji')
        .select('created_at, state, is_import')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching kanji data:', error)
        throw error
      }

      // Process data to create cumulative counts by date
      const dailyData = new Map<string, {
        encounteredNatural: number,
        encounteredImported: number,
        knownNatural: number,
        knownImported: number
      }>()
      
      let counts = {
        encounteredNatural: 0,
        encounteredImported: 0,
        knownNatural: 0,
        knownImported: 0
      }

      kanjiData.forEach(entry => {
        const date = new Date(entry.created_at).toISOString().split('T')[0]
        
        if (entry.state === 0) { // ENCOUNTERED
          if (entry.is_import) {
            counts.encounteredImported++
          } else {
            counts.encounteredNatural++
          }
        } else if (entry.state === 1) { // KNOWN
          if (entry.is_import) {
            counts.knownImported++
          } else {
            counts.knownNatural++
          }
        }

        dailyData.set(date, { ...counts })
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
          <CardTitle>Kanji Progress Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kanji Progress Over Time</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Encountered Kanji</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
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
                <Legend />
                <Bar name="Imported" dataKey="encounteredImported" stackId="encountered" fill="#fde68a" />
                <Bar name="Natural" dataKey="encounteredNatural" stackId="encountered" fill="#d97706" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Known Kanji</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
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
                <Legend />
                <Bar name="Imported" dataKey="knownImported" stackId="known" fill="#86efac" />
                <Bar name="Natural" dataKey="knownNatural" stackId="known" fill="#15803d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
