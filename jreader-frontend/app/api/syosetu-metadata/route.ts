import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';

import { fetchSyosetuMetadataServer, fetchSyosetuMetadataFromUrl } from '@/utils/syosetuServer';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ncode = searchParams.get('ncode');
    
    if (!ncode) {
      return NextResponse.json(
        { error: 'Ncode parameter is required' },
        { status: 400 }
      );
    }

    const metadata = await fetchSyosetuMetadataServer(ncode);
    if (metadata) {
      return NextResponse.json(metadata);
    }
    
    return NextResponse.json(
      { error: 'No metadata found for the given ncode' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error fetching Syosetu metadata:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also support POST for URL-based requests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    const metadata = await fetchSyosetuMetadataFromUrl(url);
    if (metadata) {
      return NextResponse.json(metadata);
    }
    
    return NextResponse.json(
      { error: 'No metadata found for the given URL' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error fetching Syosetu metadata:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
