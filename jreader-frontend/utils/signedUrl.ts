import crypto from "crypto";
import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";

import { getBackendApiUrl } from "@/utils/api";
import { createClient } from "@/utils/supabase/server";

function base64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function signPath(path: string, exp: number, key: string) {
  // MUST match Axum's verifier canonicalization
  const canonical = `GET\n${path}\nexp=${exp}`;
  const h = crypto.createHmac("sha256", key).update(canonical).digest();
  return base64url(h);
}

export interface SignedUrlOptions {
  pathPrefix: string; // e.g. "/media/" for audio or "/media/img/" for images
  ttlSeconds?: number; // defaults to 180 (3 minutes)
}

export async function generateSignedUrl(
  req: NextRequest,
  rawPath: string,
  options: SignedUrlOptions
): Promise<NextResponse> {
  if (!rawPath) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  // 1) AUTH CHECK — Supabase authentication
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Build the exact media path Axum will see (leading slash!)
  const mediaPath = `${options.pathPrefix}${rawPath}`;

  // 3) Short TTL (60–300s) - defaults to 3 minutes
  const ttl = options.ttlSeconds ?? 180;
  const exp = Math.floor(Date.now() / 1000) + ttl;

  const key = process.env.MEDIA_URL_KEY!;
  if (!key) {
    console.error("MEDIA_URL_KEY environment variable not set");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
  
  const sig = signPath(mediaPath, exp, key);

  // The browser will fetch Axum directly (no headers needed)
  const axumBase = getBackendApiUrl();
  
  const signedUrl = `${axumBase}${mediaPath}?exp=${exp}&sig=${encodeURIComponent(sig)}`;

  return NextResponse.json({ url: signedUrl });
}
