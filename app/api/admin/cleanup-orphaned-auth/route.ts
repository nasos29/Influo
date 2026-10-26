import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin, supabaseService } from "@/lib/apiAuth";
import { cleanupOrphanedAuthByEmail } from "@/lib/cleanupOrphanedAuth";

export async function POST(request: NextRequest) {
  try {
    const denied = await rejectUnlessAdmin(request);
    if (denied) return denied;

    const { email } = await request.json();
    const result = await cleanupOrphanedAuthByEmail(supabaseService(), String(email || ""));
    return NextResponse.json(result.body, { status: result.status });
  } catch (error: unknown) {
    console.error("Error in cleanup-orphaned-auth API:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: "Internal server error", details: message }, { status: 500 });
  }
}
