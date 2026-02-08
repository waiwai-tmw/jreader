import { NextResponse } from 'next/server';

import { createServiceRoleClient } from '@/utils/supabase/service-role';

export async function GET(request: Request) {
  console.log('=== Recent Webnovels API Route Started ===');
  
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    
    console.log('Pagination params:', { page, limit, offset });
    
    const supabase = createServiceRoleClient();
    console.log('Supabase service role client created successfully');
    
    // Test if we can access the supabase client
    console.log('Supabase client type:', typeof supabase);
    console.log('Supabase from method:', typeof supabase.from);
    
    // Get total count first
    const { count: totalCount, error: countError } = await supabase
      .from('webnovel')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error getting total count:', countError);
    }
    
    // Get the paginated recent webnovel imports
    const { data: recentWebnovels, error } = await supabase
      .from('webnovel')
      .select('id, title, author, url, created_at, syosetu_metadata')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching recent webnovels:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      // Return empty array instead of error to prevent UI issues
      return NextResponse.json({
        webnovels: [],
        error: 'Unable to fetch recent webnovels'
      });
    }

    console.log('Successfully fetched recent webnovels:', recentWebnovels?.length || 0);
    console.log('Total count:', totalCount);
    
    return NextResponse.json({
      webnovels: recentWebnovels || [],
      pagination: {
        page,
        limit,
        totalCount: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
        hasNextPage: offset + limit < (totalCount || 0),
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Recent webnovels API error:', error);
    console.error('Error type:', typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    // Return empty array instead of error to prevent UI issues
    return NextResponse.json({
      webnovels: [],
      error: 'Internal server error'
    });
  }
}
