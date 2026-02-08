import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";

import { ensureMap } from "../shared";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nonce = searchParams.get("nonce");
  
  console.log("Checking status for nonce:", nonce);
  
  // Ensure we have a Map instance
  const noncesMap = ensureMap();
  console.log("Completed nonces:", Array.from(noncesMap.keys()));
  
  if (nonce && noncesMap.has(nonce)) {
    console.log("Nonce is completed, returning claimed status");
    const sessionData = noncesMap.get(nonce);
    
    return NextResponse.json({ 
      status: "claimed", 
      device_token: "jrdr_dev_dummy",
      session_data: sessionData
    });
  } else {
    console.log("Nonce not completed yet, returning pending status");
    return NextResponse.json({ 
      status: "pending"
    });
  }
}
