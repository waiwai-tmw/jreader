import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";

import { generateSignedUrl } from "@/utils/signedUrl";

export async function GET(req: NextRequest) {
  try {
    console.log('🎵 DEBUG: Extension sign-audio-url API called');
    const url = new URL(req.url);
    const rawPath = url.searchParams.get("path"); // e.g. "jpod_files/media/track.opus"
    
    console.log('🎵 DEBUG: Extension sign-audio-url API params:', { rawPath, fullUrl: req.url });
    
    if (!rawPath) {
      console.log('🎵 DEBUG: Missing path parameter');
      return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
    }
    
    console.log('🎵 DEBUG: Calling generateSignedUrl with path:', rawPath);
    
    // This API route is specifically for the extension to get signed audio URLs
    // The extension will be authenticated via Supabase session, so we can trust the request
    // and proxy it to the internal signed URL generation
    const result = await generateSignedUrl(req, rawPath, {
      pathPrefix: "/media/",
      ttlSeconds: 180
    });
    
    console.log('🎵 DEBUG: generateSignedUrl result:', result);
    return result;
  } catch (error) {
    console.error('🎵 DEBUG: Error in extension sign-audio-url proxy:', error);
    return NextResponse.json(
      { error: "Failed to generate signed URL" }, 
      { status: 500 }
    );
  }
}
