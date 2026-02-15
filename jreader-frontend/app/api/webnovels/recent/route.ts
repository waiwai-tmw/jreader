import { NextResponse } from 'next/server';
import { desc, count, eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';

import { db, webnovel, userWebnovel, users } from '@/db';

export async function GET(request: Request) {
  console.log('=== Recent Webnovels API Route Started ===');

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    console.log('Pagination params:', { page, limit, offset });

    // Get username from cookie
    const cookieStore = await cookies();
    const username = cookieStore.get('jreader_username')?.value;

    // Get user ID if logged in
    let userId: string | null = null;
    if (username) {
      const userResult = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);
      userId = userResult[0]?.id || null;
    }

    // Get total count first
    const totalCountResult = await db.select({ count: count() }).from(webnovel);
    const totalCount = totalCountResult[0]?.count || 0;

    console.log('Total webnovels count:', totalCount);

    // Get the paginated recent webnovel imports
    const recentWebnovels = await db
      .select({
        id: webnovel.id,
        title: webnovel.title,
        author: webnovel.author,
        url: webnovel.url,
        created_at: webnovel.created_at,
        syosetu_metadata: webnovel.syosetu_metadata,
      })
      .from(webnovel)
      .orderBy(desc(webnovel.created_at))
      .limit(limit)
      .offset(offset);

    // If user is logged in, check which webnovels they already have
    let webnovelsWithStatus = recentWebnovels;
    if (userId) {
      const userWebnovelIds = await db
        .select({ webnovel_id: userWebnovel.webnovel_id })
        .from(userWebnovel)
        .where(eq(userWebnovel.user_id, userId));

      const userWebnovelIdSet = new Set(userWebnovelIds.map(uw => uw.webnovel_id));

      webnovelsWithStatus = recentWebnovels.map(wn => ({
        ...wn,
        userHasIt: userWebnovelIdSet.has(wn.id)
      }));
    }

    console.log('Successfully fetched recent webnovels:', recentWebnovels.length);

    return NextResponse.json({
      webnovels: webnovelsWithStatus,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: offset + limit < totalCount,
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
      pagination: {
        page: 1,
        limit: 10,
        totalCount: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false
      },
      error: 'Internal server error'
    });
  }
}
