 'use client'

import { formatDistanceToNow } from 'date-fns'
import { SortAsc, SortDesc, Pencil } from "lucide-react"
import { Loader2 } from 'lucide-react'
import { useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'

import { BaseHeader } from "@/components/BaseHeader"
import SearchPane from "@/components/SearchPane/SearchPane"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Toggle } from "@/components/ui/toggle"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { backendService } from "@/services/backendService"
import type { LookupTermResponse } from "@/types/backend-types"
import { EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_UPDATE_NOTE_FIELDS, EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_UPDATE_NOTE_FIELDS_RESPONSE } from '@/types/events'
import { canManualSyncToAnki } from '@/utils/ankiconnect/syncHelpers'
import { useSyncContext } from '@/utils/ankiconnect/syncHooks'
import { safeStorage } from '@/utils/safeStorage'

interface MiningCard {
  id: number
  created_at: string
  updated_at: string
  expression: string
  reading: string | null
  definitions: any // JSON data
  sentence: string | null
  pitch_accent: string | null
  frequency: any | null // JSON data
  anki_note_id: number | null
  anki_model: string | null
  anki_deck: string | null
  sync_status: string
  synced_at: string | null
  document_title?: string | null
}

export default function MiningPage() {
  const [cards, setCards] = useState<MiningCard[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set())
  const [sortBy, setSortBy] = useState<'created_at' | 'updated_at' | 'expression' | 'sync_status'>('created_at')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [showOnlyNeedingUpdate, setShowOnlyNeedingUpdate] = useState(false)
  const itemsPerPage = 10

  // Sheet + SearchPane state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState<LookupTermResponse | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  type SearchStackEntry = { query: string; firstTerm?: string; results?: LookupTermResponse | null; position?: number }
  const [searchStack, setSearchStack] = useState<SearchStackEntry[]>([])
  const [userPreferences, setUserPreferences] = useState<{
    dictionaryOrder: string[];
    disabledDictionaries: string[];
    spoilerDictionaries: string[];
    freqDictionaryOrder: string[];
    shouldHighlightKanjiInSearch?: boolean;
  } | null>(null)

  // Combined sync context
  const syncContext = useSyncContext()
  const [isSaving, setIsSaving] = useState(false)
  const [editingCardId, setEditingCardId] = useState<number | null>(null)

  const toggleSelectAll = () => {
    if (selectedCards.size === cards.length) {
      setSelectedCards(new Set())
    } else {
      setSelectedCards(new Set(cards.map(card => card.id)))
    }
  }

  const toggleCardSelection = (cardId: number) => {
    const newSelected = new Set(selectedCards)
    if (newSelected.has(cardId)) {
      newSelected.delete(cardId)
    } else {
      newSelected.add(cardId)
    }
    setSelectedCards(newSelected)
  }

  useEffect(() => {
    const fetchCards = async () => {
      setIsLoading(true)

      try {
        // Fetch cards from API
        const params = new URLSearchParams({
          sortBy,
          sortDirection,
          showOnlyNeedingUpdate: showOnlyNeedingUpdate.toString(),
          page: currentPage.toString(),
          limit: itemsPerPage.toString()
        })

        const response = await fetch(`/api/cards?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch cards')
        }

        const { cards: fetchedCards, totalCount: count, totalPages: pages } = await response.json()

        setCards(fetchedCards)
        setTotalCount(count)
        setTotalPages(pages)
      } catch (error) {
        console.error('Error fetching cards:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCards()
  }, [currentPage, sortBy, sortDirection, showOnlyNeedingUpdate])

  // Load user preferences for SearchPane ordering
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        // Try cached preferences first
        const cached = safeStorage.getItem('user-preferences-current')
        if (cached) {
          try {
            const parsed = JSON.parse(cached)
            setUserPreferences(parsed)
            return
          } catch {}
        }

        // Fetch from API
        const response = await fetch('/api/preferences', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch preferences')
        }

        const { preferences: data } = await response.json()

        if (!data) {
          // Get default preferences from dictionaries
          const dictResponse = await fetch('/api/dictionaries', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          })

          if (!dictResponse.ok) {
            throw new Error('Failed to fetch dictionaries')
          }

          const { dictionaries: dictIndexData } = await dictResponse.json()

          const termDicts = dictIndexData?.filter((d: any) => d.type === 0).map((d: any) => `${d.title}#${d.revision}`) || []
          const freqDicts = dictIndexData?.filter((d: any) => d.type === 2).map((d: any) => `${d.title}#${d.revision}`) || []

          const prefs = {
            dictionaryOrder: termDicts,
            disabledDictionaries: [],
            spoilerDictionaries: [],
            freqDictionaryOrder: freqDicts,
            shouldHighlightKanjiInSearch: true,
          }
          setUserPreferences(prefs)
          safeStorage.setItem('user-preferences-current', JSON.stringify(prefs))
          return
        }

        const prefs = {
          dictionaryOrder: data.dictionaryOrder,
          disabledDictionaries: data.disabledDictionaries,
          spoilerDictionaries: data.spoilerDictionaries,
          freqDictionaryOrder: data.freqDictionaryOrder,
          shouldHighlightKanjiInSearch: data.shouldHighlightKanjiInSearch ?? true,
        }
        setUserPreferences(prefs)
        safeStorage.setItem('user-preferences-current', JSON.stringify(prefs))
      } catch (err) {
        console.error('Failed to load user preferences for mining SearchPane:', err)
      }
    }

    loadPreferences()
  }, [])

  const handleSearch = useCallback(async (text: string, position: number, source: 'textpane' | 'searchpane') => {
    setSearchQuery(text)
    if (!text.trim()) {
      setSearchResult(null)
      setSearchStack([])
      return
    }
    setSearchLoading(true)
    try {
      const result = await backendService.lookupTerm(text.trim(), position)
      setSearchResult(result)
      if (source === 'searchpane') {
        if (result && result.dictionaryResults && result.dictionaryResults.length > 0) {
          const firstTerm = result.dictionaryResults?.[0]?.entries?.[0]?.text || text
          setSearchStack([{ query: text, position, results: result, firstTerm }])
        } else {
          setSearchStack([{ query: text, position, results: null, firstTerm: text }])
        }
      } else {
        if (result && result.dictionaryResults && result.dictionaryResults.length > 0) {
          const firstTerm = result.dictionaryResults?.[0]?.entries?.[0]?.text || text
          setSearchStack(prev => ([...prev, { query: text, position, results: result, firstTerm }]))
        } else {
          setSearchStack(prev => ([...prev, { query: text, position, results: null, firstTerm: text }]))
        }
      }
    } finally {
      setSearchLoading(false)
    }
  }, [])

  const handleBack = useCallback((steps = 1) => {
    if (searchStack.length > steps) {
      const newStack = searchStack.slice(0, -steps)
      setSearchStack(newStack)
      const last = newStack[newStack.length - 1]
      setSearchQuery(last.query)
      setSearchResult(last.results || null)
    }
  }, [searchStack])

  const openEditorForCard = useCallback(async (card: MiningCard) => {
    setSheetOpen(true)
    setEditingCardId(card.id)
    setSearchQuery(card.expression)
    setSearchLoading(true)
    try {
      const result = await backendService.lookupTerm(card.expression, 0)
      setSearchResult(result)
      if (result && result.dictionaryResults && result.dictionaryResults.length > 0) {
        const firstTerm = result.dictionaryResults?.[0]?.entries?.[0]?.text || card.expression
        setSearchStack([{ query: card.expression, position: 0, results: result, firstTerm }])
      } else {
        setSearchStack([{ query: card.expression, position: 0, results: null, firstTerm: card.expression }])
      }
    } finally {
      setSearchLoading(false)
    }
  }, [])

  // Ref to collect selected data from SearchPane for saving
  const prepareDataRef = useRef<null | (() => Promise<{
    term: string;
    reading: string | undefined;
    definitions: Array<{ type: string; content: string; dictionary_title?: string; dictionary_origin?: string }>;
    frequencyPairs: Array<[string, string | number]>;
    pitchAccent: string;
    expressionAudio?: string | null;
  }>)>(null)

  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true)
      if (!prepareDataRef.current) return
      const prepared = await prepareDataRef.current()
      if (!prepared) return

      // Use the captured editing card id to avoid expression-based lookup issues
      if (!editingCardId) return

      // Update card via API
      const response = await fetch(`/api/cards/${editingCardId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          updates: {
            expression: prepared.term,
            reading: prepared.reading || null,
            definitions: prepared.definitions,
            sentence: (searchQuery && searchQuery !== prepared.term) ? searchQuery : null,
            pitch_accent: prepared.pitchAccent || null,
            frequency: prepared.frequencyPairs,
            expression_audio: prepared.expressionAudio || null,
          }
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save card')
      }

      toast.success('Card saved', {
        description: 'Refresh the page to see your changes',
        duration: 5000
      })

      // Card saved successfully - user can sync manually via bulk sync button if desired

    } catch (e: any) {
      console.error('Save failed:', e)
      toast.error('Save failed', { description: e?.message || 'Unknown error' })
    } finally {
      setIsSaving(false)
    }
  }, [editingCardId, searchQuery])

  return (
    <div className="flex flex-col h-screen">
      <BaseHeader title="Mining History" />
      <main className="flex-1 p-4 overflow-auto">
        <div className="container mx-auto">
          <div className="mb-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <p className="text-sm text-muted-foreground">
                {totalCount} {totalCount === 1 ? 'card' : 'cards'} {showOnlyNeedingUpdate ? 'needing update' : 'total'}
              </p>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-muted-foreground bg-info/20 border-l-4 border-l-info hover:!bg-[hsl(var(--info)/0.5)]">Updated after last Anki sync</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 min-h-[60px]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <Button
                variant="default"
                size="sm"
                disabled={selectedCards.size === 0 || !canManualSyncToAnki(syncContext).canSync}
                className="w-full sm:w-auto sm:min-w-[200px]"
                onClick={async () => {
                // Check if manual bulk sync is possible
                const { canSync: canManualSync, reasons } = canManualSyncToAnki(syncContext)
                console.log('🔄 Manual bulk sync check:', { canSync: canManualSync, reasons })

                if (!canManualSync) {
                  if (reasons.includes('extension not available') || reasons.includes('extension not paired')) {
                    toast.error('Extension not available', {
                      description: 'Please install and pair the browser extension to sync with Anki'
                    })
                  } else if (reasons.includes('AnkiConnect not available') || reasons.includes('AnkiConnect not configured')) {
                    toast.error('AnkiConnect not available', {
                      description: 'Please ensure Anki is running with AnkiConnect addon configured'
                    })
                  }
                  return
                }

                try {
                  console.log('🎯 Sending update request for cards:', Array.from(selectedCards));

                  // Send message and wait for response
                  window.postMessage({
                    type: EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_UPDATE_NOTE_FIELDS,
                    cardIds: Array.from(selectedCards)
                  }, window.location.origin);

                  // Wait for response
                  const response = await new Promise((resolve) => {
                    const handleResponse = (event: MessageEvent) => {
                      if (event.origin !== window.location.origin) return;

                      if (event.data?.type === EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_UPDATE_NOTE_FIELDS_RESPONSE) {
                        window.removeEventListener('message', handleResponse);
                        resolve(event.data);
                      }
                    };

                    window.addEventListener('message', handleResponse);

                    // Timeout after 10 seconds
                    setTimeout(() => {
                      window.removeEventListener('message', handleResponse);
                      resolve({ success: false, error: 'Timeout waiting for extension response' });
                    }, 10000);
                  });

                  const { success, results, skippedCards, error } = response as any;

                  if (success) {
                    console.log('✅ Cards updated successfully:', {
                      updatedCount: results?.length || 0,
                      skippedCount: skippedCards?.length || 0,
                      results,
                      skippedCards
                    });
                    // Refresh the cards list to show updated sync status
                    window.location.reload();
                  } else {
                    console.error('❌ Failed to update cards:', error);
                  }
                } catch (error) {
                  console.error('Error updating cards:', error);
                }
              }}
            >
                <span className="hidden sm:inline">
                  Update {selectedCards.size === 0 ? 'cards' : selectedCards.size === 1 ? 'card' : `${selectedCards.size} cards`} in Anki
                </span>
                <span className="sm:hidden">
                  Update {selectedCards.size === 0 ? 'cards' : `${selectedCards.size} card${selectedCards.size === 1 ? '' : 's'}`} in Anki
                </span>
                </Button>
                {selectedCards.size > 0 && (() => {
                  const { canSync: canManualSync, reasons } = canManualSyncToAnki(syncContext)
                  if (!canManualSync) {
                    return (
                      <Alert variant="destructive" className="w-auto py-1 px-2">
                        <AlertDescription className="text-xs leading-tight">
                          {reasons.includes('extension not available') || reasons.includes('extension not paired')
                            ? 'Extension not available - install and pair browser extension'
                            : reasons.includes('AnkiConnect not available') || reasons.includes('AnkiConnect not configured')
                            ? 'AnkiConnect not available - ensure Anki is running with AnkiConnect addon'
                            : 'Sync not available'}
                        </AlertDescription>
                      </Alert>
                    )
                  }
                  return null
                })()}
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="filter-needs-update"
                    checked={showOnlyNeedingUpdate}
                    onCheckedChange={(checked) => {
                      setShowOnlyNeedingUpdate(!!checked)
                      setCurrentPage(1)
                    }}
                  />
                  <label
                    htmlFor="filter-needs-update"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Show only needing update
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Sort by</span>
                  <Select value={sortBy} onValueChange={(v) => { setSortBy(v as 'created_at' | 'updated_at' | 'expression' | 'sync_status'); setCurrentPage(1) }}>
                    <SelectTrigger className="flex-1 sm:w-[180px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">Created</SelectItem>
                      <SelectItem value="updated_at">Updated</SelectItem>
                      <SelectItem value="sync_status">Status</SelectItem>
                      <SelectItem value="expression">Expression</SelectItem>
                    </SelectContent>
                  </Select>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Toggle
                          pressed={sortDirection === 'asc'}
                          onPressedChange={(p) => { setSortDirection(p ? 'asc' : 'desc'); setCurrentPage(1) }}
                          aria-label="Toggle sort direction"
                          className="h-8 px-2 flex-shrink-0"
                        >
                          {sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                        </Toggle>
                      </TooltipTrigger>
                      <TooltipContent>
                        {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedCards.size === cards.length && cards.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Expr and reading</TableHead>
                  <TableHead>Definitions</TableHead>
                  <TableHead>Sentence</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Sync Status</TableHead>
                  <TableHead className="w-[60px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : cards.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">No cards found</TableCell>
                  </TableRow>
                ) : (
                  cards.map((card) => {
                    const isHighlighted = card.synced_at && new Date(card.updated_at) > new Date(card.synced_at);
                    return (
                    <TableRow
                      key={card.id}
                      className={isHighlighted ? 'bg-info/20 hover:!bg-[hsl(var(--info)/0.5)]' : ''}
                    >
                      <TableCell className={`w-[50px] ${isHighlighted ? 'border-l-4 border-l-info' : ''}`}>
                        <Checkbox
                          checked={selectedCards.has(card.id)}
                          onCheckedChange={() => toggleCardSelection(card.id)}
                          disabled={card.sync_status === 'local_only'}
                          aria-label={`Select card ${card.expression}`}
                        />
                      </TableCell>
                      <TableCell>
                        {card.reading ? (
                          <ruby>
                            {card.expression}
                            <rt className="text-xs">{card.reading}</rt>
                          </ruby>
                        ) : (
                          card.expression
                        )}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          try {
                            const defs = typeof card.definitions === 'string' ? JSON.parse(card.definitions) : card.definitions;
                            if (Array.isArray(defs)) {
                              return `${defs.length}`;
                            }
                            return '1';
                          } catch (e) {
                            return '1';
                          }
                        })()}
                      </TableCell>
                      <TableCell>{card.sentence}</TableCell>
                      <TableCell>{card.document_title}</TableCell>
                      <TableCell>{formatDistanceToNow(new Date(card.created_at), { addSuffix: true })}</TableCell>
                      <TableCell>
                        {card.created_at === card.updated_at ? (
                          '—'
                        ) : (
                          formatDistanceToNow(new Date(card.updated_at), { addSuffix: true })
                        )}
                      </TableCell>
                      <TableCell>
                        {card.sync_status === 'local_only' ? (
                          'Not synced'
                        ) : card.synced_at ? (
                          formatDistanceToNow(new Date(card.synced_at), { addSuffix: true })
                        ) : (
                          'Pending sync'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditorForCard(card)}
                          aria-label={`Edit ${card.expression}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : cards.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No cards found</div>
            ) : (
              <>
                {/* Mobile Select All */}
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Checkbox
                    checked={selectedCards.size === cards.length && cards.length > 0}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                  <span className="text-sm font-medium">Select all</span>
                  {selectedCards.size > 0 && (
                    <span className="text-sm text-muted-foreground">
                      ({selectedCards.size} selected)
                    </span>
                  )}
                </div>
                {cards.map((card) => (
                <Card key={card.id} className="p-4">
                  <div className="space-y-3">
                    {/* Header with checkbox and edit button */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Checkbox
                          checked={selectedCards.has(card.id)}
                          onCheckedChange={() => toggleCardSelection(card.id)}
                          disabled={card.sync_status === 'local_only'}
                          aria-label={`Select card ${card.expression}`}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-lg leading-tight break-words">
                            {card.reading ? (
                              <ruby>
                                {card.expression}
                                <rt className="text-xs">{card.reading}</rt>
                              </ruby>
                            ) : (
                              card.expression
                            )}
                          </h3>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditorForCard(card)}
                        aria-label={`Edit ${card.expression}`}
                        className="flex-shrink-0"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Definitions count */}
                    <div className="text-sm">
                      <span className="font-medium text-muted-foreground">Definitions:</span>{' '}
                      {(() => {
                        try {
                          const defs = typeof card.definitions === 'string' ? JSON.parse(card.definitions) : card.definitions;
                          if (Array.isArray(defs)) {
                            return `${defs.length}`;
                          }
                          return '1';
                        } catch (e) {
                          return '1';
                        }
                      })()}
                    </div>

                    {/* Sentence */}
                    {card.sentence && (
                      <div className="text-sm">
                        <span className="font-medium text-muted-foreground">Sentence:</span>{' '}
                        <span className="break-words">{card.sentence}</span>
                      </div>
                    )}

                    {/* Document */}
                    {card.document_title && (
                      <div className="text-sm">
                        <span className="font-medium text-muted-foreground">Document:</span>{' '}
                        <span className="break-words">{card.document_title}</span>
                      </div>
                    )}

                    {/* Metadata row */}
                    <div className="flex flex-col gap-1 pt-2 border-t text-sm">
                      <div>
                        <span className="font-medium text-muted-foreground">Created:</span>{' '}
                        {formatDistanceToNow(new Date(card.created_at), { addSuffix: true })}
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">Updated:</span>{' '}
                        {card.created_at === card.updated_at ? (
                          'Never'
                        ) : (
                          formatDistanceToNow(new Date(card.updated_at), { addSuffix: true })
                        )}
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">Sync Status:</span>{' '}
                        {card.sync_status === 'local_only' ? (
                          'Not synced'
                        ) : card.synced_at ? (
                          formatDistanceToNow(new Date(card.synced_at), { addSuffix: true })
                        ) : (
                          'Pending sync'
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
                ))}
              </>
            )}
          </div>

          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetContent side="right" className="w-full sm:max-w-lg">
            <SheetHeader>
              <div className="flex items-center justify-between gap-2 pr-12">
                <SheetTitle>Edit: {searchQuery || '—'}</SheetTitle>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </SheetHeader>
              <div className="h-[calc(100vh-6rem)] mt-4">
                <SearchPane
                  searchQuery={searchQuery}
                  searchResult={searchResult}
                  isLoading={searchLoading}
                  onSearch={handleSearch}
                  onBack={() => handleBack(1)}
                  stackPosition={`${searchStack.length}/${Math.max(1, searchStack.length)}`}
                  searchStack={searchStack}
                  setSearchStack={setSearchStack}
                  isStandalone={true}
                  isAuthenticated={true}
                  userPreferences={userPreferences}
                  prepareDataRef={prepareDataRef}
                />
              </div>
            </SheetContent>
          </Sheet>

          <div className="mt-4 flex justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNumber = i + 1
                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        onClick={() => setCurrentPage(pageNumber)}
                        isActive={currentPage === pageNumber}
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  )
                })}
                {totalPages > 5 && (
                  <>
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink
                        onClick={() => setCurrentPage(totalPages)}
                        isActive={currentPage === totalPages}
                      >
                        {totalPages}
                      </PaginationLink>
                    </PaginationItem>
                  </>
                )}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </main>
    </div>
  )
}
