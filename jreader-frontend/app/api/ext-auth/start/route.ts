import { randomBytes } from "crypto";
import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const nonce = randomBytes(16).toString("hex");
  // For now, don't even save it — just return it.
  return NextResponse.json({ nonce });
}
