import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { resolveTikTokAdminSession } from "@/lib/social/tiktokAdminConfig";
import { loadActiveTikTokConnection, tiktokSessionErrorResponse } from "@/lib/social/tiktokAdminRoute";
import {
  accessTokenNeedsRefresh,
  formatGrantedScopes,
  isCompleteTikTokTokenSet,
  isMissingSchemaError,
  mergeGrantedScopes,
  redactSecrets,
  refreshTikTokAccessToken,
  runTikTokSpike,
  sanitizeTikTokSpikeReport,
  schemaMissingResponseBody,
  tokenExpiryIsoFromSeconds,
} from "@/lib/social/tiktokUnified";
import { decryptSecret, encryptSecret } from "@/lib/social/tokenCrypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConnectionRow = {
  id: string;
  influencer_id: string;
  platform_user_id: string | null;
  username: string | null;
  encrypted_access_token: string;
  encrypted_refresh_token: string | null;
  token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  granted_scopes: string[] | null;
};

/**
 * Ensure a usable access token; persist rotated refresh token when refreshed.
 * Returns critical failure if TikTok rotates tokens but DB persist fails.
 */
async function ensureAccessToken(row: ConnectionRow): Promise<
  | { ok: true; accessToken: string; scopesGranted: string | null; tokenExpiresAt: string | null }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
  const scopesGranted = formatGrantedScopes(row.granted_scopes);
  let accessToken: string;
  try {
    accessToken = decryptSecret(row.encrypted_access_token);
  } catch (e) {
    const message = e instanceof Error ? e.message : "decrypt_failed";
    console.error("[tt-oauth] spike decrypt access failed", redactSecrets(message));
    return { ok: false, status: 500, body: { error: "decrypt_failed" } };
  }

  if (!accessTokenNeedsRefresh(row.token_expires_at)) {
    return {
      ok: true,
      accessToken,
      scopesGranted,
      tokenExpiresAt: row.token_expires_at,
    };
  }

  if (!row.encrypted_refresh_token) {
    return { ok: false, status: 401, body: { error: "reauth_required", reason: "missing_refresh_token" } };
  }

  let refreshPlain: string;
  try {
    refreshPlain = decryptSecret(row.encrypted_refresh_token);
  } catch (e) {
    const message = e instanceof Error ? e.message : "decrypt_failed";
    console.error("[tt-oauth] spike decrypt refresh failed", redactSecrets(message));
    return { ok: false, status: 500, body: { error: "decrypt_failed" } };
  }

  const refreshed = await refreshTikTokAccessToken(refreshPlain);
  if (!refreshed.ok) {
    return {
      ok: false,
      status: refreshed.requiresReauth ? 401 : 502,
      body: {
        error: refreshed.requiresReauth ? "reauth_required" : "refresh_api_failed",
        requiresReauth: !!refreshed.requiresReauth,
      },
    };
  }
  if (!isCompleteTikTokTokenSet(refreshed.token)) {
    return { ok: false, status: 502, body: { error: "incomplete_refresh_token" } };
  }

  let encAccess: string;
  let encRefresh: string;
  try {
    encAccess = encryptSecret(refreshed.token.accessToken);
    encRefresh = encryptSecret(refreshed.token.refreshToken);
  } catch {
    return {
      ok: false,
      status: 500,
      body: {
        error: "refresh_persist_critical",
        reason: "encrypt_failed_after_rotation",
      },
    };
  }

  const accessExpiresAt = tokenExpiryIsoFromSeconds(refreshed.token.expiresIn);
  const refreshExpiresAt = tokenExpiryIsoFromSeconds(refreshed.token.refreshExpiresIn);
  const mergedScopes = mergeGrantedScopes(row.granted_scopes, refreshed.token.scope);

  const updatePayload: Record<string, unknown> = {
    encrypted_access_token: encAccess,
    encrypted_refresh_token: encRefresh,
    token_expires_at: accessExpiresAt,
    refresh_token_expires_at: refreshExpiresAt,
    platform_user_id: refreshed.token.openId || row.platform_user_id,
    updated_at: new Date().toISOString(),
  };
  if (mergedScopes) {
    updatePayload.granted_scopes = mergedScopes;
  }

  const { error: upErr } = await supabaseService()
    .from("social_connections")
    .update(updatePayload)
    .eq("id", row.id)
    .eq("platform", "tiktok");

  if (upErr) {
    console.error("[tt-oauth] CRITICAL spike refresh persist failed", upErr.message);
    return {
      ok: false,
      status: 500,
      body: {
        error: "refresh_persist_critical",
        reason: isMissingSchemaError(upErr) ? "schema_not_ready" : "persist_failed_after_rotation",
      },
    };
  }

  return {
    ok: true,
    accessToken: refreshed.token.accessToken,
    scopesGranted: formatGrantedScopes(mergedScopes) || scopesGranted,
    tokenExpiresAt: accessExpiresAt,
  };
}

/**
 * Admin-only TikTok Display API spike (profile + public videos).
 * demographicsSupported is always false. Never returns tokens.
 */
export async function GET(request: Request) {
  const session = await resolveTikTokAdminSession(request);
  if (!session.ok) return tiktokSessionErrorResponse(session, "spike_failed");

  const loaded = await loadActiveTikTokConnection<ConnectionRow>({
    influencerId: session.testInfluencerId,
    columns:
      "id, influencer_id, platform_user_id, username, encrypted_access_token, encrypted_refresh_token, token_expires_at, refresh_token_expires_at, granted_scopes, is_active",
    context: "spike",
    logLabel: "spike load error",
    errorCode: "spike_load_failed",
  });
  if (!loaded.ok) return loaded.response;
  const row = loaded.row;
  if (!row || !row.encrypted_access_token) {
    return NextResponse.json({ error: "No active TikTok connection" }, { status: 404 });
  }
  if (!row.platform_user_id) {
    return NextResponse.json({ error: "Connection incomplete" }, { status: 422 });
  }

  try {
    const ensured = await ensureAccessToken(row as ConnectionRow);
    if (!ensured.ok) {
      return NextResponse.json(ensured.body, { status: ensured.status });
    }

    const report = await runTikTokSpike(ensured.accessToken, {
      scopesGranted: ensured.scopesGranted || undefined,
    });
    report.demographicsSupported = false;

    const { error: saveErr } = await supabaseService()
      .from("social_connections")
      .update({
        last_spike_report: report,
        last_synced_at: new Date().toISOString(),
        last_error: report.profile.ok ? null : report.profile.error || null,
        username:
          report.profile.ok && report.profile.user?.username
            ? report.profile.user.username
            : report.profile.ok && report.profile.user?.display_name
              ? report.profile.user.display_name
              : row.username,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("platform", "tiktok");

    if (saveErr) {
      if (isMissingSchemaError(saveErr)) {
        return NextResponse.json(schemaMissingResponseBody("spike_save"), { status: 503 });
      }
      console.error("[tt-oauth] spike save error", saveErr.message);
      return NextResponse.json({ error: "spike_save_failed" }, { status: 500 });
    }

    const sanitized = sanitizeTikTokSpikeReport(report);
    return NextResponse.json({
      ok: true,
      demographicsSupported: false,
      connection: {
        influencerId: row.influencer_id,
        platformUserId: row.platform_user_id,
        username: row.username,
        tokenExpiresAt: ensured.tokenExpiresAt,
        scopesGranted: ensured.scopesGranted,
      },
      report: sanitized,
      scopeIssues: {
        profileMissingScope: !!(
          report.profile.error && report.profile.error.toLowerCase().includes("missing_scope")
        ),
        videosMissingScope: !!report.videos.missingScope,
        videosPermissionDenied: !!report.videos.permissionDenied,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "spike failed";
    console.error("[tt-oauth] spike error", redactSecrets(message));
    return NextResponse.json({ error: "spike_failed" }, { status: 500 });
  }
}
