import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";

import { ensureMap } from "../shared";

import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { nonce } = await request.json();
    console.log("Completing pairing for nonce:", nonce);
    
    if (!nonce) {
      console.error("No nonce provided");
      return NextResponse.json({ ok: false, error: "No nonce provided" }, { status: 400 });
    }
    
    console.log("Marked nonce as completed:", nonce);
    
    // Ensure we have a Map instance
    const noncesMap = ensureMap();
    console.log("All completed nonces:", Array.from(noncesMap.keys()));
    
    // Get the current Supabase session
    console.log("Creating Supabase client...");
    console.log("SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "Not set");
    console.log("SUPABASE_ANON_KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Set" : "Not set");
    
    const supabase = await createClient();
    console.log("Supabase client created:", !!supabase);
    console.log("Supabase auth:", !!supabase.auth);
    
    if (!supabase || !supabase.auth) {
      throw new Error("Failed to create Supabase client");
    }
    
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error("Error getting session:", error);
      // Still complete pairing even if session fetch fails
      noncesMap.set(nonce, null);
      return NextResponse.json({ ok: true, session_data: null });
    }
    
    if (session) {
      console.log("Found session for user:", session.user?.id);
      
      // Store session data with the nonce for the extension to retrieve
      const sessionData = {
        type: "SET_SUPABASE_SESSION",
        nonce,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        // Include Supabase configuration
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabase_anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      };
      
      // Store in the shared nonces map with session data
      noncesMap.set(nonce, sessionData);
      console.log("Stored session data for nonce:", nonce);
    } else {
      console.log("No session found - user not authenticated");
      // No session, just mark as completed without session data
      noncesMap.set(nonce, null);
    }
    
    // Get the session data that was stored
    const sessionData = noncesMap.get(nonce);
    
    return NextResponse.json({ 
      ok: true,
      session_data: sessionData
    });
    
  } catch (error) {
    console.error("Error in complete endpoint:", error);
    return NextResponse.json({ 
      ok: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}
