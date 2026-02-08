import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useSubscription } from './useSubscription';

import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';

enum KanjiState {
  NOT_MINED = -1,
  ENCOUNTERED = 0,
  KNOWN = 1
}

export enum KanjiQueryEnabled {
  ENABLED = 'enabled',
  DISABLED = 'disabled'
}

export enum SubscriptionCheck {
  CHECK = 'check',
  DONT_CHECK = 'dont_check'
}

interface KanjiStateCache {
  knownKanji: string[];
  encounteredKanji: string[];
}

export function useKanjiStates(
  enabled: KanjiQueryEnabled = KanjiQueryEnabled.ENABLED, 
  checkSubscription: SubscriptionCheck = SubscriptionCheck.DONT_CHECK
) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { data: subscriptionData, isLoading: subscriptionLoading } = useSubscription();
  const { user } = useAuth();

  // Determine if the query should be enabled
  const shouldEnable = enabled === KanjiQueryEnabled.ENABLED && 
    (checkSubscription === SubscriptionCheck.DONT_CHECK || subscriptionData?.isSubscribed === true);

  const { data, isLoading, error } = useQuery({
    queryKey: ['kanjiStates'],
    queryFn: async () => {
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('User Kanji')
        .select('kanji, state')
        .eq('user_id', user.id);

      if (error) throw error;

      const knownKanji = data
        .filter(k => k.state === KanjiState.KNOWN)
        .map(k => k.kanji);
      const encounteredKanji = data
        .filter(k => k.state === KanjiState.ENCOUNTERED)
        .map(k => k.kanji);

      return { knownKanji, encounteredKanji };
    },
    enabled: shouldEnable && !!user, // Only enable if user is available
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const updateKanjiState = async (kanji: string, newState: KanjiState) => {
    if (!user) {
      console.log('Cannot update kanji state: user not authenticated');
      return;
    }

    // Safety check: Don't downgrade known kanji to encountered
    if (newState === KanjiState.ENCOUNTERED && data?.knownKanji.includes(kanji)) {
      console.log(`Skipping update for kanji ${kanji} - already known`);
      return;
    }

    if (newState === KanjiState.NOT_MINED) {
      await supabase
        .from('User Kanji')
        .delete()
        .eq('user_id', user.id)
        .eq('kanji', kanji);
    } else {
      await supabase
        .from('User Kanji')
        .upsert({
          user_id: user.id,
          kanji,
          state: newState
        });
    }

    // Update React Query cache immediately
    queryClient.setQueryData(['kanjiStates'], (oldData: KanjiStateCache | undefined) => {
      if (!oldData) return oldData;
      
      const newKnownKanji = oldData.knownKanji.filter(k => k !== kanji);
      const newEncounteredKanji = oldData.encounteredKanji.filter(k => k !== kanji);

      if (newState === KanjiState.KNOWN) {
        newKnownKanji.push(kanji);
      } else if (newState === KanjiState.ENCOUNTERED) {
        newEncounteredKanji.push(kanji);
      }

      return {
        knownKanji: newKnownKanji,
        encounteredKanji: newEncounteredKanji
      };
    });

    // Dispatch DOM event without updating React state
    window.dispatchEvent(new CustomEvent('kanjistatechange', {
      detail: { kanji, newState }
    }));
  };

  const cycleKanjiState = async (kanji: string, directToKnown: boolean = false) => {
    const currentState = data?.knownKanji.includes(kanji) 
      ? KanjiState.KNOWN 
      : data?.encounteredKanji.includes(kanji)
        ? KanjiState.ENCOUNTERED
        : KanjiState.NOT_MINED;

    let newState: KanjiState;
    if (currentState === KanjiState.KNOWN) {
      newState = directToKnown ? KanjiState.KNOWN : KanjiState.NOT_MINED;
    } else if (currentState === KanjiState.ENCOUNTERED) {
      newState = KanjiState.KNOWN;
    } else {
      newState = directToKnown ? KanjiState.KNOWN : KanjiState.ENCOUNTERED;
    }

    await updateKanjiState(kanji, newState);
    return newState;
  };

  const markKanjiAsEncountered = async (text: string) => {
    const kanji = Array.from(new Set(
      Array.from(text).filter(char => 
        char.match(/[\u4E00-\u9FFF]/) &&
        !data?.knownKanji.includes(char) &&
        !data?.encounteredKanji.includes(char)
      )
    ));

    if (kanji.length > 0) {
      console.log(`Marking kanji as encountered: ${kanji.join(', ')} from text: "${text}"`);
    }

    for (const k of kanji) {
      await updateKanjiState(k, KanjiState.ENCOUNTERED);
    }
  };

  return {
    knownKanji: data?.knownKanji ?? [],
    encounteredKanji: data?.encounteredKanji ?? [],
    isLoading,
    cycleKanjiState,
    markKanjiAsEncountered,
    error,
  };
} 