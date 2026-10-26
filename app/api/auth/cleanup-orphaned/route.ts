import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { cleanupOrphanedAuthByEmail } from "@/lib/cleanupOrphanedAuth";

/**
 * Signup / dashboard recovery: remove an auth user that has no influencers row.
 * Not an admin route — callers must only pass the email they are registering with.
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    const result = await cleanupOrphanedAuthByEmail(supabaseService(), String(email || ""));
    return NextResponse.json(result.body, { status: result.status });
  } catch (error: unknown) {
    console.error("Error in auth cleanup-orphaned API:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: "Internal server error", details: message }, { status: 500 });
  }
}
