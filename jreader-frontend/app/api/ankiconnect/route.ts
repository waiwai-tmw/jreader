import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';

import { syncCardsToAnki, updateCardsInAnki } from '@/utils/ankiconnect/ankiconnect';
import { createClient } from '@/utils/supabase/server';

type AnkiSettings = {
  anki_connect_url: string;
  anki_deck: string;
  anki_note_type: string;
};

type AnkiConnectPlanRequest = {
  ankiSettings: AnkiSettings;
  fieldMappings?: Record<string, any>;
  cardIds?: string[];
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: AnkiConnectPlanRequest = await request.json().catch(() => ({} as any));
    const { ankiSettings, fieldMappings = {}, cardIds } = body || ({} as any);

    if (!ankiSettings || !ankiSettings.anki_connect_url || !ankiSettings.anki_deck || !ankiSettings.anki_note_type) {
      return NextResponse.json({ error: 'Missing required ankiSettings (anki_connect_url, anki_deck, anki_note_type)' }, { status: 400 });
    }

    let query = supabase
      .from('cards')
      .select('*')
      .eq('user_id', user.id)
      .is('anki_note_id', null);

    if (Array.isArray(cardIds) && cardIds.length > 0) {
      query = query.in('id', cardIds);
    }

    const { data: cards, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { addNotesRequest, mediaPlans } = await syncCardsToAnki(cards ?? [], ankiSettings, fieldMappings);

    return NextResponse.json({ addNotesRequest, mediaPlans }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({} as any));
    const { cardIds, fieldMappings = {} } = body || ({} as any);

    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      return NextResponse.json({ error: 'Missing required cardIds array' }, { status: 400 });
    }

    // Get cards that have already been synced to Anki
    const { data: cards, error } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', user.id)
      .in('id', cardIds)
      .not('anki_note_id', 'is', null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { requests, skippedCards } = await updateCardsInAnki(cards ?? [], fieldMappings);

    return NextResponse.json({ requests, skippedCards }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

