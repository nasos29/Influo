import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { resolveTikTokAdminSession } from "@/lib/social/tiktokAdminConfig";
import { loadActiveTikTokConnection, tiktokSessionErrorResponse } from "@/lib/social/tiktokAdminRoute";
import {
  accessTokenNeedsRefresh,
  isCompleteTikTokTokenSet,
  isMissingSchemaError,
  mergeGrantedScopes,
  redactSecrets,
  refreshTikTokAccessToken,
  tokenExpiryIsoFromSeconds,
} from "@/lib/social/tiktokUnified";
import { decryptSecret, encryptSecret } from "@/lib/social/tokenCrypto";

type ConnectionRow = {
  id: string | null;
  influencer_id: string | null;
  platform: string | null;
  platform_user_id: string | null;
  encrypted_access_token: string | null;
  encrypted_refresh_token: string | null;
  token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  granted_scopes: string[] | null;
  is_active: boolean | null;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only TikTok token refresh for the designated test connection.
 * Always persists the rotated refresh_token with the new access token (atomic update).
 * Never returns tokens to the browser.
 */
export async function POST(request: Request) {
  const session = await resolveTikTokAdminSession(request);
  if (!session.ok) return tiktokSessionErrorResponse(session, "refresh_failed");

  let force = false;
  try {
    const body = (await request.json().catch(() => ({}))) as { force?: boolean };
    force = body?.force === true;
  } catch {
    force = false;
  }

  const loaded = await loadActiveTikTokConnection<ConnectionRow>({
    influencerId: session.testInfluencerId,
    columns:
      "id, influencer_id, platform, platform_user_id, encrypted_access_token, encrypted_refresh_token, token_expires_at, refresh_token_expires_at, granted_scopes, is_active",
    context: "refresh",
    logLabel: "refresh load error",
    errorCode: "refresh_load_failed",
  });
  if (!loaded.ok) return loaded.response;
  const row = loaded.row;
  if (!row) {
    return NextResponse.json({ error: "No active TikTok connection" }, { status: 404 });
  }
  if (!row.encrypted_refresh_token) {
    return NextResponse.json({ error: "missing_refresh_token" }, { status: 422 });
  }

  if (!force && !accessTokenNeedsRefresh(row.token_expires_at)) {
    return NextResponse.json({
      ok: true,
      refreshed: false,
      reason: "not_needed",
      tokenExpiresAt: row.token_expires_at,
      refreshTokenExpiresAt: row.refresh_token_expires_at,
      platformUserId: row.platform_user_id,
    });
  }

  let refreshPlain: string;
  try {
    refreshPlain = decryptSecret(row.encrypted_refresh_token);
  } catch (e) {
    const message = e instanceof Error ? e.message : "decrypt_failed";
    console.error("[tt-oauth] refresh decrypt failed", redactSecrets(message));
    return NextResponse.json({ error: "decrypt_failed" }, { status: 500 });
  }

  const refreshed = await refreshTikTokAccessToken(refreshPlain);
  if (!refreshed.ok) {
    console.error("[tt-oauth] refresh api failed", {
      error: redactSecrets(refreshed.error),
      code: refreshed.errorCode,
    });
    await supabaseService()
      .from("social_connections")
      .update({
        last_error: redactSecrets(refreshed.error).slice(0, 300),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    return NextResponse.json(
      {
        ok: false,
        error: refreshed.requiresReauth ? "reauth_required" : "refresh_api_failed",
        requiresReauth: !!refreshed.requiresReauth,
      },
      { status: refreshed.requiresReauth ? 401 : 502 }
    );
  }

  if (!isCompleteTikTokTokenSet(refreshed.token)) {
    return NextResponse.json({ error: "incomplete_refresh_token" }, { status: 502 });
  }

  let encAccess: string;
  let encRefresh: string;
  try {
    encAccess = encryptSecret(refreshed.token.accessToken);
    encRefresh = encryptSecret(refreshed.token.refreshToken);
  } catch (e) {
    const message = e instanceof Error ? e.message : "encrypt_failed";
    console.error("[tt-oauth] refresh encrypt failed", redactSecrets(message));
    return NextResponse.json(
      {
        ok: false,
        error: "refresh_persist_critical",
        reason: "encrypt_failed_after_rotation",
        detail: "TikTok issued new tokens but local encryption failed — re-authorize required",
      },
      { status: 500 }
    );
  }

  const accessExpiresAt = tokenExpiryIsoFromSeconds(refreshed.token.expiresIn);
  const refreshExpiresAt = tokenExpiryIsoFromSeconds(refreshed.token.refreshExpiresIn);
  const previousScopes = Array.isArray(row.granted_scopes)
    ? (row.granted_scopes as string[])
    : null;
  const mergedScopes = mergeGrantedScopes(previousScopes, refreshed.token.scope);

  // Never write TikTok scopes into config_id. Only update granted_scopes when we have a value
  // (incoming or preserved) so empty refresh scope responses cannot wipe prior scopes.
  const updatePayload: Record<string, unknown> = {
    encrypted_access_token: encAccess,
    encrypted_refresh_token: encRefresh,
    token_expires_at: accessExpiresAt,
    refresh_token_expires_at: refreshExpiresAt,
    platform_user_id: refreshed.token.openId || row.platform_user_id,
    last_error: null,
    last_synced_at: new Date().toISOString(),
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
    console.error("[tt-oauth] CRITICAL: refresh rotated but persist failed", upErr.message);
    return NextResponse.json(
      {
        ok: false,
        error: "refresh_persist_critical",
        reason: isMissingSchemaError(upErr) ? "schema_not_ready" : "persist_failed_after_rotation",
        detail:
          "TikTok issued rotated tokens but Influo could not persist them — do not assume refresh succeeded; re-authorize",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    refreshed: true,
    tokenExpiresAt: accessExpiresAt,
    refreshTokenExpiresAt: refreshExpiresAt,
    platformUserId: refreshed.token.openId || row.platform_user_id,
    scopesGranted: mergedScopes || previousScopes || [],
  });
}
