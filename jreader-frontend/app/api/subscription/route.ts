import { NextResponse } from 'next/server';

import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Query the public.Users table to get the user's tier
    const { data: userData, error: userError } = await supabase
      .from('Users')
      .select('tier')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('Error fetching user tier:', userError);
      // Default to free tier if user not found in Users table
      return NextResponse.json({ tier: 0, isSubscribed: false });
    }

    const tier = userData?.tier || 0;
    const isSubscribed = tier >= 1; // 0 = free, 1+ = pro

    return NextResponse.json({ 
      tier, 
      isSubscribed 
    });

  } catch (error) {
    console.error('Subscription check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 