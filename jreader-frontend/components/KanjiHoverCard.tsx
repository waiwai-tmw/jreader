import { useState } from 'react'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  HoverCardPortal,
} from "@/components/ui/hover-card"
import { createClient } from '@/utils/supabase/client'

interface KanjiHoverCardProps {
  kanji: string;
  children: React.ReactNode;
}

interface CardWithKanji {
  expression: string;
  reading: string;
}

// Cache for storing fetched results
const resultsCache = new Map<string, CardWithKanji[]>();

export function KanjiHoverCard({ kanji, children }: KanjiHoverCardProps) {
  const [cards, setCards] = useState<CardWithKanji[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCards = async () => {
    // Return cached results if available
    if (resultsCache.has(kanji)) {
      setCards(resultsCache.get(kanji)!);
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();
      
      const { data } = await supabase
        .from('cards')
        .select('expression, reading')
        .ilike('expression', `%${kanji}%`)
        .order('created_at', { ascending: false });

      if (data) {
        resultsCache.set(kanji, data);
        setCards(data);
      }
    } catch (err) {
      console.error('Error fetching cards:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <HoverCard onOpenChange={(open) => {
      if (open) {
        fetchCards();
      } else {
        setLoading(false);
      }
    }}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardPortal>
        <HoverCardContent className="w-64 z-[9999]">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Cards with {kanji}</h4>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : cards.length > 0 ? (
            <div className="space-y-1">
              {cards.map((card, idx) => (
                <div key={idx} className="text-sm">
                  <ruby>
                    {card.expression}
                    <rt className="text-xs text-muted-foreground">{card.reading}</rt>
                  </ruby>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No cards found with this kanji</p>
          )}
        </div>
      </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
}
