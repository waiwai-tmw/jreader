import { NextResponse } from 'next/server';

import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const { webnovelId } = await request.json();
    
    if (!webnovelId) {
      return NextResponse.json(
        { error: 'Webnovel ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Check if the webnovel exists
    const { data: webnovel, error: webnovelError } = await supabase
      .from('webnovel')
      .select('id, title, author')
      .eq('id', webnovelId)
      .single();

    if (webnovelError || !webnovel) {
      return NextResponse.json(
        { error: 'Webnovel not found' },
        { status: 404 }
      );
    }

    // Get user's tier and enforce book limits
    const { data: userData, error: userDataError } = await supabase
      .from('Users')
      .select('tier')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData) {
      console.error('Error fetching user data:', userDataError);
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      );
    }

    // Count user's current books (regular uploads + webnovels)
    const { data: regularBooks, error: regularBooksError } = await supabase
      .from('User Uploads')
      .select('id')
      .eq('user_id', user.id);

    if (regularBooksError) {
      console.error('Error counting regular books:', regularBooksError);
      return NextResponse.json(
        { error: 'Failed to count books' },
        { status: 500 }
      );
    }

    const { data: userWebnovels, error: webnovelsError } = await supabase
      .from('user_webnovel')
      .select('webnovel_id')
      .eq('user_id', user.id);

    if (webnovelsError) {
      console.error('Error counting webnovels:', webnovelsError);
      return NextResponse.json(
        { error: 'Failed to count webnovels' },
        { status: 500 }
      );
    }

    // Determine book limit based on tier
    const getBookLimit = (tier: number) => {
      switch (tier) {
        case 0: // Free tier
          return 5;
        case 1: // Supporter tier
          return 25;
        case 2: // Unlimited tier
          return Infinity;
        default:
          return 5; // Default to free tier limit
      }
    };

    const bookLimit = getBookLimit(userData.tier);
    const regularBookCount = regularBooks?.length || 0;
    const webnovelCount = userWebnovels?.length || 0;
    const currentCount = regularBookCount + webnovelCount;

    console.log('Book limit check:', {
      tier: userData.tier,
      bookLimit,
      regularBookCount,
      webnovelCount,
      currentCount
    });

    // Check if user has reached their book limit
    if (currentCount >= bookLimit) {
      const tier = userData.tier;
      let errorMessage;
      if (tier === 0) {
        errorMessage = 'You have reached the maximum number of books (5). Consider joining the Supporter tier for up to 25 books and more features!';
      } else if (tier === 1) {
        errorMessage = 'You have reached the maximum number of books (25) for your current plan.';
      } else {
        errorMessage = 'You have reached the maximum number of books for your current plan.';
      }

      console.error('User reached book limit:', { tier, currentCount, bookLimit });
      return NextResponse.json(
        { error: errorMessage },
        { status: 403 }
      );
    }

    // Check if user already has this webnovel
    const { data: existingUserWebnovel, error: checkError } = await supabase
      .from('user_webnovel')
      .select('webnovel_id')
      .eq('user_id', user.id)
      .eq('webnovel_id', webnovelId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error('Error checking existing user webnovel:', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing webnovel' },
        { status: 500 }
      );
    }

    if (existingUserWebnovel) {
      return NextResponse.json(
        { error: 'You already have this webnovel in your library' },
        { status: 409 }
      );
    }

    // Add the webnovel to user's library
    const { data: userWebnovel, error: insertError } = await supabase
      .from('user_webnovel')
      .insert({
        user_id: user.id,
        webnovel_id: webnovelId
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting user webnovel:', insertError);
      return NextResponse.json(
        { error: 'Failed to add webnovel to library' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `"${webnovel.title}" by ${webnovel.author} has been added to your library`,
      webnovel: {
        id: webnovel.id,
        title: webnovel.title,
        author: webnovel.author
      }
    });

  } catch (error) {
    console.error('Import webnovel error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
