import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { processCreatorStoragePurge } from "@/lib/purgeCreatorStorage";

/**
 * Drain the Storage purge queue (creators/<influencer_id>/ after influencer delete).
 * Auth: Authorization: Bearer CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processCreatorStoragePurge(supabaseService());
    return NextResponse.json({ ok: result.errors.length === 0, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "purge failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
