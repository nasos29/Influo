import { NextResponse } from "next/server";
import {
  resolveTikTokAdminSession,
} from "@/lib/social/tiktokAdminConfig";
import { supabaseService } from "@/lib/apiAuth";
import {
  isMissingSchemaError,
  parseGrantedScopes,
  redactSecrets,
  sanitizeTikTokSpikeReport,
  schemaMissingResponseBody,
  tiktokRedirectUri,
  tiktokScopes,
} from "@/lib/social/tiktokUnified";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function scopesFromRow(granted: unknown): string[] {
  if (!Array.isArray(granted)) return [];
  return granted.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
}

/**
 * Admin-only TikTok connection status for TIKTOK_TEST_INFLUENCER_ID.
 * Never returns encrypted tokens or secrets.
 * Scopes come from granted_scopes (never config_id).
 */
export async function GET(request: Request) {
  const session = await resolveTikTokAdminSession(request);
  if (!session.ok) {
    if (session.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (session.status === 503) {
      return NextResponse.json(
        {
          ok: false,
          configured: false,
          error: "TIKTOK_TEST_INFLUENCER_ID is not configured",
          oauth: { redirectUri: tiktokRedirectUri(), scopes: tiktokScopes() },
        },
        { status: 503 }
      );
    }
    if (session.status === 404) {
      return NextResponse.json({ error: "Test influencer not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "status_failed" }, { status: 500 });
  }

  const { data: row, error } = await supabaseService()
    .from("social_connections")
    .select(
      "influencer_id, platform, platform_user_id, username, granted_scopes, graph_version, token_expires_at, refresh_token_expires_at, is_active, last_synced_at, last_error, last_spike_report, updated_at, created_at"
    )
    .eq("influencer_id", session.testInfluencerId)
    .eq("platform", "tiktok")
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    if (isMissingSchemaError(error)) {
      return NextResponse.json(schemaMissingResponseBody("status"), { status: 503 });
    }
    console.error("[tt-oauth] status query error", redactSecrets(error.message || ""));
    return NextResponse.json({ error: "status_query_failed" }, { status: 500 });
  }

  const spike = sanitizeTikTokSpikeReport(row?.last_spike_report);
  let scopesGranted = scopesFromRow(row?.granted_scopes);
  if (!scopesGranted.length && spike?.scopesGranted) {
    scopesGranted = parseGrantedScopes(spike.scopesGranted);
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    oauth: {
      redirectUri: tiktokRedirectUri(),
      scopes: tiktokScopes(),
      apiVersion: "v2",
    },
    testInfluencer: {
      id: session.influencer.id,
      displayName: session.influencer.display_name,
    },
    connection: row
      ? {
          connected: true,
          platformUserId: row.platform_user_id,
          username: row.username,
          displayName: spike?.profile?.displayName ?? null,
          avatarUrl: spike?.profile?.avatarUrl ?? null,
          followerCount: spike?.profile?.followerCount ?? null,
          followingCount: spike?.profile?.followingCount ?? null,
          likesCount: spike?.profile?.likesCount ?? null,
          videoCount: spike?.profile?.videoCount ?? null,
          scopesGranted,
          tokenExpiresAt: row.token_expires_at,
          refreshTokenExpiresAt: row.refresh_token_expires_at,
          lastSyncedAt: row.last_synced_at,
          lastError: row.last_error ? redactSecrets(String(row.last_error)).slice(0, 300) : null,
          updatedAt: row.updated_at,
          createdAt: row.created_at,
          demographicsSupported: false,
          spike,
        }
      : {
          connected: false,
          platformUserId: null,
          username: null,
          scopesGranted: [],
          tokenExpiresAt: null,
          refreshTokenExpiresAt: null,
          lastSyncedAt: null,
          lastError: null,
          demographicsSupported: false,
          spike: null,
        },
  });
}
