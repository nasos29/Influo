/**
 * Shared helpers for Vercel cron route handlers.
 * Auth: Authorization Bearer CRON_SECRET, or Vercel cron headers.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export function assertCronAuth(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const isVercelCron =
    request.headers.get("x-vercel-cron") === "1" ||
    request.headers.get("user-agent")?.includes("vercel-cron");

  if (cronSecret) {
    if (auth !== `Bearer ${cronSecret}` && !isVercelCron) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (!isVercelCron) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  return null;
}

/** Service-role Supabase client for cron jobs (no session). */
export function cronSupabaseAdmin(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
