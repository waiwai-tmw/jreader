'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import kanjiData from '@/data/kanji.json'
import { useKanjiStates, KanjiQueryEnabled, SubscriptionCheck } from '@/hooks/useKanjiStates'
import { createClient } from '@/utils/supabase/client'

type GroupKey = 'JLPT Level' | 'Grade' | 'Kanji Kentei Level'

interface KanjiGridProps {
  disabled?: boolean
}

export default function KanjiGrid({ disabled = false }: KanjiGridProps) {
  const [selectedGroup, setSelectedGroup] = useState<GroupKey>('JLPT Level')
  const { knownKanji, encounteredKanji, isLoading, cycleKanjiState, error: kanjiError } = useKanjiStates(
    disabled ? KanjiQueryEnabled.DISABLED : KanjiQueryEnabled.ENABLED, 
    SubscriptionCheck.CHECK
  )
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Dummy data for non-subscribers - simulate some known and encountered kanji
  const dummyKnownKanji = ['一', '二', '三', '人', '大', '小', '上', '下', '中', '山', '川', '火', '水', '土', '木', '金', '月', '日', '年', '時']
  const dummyEncounteredKanji = ['右', '雨', '円', '何', '外', '学', '間', '気', '休', '九', '見', '五', '午', '後', '語', '校', '行', '高', '国', '今']

  if (kanjiError) {
    console.error('💥 KanjiGrid: Kanji states error:', kanjiError);
    return <div className="text-red-500">Failed to load kanji states</div>;
  }

  const handleKanjiClick = async (char: string) => {
    if (disabled) return
    
    try {
      console.log('🎯 KanjiGrid: Clicking kanji:', char);
      await cycleKanjiState(char, true);
      console.log('✅ KanjiGrid: Completed kanji cycle');
    } catch (error) {
      console.log('💥 KanjiGrid: Error cycling kanji state:', error);
    }
  }

  const handleMarkAllAsKnown = async (kanjiList: string) => {
    if (disabled) return
    
    try {
      console.log('🎯 KanjiGrid: Marking all as known for tier');
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Extract unique kanji characters that aren't already known
      const kanjiToMark = Array.from(new Set(
        Array.from(kanjiList).filter(char => 
          char.match(/[\u4E00-\u9FFF]/) && // is kanji
          !knownKanji.includes(char) // not already known
        )
      ))

      if (kanjiToMark.length === 0) return

      // Prepare rows for insertion
      const rows = kanjiToMark.map(kanji => ({
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
      
      console.log('✅ KanjiGrid: Completed marking all as known');
    } catch (error) {
      console.log('💥 KanjiGrid: Error marking all as known:', error);
    }
  }

  const getKanjiClass = (char: string) => {
    if (disabled) {
      if (dummyKnownKanji.includes(char)) {
        return 'bg-green-100 dark:bg-green-900/60 text-green-800 dark:text-green-300'
      }
      if (dummyEncounteredKanji.includes(char)) {
        return 'bg-yellow-50 dark:bg-yellow-900/60 text-yellow-800 dark:text-yellow-300'
      }
      return 'bg-background border-border'
    } else {
      if (knownKanji.includes(char)) {
        return 'bg-green-100 dark:bg-green-900/60 text-green-800 dark:text-green-300'
      }
      if (encounteredKanji.includes(char)) {
        return 'bg-yellow-50 dark:bg-yellow-900/60 text-yellow-800 dark:text-yellow-300'
      }
      return 'bg-background border-border'
    }
  }

  const getKanjiStateLabel = (char: string) => {
    if (disabled) {
      if (dummyKnownKanji.includes(char)) {
        return 'Known (Preview)'
      }
      if (dummyEncounteredKanji.includes(char)) {
        return 'Encountered (Preview)'
      }
      return 'Not Mined (Preview)'
    } else {
      if (knownKanji.includes(char)) {
        return 'Known'
      }
      if (encounteredKanji.includes(char)) {
        return 'Encountered'
      }
      return 'Not Mined'
    }
  }

  // Get all kanji from the selected category
  const getCategoryKanji = () => {
    const categoryData = kanjiData.groups[selectedGroup];
    const allCategoryKanji = Object.values(categoryData).join('');
    return new Set(allCategoryKanji.split(''));
  }

  // Get remaining kanji that are encountered or known but not in the selected category
  const getRemainingKanji = () => {
    if (disabled) {
      const categoryKanji = getCategoryKanji();
      const allUserKanji = [...dummyKnownKanji, ...dummyEncounteredKanji];
      return allUserKanji
        .filter(char => !categoryKanji.has(char))
        .sort(); // Sort alphabetically for predictable display
    } else {
      const categoryKanji = getCategoryKanji();
      const allUserKanji = [...knownKanji, ...encounteredKanji];
      return allUserKanji
        .filter(char => !categoryKanji.has(char))
        .sort(); // Sort alphabetically for predictable display
    }
  }

  if (isLoading && !disabled) {
    return <div className="p-4">Loading kanji states...</div>
  }

  if (kanjiError && !disabled) {
    return <div className="text-red-500">Failed to load kanji states</div>;
  }

  const remainingKanji = getRemainingKanji();

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-4 flex flex-col gap-2">
        <select 
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value as GroupKey)}
          className="p-2 rounded border border-border bg-background"
        >
          <option value="JLPT Level">JLPT Level</option>
          <option value="Grade">Grade</option>
          <option value="Kanji Kentei Level">Kanji Kentei Level</option>
        </select>

        <div className="text-sm flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-background border border-border rounded"></div>
            <span>Not Mined</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-50 dark:bg-yellow-900/60 border border-border rounded"></div>
            <span>Encountered</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 dark:bg-green-900/60 border border-border rounded"></div>
            <span>Known</span>
          </div>
        </div>
      </div>

      {Object.entries(kanjiData.groups[selectedGroup]).map(([level, kanji]) => (
        <div key={level} className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">{level}</h3>
            {!disabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMarkAllAsKnown(kanji)}
                className="text-xs h-7 px-2"
              >
                Mark All as Known
              </Button>
            )}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(2em,1fr))] gap-1">
            {kanji.split('').map((char, i) => (
              <div 
                key={`${char}-${i}`}
                className={`
                  aspect-square flex items-center justify-center 
                  border rounded transition-colors
                  ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                  ${getKanjiClass(char)}
                `}
                onClick={() => handleKanjiClick(char)}
                title={`${char} - ${getKanjiStateLabel(char)}`}
              >
                {char}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Additional section for remaining encountered and known kanji */}
      {remainingKanji.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">Other Kanji</h3>
            {!disabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMarkAllAsKnown(remainingKanji.join(''))}
                className="text-xs h-7 px-2"
              >
                Mark All as Known
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            Encountered and known kanji not in the selected category
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(2em,1fr))] gap-1">
            {remainingKanji.map((char, i) => (
              <div 
                key={`remaining-${char}-${i}`}
                className={`
                  aspect-square flex items-center justify-center 
                  border rounded transition-colors
                  ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                  ${getKanjiClass(char)}
                `}
                onClick={() => handleKanjiClick(char)}
                title={`${char} - ${getKanjiStateLabel(char)}`}
              >
                {char}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 