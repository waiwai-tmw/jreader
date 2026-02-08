import type { NextRequest } from "next/server";

import { generateSignedUrl } from "@/utils/signedUrl";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rawPath = url.searchParams.get("path"); // e.g. "dicts/image.jpg"
  
  return generateSignedUrl(req, rawPath ?? "", {
    pathPrefix: "/media/img/",
    ttlSeconds: 180
  });
}
