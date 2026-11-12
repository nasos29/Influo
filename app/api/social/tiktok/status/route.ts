import { NextResponse } from "next/server";
import {
  resolveTikTokAdminSession,
} from "@/lib/social/tiktokAdminConfig";
import { loadActiveTikTokConnection, tiktokSessionErrorResponse } from "@/lib/social/tiktokAdminRoute";
import {
  parseGrantedScopes,
  redactSecrets,
  sanitizeTikTokSpikeReport,
  tiktokRedirectUri,
  tiktokScopes,
} from "@/lib/social/tiktokUnified";

type ConnectionRow = {
  influencer_id: string | null;
  platform: string | null;
  platform_user_id: string | null;
  username: string | null;
  granted_scopes: string[] | null;
  graph_version: string | null;
  token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  is_active: boolean | null;
  last_synced_at: string | null;
  last_error: string | null;
  last_spike_report: unknown;
  updated_at: string | null;
  created_at: string | null;
};

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
    return tiktokSessionErrorResponse(session, "status_failed", () =>
      NextResponse.json(
        {
          ok: false,
          configured: false,
          error: "TIKTOK_TEST_INFLUENCER_ID is not configured",
          oauth: { redirectUri: tiktokRedirectUri(), scopes: tiktokScopes() },
        },
        { status: 503 }
      )
    );
  }

  const loaded = await loadActiveTikTokConnection<ConnectionRow>({
    influencerId: session.testInfluencerId,
    columns:
      "influencer_id, platform, platform_user_id, username, granted_scopes, graph_version, token_expires_at, refresh_token_expires_at, is_active, last_synced_at, last_error, last_spike_report, updated_at, created_at",
    context: "status",
    logLabel: "status query error",
    errorCode: "status_query_failed",
  });
  if (!loaded.ok) return loaded.response;
  const row = loaded.row;

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
