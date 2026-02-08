'use client'

import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import '@testing-library/jest-dom'
import SearchPane from '../SearchPane'

import type { LookupTermResponse } from '@/types/backend-types'

// Mocks to keep the component tree light and deterministic
jest.mock('@/contexts/AutoSyncContext', () => ({
  useAutoSync: () => ({ autoSyncEnabled: false, setAutoSyncEnabled: jest.fn() })
}))

jest.mock('@/contexts/AnkiHealthContext', () => ({
  useAnkiHealth: () => ({ isChecking: false, checkAnkiHealth: jest.fn(), healthStatus: { available: false, configured: false, checking: false } })
}))

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
    signUp: jest.fn(),
    resetPassword: jest.fn(),
    updatePassword: jest.fn(),
    updateEmail: jest.fn(),
    updateProfile: jest.fn(),
    isAuthenticated: false
  })
}))

jest.mock('@/contexts/ExtensionContext', () => ({
  useExtension: () => ({
    extensionStatus: { available: false, paired: false },
    checkExtension: jest.fn(),
    isChecking: false
  })
}))

jest.mock('@/hooks/useKanjiStates', () => ({
  KanjiQueryEnabled: { ENABLED: 'enabled', DISABLED: 'disabled' },
  SubscriptionCheck: { CHECK: 'check', DONT_CHECK: 'dont_check' },
  useKanjiStates: () => ({
    knownKanji: [],
    encounteredKanji: [],
    isLoading: false,
    cycleKanjiState: jest.fn(),
    markKanjiAsEncountered: jest.fn()
  })
}))

jest.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: { access_token: 'test-token' } } })
    },
    from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) })
  })
}))

// Mock the Carousel component
jest.mock('@/components/ui/carousel', () => ({
  Carousel: ({ children, setApi }: { children: React.ReactNode, setApi?: (api: any) => void }) => {
    // Mock the carousel API
    React.useEffect(() => {
      if (setApi) {
        setApi({
          scrollNext: jest.fn(),
          scrollPrev: jest.fn(),
          scrollTo: jest.fn(),
          scrollSnapList: () => [0],
          selectedScrollSnap: () => 0,
          canScrollNext: () => true,
          canScrollPrev: () => true,
          on: jest.fn(),
          off: jest.fn()
        });
      }
    }, [setApi]);
    return <div data-testid="mock-carousel">{children}</div>;
  },
  CarouselContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CarouselItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

// Helper to create a minimal LookupTermResponse with 2 dictionaries
function makeResults(term: string, reading = 'よみ', dicts: Array<{ title: string; revision: string; origin?: string; defs: string[] }> = [
  { title: 'D1', revision: 'r1', origin: 'o1', defs: ['def1', 'def2'] },
  { title: 'D2', revision: 'r1', origin: 'o2', defs: ['defA'] }
]): LookupTermResponse {
  return {
    dictionaryResults: dicts.map(d => ({
      title: d.title,
      revision: d.revision,
      origin: d.origin || d.title,
      entries: [
        {
          text: term,
          reading,
          tags: [],
          ruleIdentifiers: '',
          score: 100,
          definitions: d.defs.map((content) => ({ type: 'simple', content })) as any,
          sequenceNumber: 1,
          termTags: []
        }
      ]
    })),
    pitchAccentResults: {},
    frequencyDataLists: {}
  }
}

describe('SearchPane checkbox behavior', () => {
  it('resets checkboxes when a brand-new SearchPane is spawned for a new term', async () => {
    const user = userEvent.setup()

    const initialResults = makeResults('食べる')
    const nextResults = makeResults('飲む')

    const onSearch = jest.fn()
    const onBack = jest.fn()
    const setSearchStack = jest.fn()

    const { rerender, unmount } = render(
      <SearchPane
        searchQuery={'食べる'}
        searchResult={initialResults}
        isLoading={false}
        onSearch={onSearch}
        onBack={onBack}
        stackPosition={'1/1'}
        searchStack={[{ query: '食べる', results: initialResults, position: 0 }]}
        setSearchStack={setSearchStack}
        isStandalone={true}
        isAuthenticated={false}
      />
    )

    // Find the first dictionary checkbox in the visible layer
    const visibleLayerContainer = Array.from(document.querySelectorAll('div.absolute.inset-0')).find(el => !el.className.includes('hidden')) as HTMLElement
    const visibleLayer = visibleLayerContainer?.querySelector('div.flex-1.overflow-y-auto') as HTMLElement
    const firstCheckbox = within(visibleLayer).getAllByRole('checkbox')[0] as HTMLElement

    // Initially unchecked
    expect(firstCheckbox).toHaveAttribute('data-state', 'unchecked')

    // Check it
    await user.click(firstCheckbox)
    expect(firstCheckbox).toHaveAttribute('data-state', 'checked')

    // Simulate a brand-new SearchPane instance being spawned (unmount then mount)
    unmount()
    render(
      <SearchPane
        searchQuery={'飲む'}
        searchResult={nextResults}
        isLoading={false}
        onSearch={onSearch}
        onBack={onBack}
        stackPosition={'1/1'}
        searchStack={[{ query: '飲む', results: nextResults, position: 0 }]}
        setSearchStack={setSearchStack}
        isStandalone={true}
        isAuthenticated={false}
      />
    )

    // In the new layer, the checkboxes should be reset
    const visibleLayerContainer2 = Array.from(document.querySelectorAll('div.absolute.inset-0')).find(el => !el.className.includes('hidden')) as HTMLElement
    const visibleLayer2 = visibleLayerContainer2?.querySelector('div.flex-1.overflow-y-auto') as HTMLElement
    const firstCheckboxLayer2 = within(visibleLayer2).getAllByRole('checkbox')[0] as HTMLElement
    await waitFor(() => expect(firstCheckboxLayer2).toHaveAttribute('data-state', 'unchecked'))

  })

  it('clears deeper layer state when navigating back (3->2 and 2->0)', async () => {
    const user = userEvent.setup()

    const r0 = makeResults('A')
    const r1 = makeResults('B')
    const r2 = makeResults('C')
    const r3 = makeResults('D')

    const { rerender } = render(
      <SearchPane
        searchQuery={'A'}
        searchResult={r0}
        isLoading={false}
        onSearch={jest.fn()}
        onBack={jest.fn()}
        stackPosition={'1/4'}
        searchStack={[{ query: 'A', results: r0, position: 0 }, { query: 'B', results: r1, position: 0 }, { query: 'C', results: r2, position: 0 }, { query: 'D', results: r3, position: 0 }]}
        setSearchStack={jest.fn()}
        isStandalone={true}
        isAuthenticated={false}
      />
    )

    // Simulate being at layer 4/4 (index 3): check first checkbox
    let currentLayerContainer = Array.from(document.querySelectorAll('div.absolute.inset-0')).find(el => !el.className.includes('hidden')) as HTMLElement
    let currentLayer = currentLayerContainer?.querySelector('div.flex-1.overflow-y-auto') as HTMLElement
    let first = within(currentLayer).getAllByRole('checkbox')[0] as HTMLElement
    await user.click(first)
    expect(first).toHaveAttribute('data-state', 'checked')

    // Navigate back to layer 3/3 (drop index 3)
    rerender(
      <SearchPane
        searchQuery={'C'}
        searchResult={r2}
        isLoading={false}
        onSearch={jest.fn()}
        onBack={jest.fn()}
        stackPosition={'3/3'}
        searchStack={[{ query: 'A', results: r0, position: 0 }, { query: 'B', results: r1, position: 0 }, { query: 'C', results: r2, position: 0 }]}
        setSearchStack={jest.fn()}
        isStandalone={true}
        isAuthenticated={false}
      />
    )

    // Now recurse again to new layer (fresh): should be unchecked
    rerender(
      <SearchPane
        searchQuery={'D'}
        searchResult={r3}
        isLoading={false}
        onSearch={jest.fn()}
        onBack={jest.fn()}
        stackPosition={'4/4'}
        searchStack={[{ query: 'A', results: r0, position: 0 }, { query: 'B', results: r1, position: 0 }, { query: 'C', results: r2, position: 0 }, { query: 'D', results: r3, position: 0 }]}
        setSearchStack={jest.fn()}
        isStandalone={true}
        isAuthenticated={false}
      />
    )
    currentLayerContainer = Array.from(document.querySelectorAll('div.absolute.inset-0')).find(el => !el.className.includes('hidden')) as HTMLElement
    currentLayer = currentLayerContainer?.querySelector('div.flex-1.overflow-y-auto') as HTMLElement
    first = within(currentLayer).getAllByRole('checkbox')[0] as HTMLElement
    await waitFor(() => expect(first).toHaveAttribute('data-state', 'unchecked'))

    // Now go all the way back to 1/1, ensure deeper states are gone
    rerender(
      <SearchPane
        searchQuery={'A'}
        searchResult={r0}
        isLoading={false}
        onSearch={jest.fn()}
        onBack={jest.fn()}
        stackPosition={'1/1'}
        searchStack={[{ query: 'A', results: r0, position: 0 }]}
        setSearchStack={jest.fn()}
        isStandalone={true}
        isAuthenticated={false}
      />
    )
    // Recurse again to new layer: unchecked
    rerender(
      <SearchPane
        searchQuery={'B'}
        searchResult={r1}
        isLoading={false}
        onSearch={jest.fn()}
        onBack={jest.fn()}
        stackPosition={'2/2'}
        searchStack={[{ query: 'A', results: r0, position: 0 }, { query: 'B', results: r1, position: 0 }]}
        setSearchStack={jest.fn()}
        isStandalone={true}
        isAuthenticated={false}
      />
    )
    currentLayerContainer = Array.from(document.querySelectorAll('div.absolute.inset-0')).find(el => !el.className.includes('hidden')) as HTMLElement
    currentLayer = currentLayerContainer?.querySelector('div.flex-1.overflow-y-auto') as HTMLElement
    first = within(currentLayer).getAllByRole('checkbox')[0] as HTMLElement
    await waitFor(() => expect(first).toHaveAttribute('data-state', 'unchecked'))
  })

  it('resets checkboxes when typing a new single-layer search (1→1 with different query)', async () => {
    const user = userEvent.setup()

    const rA = makeResults('A')
    const rB = makeResults('B')

    const { rerender } = render(
      <SearchPane
        searchQuery={'A'}
        searchResult={rA}
        isLoading={false}
        onSearch={jest.fn()}
        onBack={jest.fn()}
        stackPosition={'1/1'}
        searchStack={[{ query: 'A', results: rA, position: 0 }]}
        setSearchStack={jest.fn()}
        isStandalone={true}
        isAuthenticated={false}
      />
    )

    // Check first checkbox on A
    let visibleLayerContainer = Array.from(document.querySelectorAll('div.absolute.inset-0')).find(el => !el.className.includes('hidden')) as HTMLElement
    let visibleLayer = visibleLayerContainer?.querySelector('div.flex-1.overflow-y-auto') as HTMLElement
    let first = within(visibleLayer).getAllByRole('checkbox')[0] as HTMLElement
    await user.click(first)
    expect(first).toHaveAttribute('data-state', 'checked')

    // Type a new single-layer search (still 1/1) with query B
    rerender(
      <SearchPane
        searchQuery={'B'}
        searchResult={rB}
        isLoading={false}
        onSearch={jest.fn()}
        onBack={jest.fn()}
        stackPosition={'1/1'}
        searchStack={[{ query: 'B', results: rB, position: 0 }]}
        setSearchStack={jest.fn()}
        isStandalone={true}
        isAuthenticated={false}
      />
    )

    // Expect reset
    visibleLayerContainer = Array.from(document.querySelectorAll('div.absolute.inset-0')).find(el => !el.className.includes('hidden')) as HTMLElement
    visibleLayer = visibleLayerContainer?.querySelector('div.flex-1.overflow-y-auto') as HTMLElement
    first = within(visibleLayer).getAllByRole('checkbox')[0] as HTMLElement
    await waitFor(() => expect(first).toHaveAttribute('data-state', 'unchecked'))
  })

  it('clears previous layer selection when returning via breadcrumbs (2→1 with stack shrink)', async () => {
    const user = userEvent.setup()

    const rA = makeResults('A')
    const rB = makeResults('B')

    const { rerender } = render(
      <SearchPane
        searchQuery={'B'}
        searchResult={rB}
        isLoading={false}
        onSearch={jest.fn()}
        onBack={jest.fn()}
        stackPosition={'2/2'}
        searchStack={[{ query: 'A', results: rA, position: 0 }, { query: 'B', results: rB, position: 0 }]}
        setSearchStack={jest.fn()}
        isStandalone={true}
        isAuthenticated={false}
      />
    )

    // On layer 2, check one
    let visibleLayerContainer = Array.from(document.querySelectorAll('div.absolute.inset-0')).find(el => !el.className.includes('hidden')) as HTMLElement
    let visibleLayer = visibleLayerContainer?.querySelector('div.flex-1.overflow-y-auto') as HTMLElement
    let first = within(visibleLayer).getAllByRole('checkbox')[0] as HTMLElement
    await user.click(first)
    expect(first).toHaveAttribute('data-state', 'checked')

    // Breadcrumb back to 1/1 (stack shrinks)
    rerender(
      <SearchPane
        searchQuery={'A'}
        searchResult={rA}
        isLoading={false}
        onSearch={jest.fn()}
        onBack={jest.fn()}
        stackPosition={'1/1'}
        searchStack={[{ query: 'A', results: rA, position: 0 }]}
        setSearchStack={jest.fn()}
        isStandalone={true}
        isAuthenticated={false}
      />
    )

    // Expect cleared
    visibleLayerContainer = Array.from(document.querySelectorAll('div.absolute.inset-0')).find(el => !el.className.includes('hidden')) as HTMLElement
    visibleLayer = visibleLayerContainer?.querySelector('div.flex-1.overflow-y-auto') as HTMLElement
    first = within(visibleLayer).getAllByRole('checkbox')[0] as HTMLElement
    await waitFor(() => expect(first).toHaveAttribute('data-state', 'unchecked'))
  })
})
