'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import ActivityHeatmap from "@/components/ActivityHeatmap"
import { BaseHeader } from "@/components/BaseHeader"
import CardsMiningGraph from "@/components/CardsMiningGraph"
import KanjiGrid from "@/components/KanjiGrid"
import KanjiProgressGraph from "@/components/KanjiProgressGraph"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from '@/contexts/AuthContext';
import { useKanjiStates, KanjiQueryEnabled, SubscriptionCheck } from '@/hooks/useKanjiStates'
import { usePageTitle } from '@/hooks/usePageTitle'
import { createClient } from '@/utils/supabase/client'

export default function StatsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [importText, setImportText] = useState('')
  const supabase = createClient()
  const { knownKanji, encounteredKanji, isLoading: kanjiLoading } = useKanjiStates(KanjiQueryEnabled.ENABLED, SubscriptionCheck.DONT_CHECK)
  const queryClient = useQueryClient()
  usePageTitle('Stats - JReader');

  const [activeTab, setActiveTab] = useState('kanji');

  // Initialize tab from URL on client side
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && (tabFromUrl === 'kanji' || tabFromUrl === 'graphs')) {
      setActiveTab(tabFromUrl);
    }
  }, []);

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const newParams = new URLSearchParams(window.location.search);
    newParams.set('tab', value);
    window.history.pushState({}, '', `${window.location.pathname}?${newParams.toString()}`);
  };

  // Check authentication
  useEffect(() => {
    if (!authLoading && !user) {
      // Not logged in - redirect to login
      router.push('/login');
      return;
    }
  }, [user, authLoading, router]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  // Show loading while redirecting
  if (!user) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">Redirecting...</div>
        </div>
      </div>
    );
  }

  const handleImport = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Extract unique kanji characters
    const kanjiToImport = Array.from(new Set(
      Array.from(importText).filter(char => 
        char.match(/[\u4E00-\u9FFF]/) && // is kanji
        !knownKanji.includes(char) // not already known
      )
    ))

    if (kanjiToImport.length === 0) return

    // Prepare rows for insertion
    const rows = kanjiToImport.map(kanji => ({
      user_id: user.id,
      kanji,
      state: 1, // KNOWN
      is_import: true
    }))

    await supabase
      .from('User Kanji')
      .upsert(rows)

    // Invalidate the kanjiStates query to trigger a refresh
    queryClient.invalidateQueries({ queryKey: ['kanjiStates'] })
    setImportText('') // Clear input after import
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <BaseHeader title="Stats">
        <Dialog>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              className="h-8 px-3 text-sm bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"
            >
              Import Kanji
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Known Kanji</DialogTitle>
              <DialogDescription>
                Paste text containing kanji. All unique kanji will be marked as known.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <Input
                placeholder="Paste text with kanji here..."
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              <Button onClick={handleImport}>Import</Button>
            </div>
          </DialogContent>
        </Dialog>
      </BaseHeader>
      <div className="relative flex-1 min-h-0">
        <div className="absolute inset-0 overflow-y-auto">
          <div className="p-6">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList>
                <TabsTrigger value="kanji">Kanji</TabsTrigger>
                <TabsTrigger value="graphs">Graphs</TabsTrigger>
              </TabsList>
              <TabsContent value="kanji">
                {/* Kanji Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Encountered Kanji
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {kanjiLoading ? (
                        <Skeleton className="h-8 w-16 mb-1" />
                      ) : (
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {encounteredKanji.length}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Kanji you've seen while reading
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Known Kanji
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {kanjiLoading ? (
                        <Skeleton className="h-8 w-16 mb-1" />
                      ) : (
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {knownKanji.length}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Kanji you've mastered
                      </p>
                    </CardContent>
                  </Card>
                </div>
                
                <KanjiGrid />
              </TabsContent>
              <TabsContent value="graphs">
                <div className="grid gap-6">
                  <ActivityHeatmap variant="large" />
                  <KanjiProgressGraph />
                  <CardsMiningGraph />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
} 