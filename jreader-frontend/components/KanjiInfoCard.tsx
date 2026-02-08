import { useState } from 'react'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  HoverCardPortal,
} from "@/components/ui/hover-card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useMediaQuery } from "@/hooks/use-media-query"
import { createClient } from '@/utils/supabase/client'

interface KanjiInfoCardProps {
  kanji: string;
  children: React.ReactNode;
}

interface CardWithKanji {
  expression: string;
  reading: string;
}

// Cache for storing fetched results
const resultsCache = new Map<string, CardWithKanji[]>();

function CardContent({ kanji, cards, loading }: { kanji: string; cards: CardWithKanji[]; loading: boolean }) {
  return (
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
  );
}

export function KanjiInfoCard({ kanji, children }: KanjiInfoCardProps) {
  const [cards, setCards] = useState<CardWithKanji[]>([]);
  const [loading, setLoading] = useState(false);
  const isTouch = useMediaQuery("(hover: none), (pointer: coarse)");

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

  if (isTouch) {
    return (
      <Popover onOpenChange={(open) => {
        if (open) {
          fetchCards();
        } else {
          setLoading(false);
        }
      }}>
        <PopoverTrigger asChild>
          <button type="button" className="inline-block">
            {children}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 z-[9999]">
          <CardContent kanji={kanji} cards={cards} loading={loading} />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <HoverCard openDelay={0} closeDelay={0} onOpenChange={(open) => {
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
          <CardContent kanji={kanji} cards={cards} loading={loading} />
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
}
