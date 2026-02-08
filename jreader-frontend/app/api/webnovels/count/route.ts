import { NextResponse } from 'next/server';

import { createServiceRoleClient } from '@/utils/supabase/service-role';

export async function GET() {
  try {
    const supabase = createServiceRoleClient();
    
    // Get total count of available webnovels
    const { count: totalCount, error: countError } = await supabase
      .from('webnovel')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error getting webnovel count:', countError);
      return NextResponse.json(
        { error: 'Failed to get webnovel count' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      totalCount: totalCount || 0
    });
    
  } catch (error) {
    console.error('Webnovel count API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
