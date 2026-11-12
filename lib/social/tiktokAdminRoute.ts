import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import type { TikTokAdminSessionResult } from "@/lib/social/tiktokAdminConfig";
import { isMissingSchemaError, redactSecrets, schemaMissingResponseBody } from "@/lib/social/tiktokUnified";

type FailedSession = Extract<TikTokAdminSessionResult, { ok: false }>;

/** Shared JSON error for a failed TikTok admin session (401/403/503/404/other). */
export function tiktokSessionErrorResponse(
  session: FailedSession,
  fallbackError: string,
  on503?: () => NextResponse
): NextResponse {
  if (session.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (session.status === 503) {
    return on503
      ? on503()
      : NextResponse.json({ error: "TIKTOK_TEST_INFLUENCER_ID is not configured" }, { status: 503 });
  }
  if (session.status === 404) {
    return NextResponse.json({ error: "Test influencer not found" }, { status: 404 });
  }
  return NextResponse.json({ error: fallbackError }, { status: 500 });
}

/**
 * Load the active TikTok social_connections row for the test influencer.
 * Maps schema-missing / query errors to the same JSON responses the routes used inline.
 */
export async function loadActiveTikTokConnection<T>(opts: {
  influencerId: string;
  columns: string;
  context: string;
  logLabel: string;
  errorCode: string;
}): Promise<{ ok: true; row: T | null } | { ok: false; response: NextResponse }> {
  const { data, error } = await supabaseService()
    .from("social_connections")
    .select(opts.columns)
    .eq("influencer_id", opts.influencerId)
    .eq("platform", "tiktok")
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    if (isMissingSchemaError(error)) {
      return { ok: false, response: NextResponse.json(schemaMissingResponseBody(opts.context), { status: 503 }) };
    }
    console.error(`[tt-oauth] ${opts.logLabel}`, redactSecrets(error.message || ""));
    return { ok: false, response: NextResponse.json({ error: opts.errorCode }, { status: 500 }) };
  }
  return { ok: true, row: (data as T | null) ?? null };
}
