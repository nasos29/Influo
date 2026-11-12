import { NextRequest, NextResponse } from "next/server";
import { isAdminUser, supabaseService } from "@/lib/apiAuth";
import {
  ADMIN_TT_OAUTH_PURPOSE,
  ADMIN_TT_RETURN_PATH,
  evaluateAdminTtCallbackOwnership,
  tiktokTestInfluencerId,
} from "@/lib/social/tiktokAdminConfig";
import {
  exchangeTikTokCodeForToken,
  fetchTikTokUserInfo,
  formatGrantedScopes,
  isCompleteTikTokTokenSet,
  isMissingSchemaError,
  parseGrantedScopes,
  redactSecrets,
  runTikTokSpike,
  tokenExpiryIsoFromSeconds,
} from "@/lib/social/tiktokUnified";
import {
  consumeOAuthNonceViaInsert,
  encryptSecret,
  processLocalOAuthNonceStore,
  verifyOAuthState,
} from "@/lib/social/tokenCrypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.influo.gr").replace(/\/$/, "");
}

function redirectAdmin(params: Record<string, string>) {
  const url = new URL(ADMIN_TT_RETURN_PATH, siteOrigin());
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url.toString());
}

/**
 * Admin-only TikTok Login Kit callback (testing phase).
 * Validates signed state, re-checks that state.uid is still an admin, consumes nonce
 * via tiktok_oauth_used_nonces, and persists encrypted tokens for TIKTOK_TEST_INFLUENCER_ID only.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const err = sp.get("error");
  const errDesc = sp.get("error_description");
  if (err) {
    console.warn("[tt-oauth] callback denied", {
      error: err,
      desc: errDesc ? redactSecrets(errDesc).slice(0, 200) : undefined,
    });
    return redirectAdmin({ tt_oauth: "denied", reason: err.slice(0, 80) });
  }

  const code = sp.get("code");
  const state = sp.get("state");
  if (!code || !state) {
    return redirectAdmin({ tt_oauth: "error", reason: "missing_code_or_state" });
  }

  const parsed = verifyOAuthState(state);
  if (!parsed) {
    console.warn("[tt-oauth] invalid or expired state");
    return redirectAdmin({ tt_oauth: "error", reason: "invalid_state" });
  }

  const { data: authUser, error: authErr } = await supabaseService().auth.admin.getUserById(
    parsed.uid
  );
  const stateUidIsAdmin = !authErr && !!authUser?.user && (await isAdminUser(authUser.user));
  const ownership = evaluateAdminTtCallbackOwnership({
    purpose: parsed.purpose,
    stateInfluencerId: parsed.influencerId,
    testInfluencerId: tiktokTestInfluencerId(),
    stateUidIsAdmin,
  });
  if (!ownership.ok) {
    console.warn("[tt-oauth] callback ownership failed", ownership.reason);
    return redirectAdmin({ tt_oauth: "error", reason: ownership.reason });
  }

  if (parsed.purpose !== ADMIN_TT_OAUTH_PURPOSE) {
    return redirectAdmin({ tt_oauth: "error", reason: "invalid_state" });
  }

  // Replay protection: dedicated TikTok nonce table (never Instagram).
  const consumeDb = await consumeOAuthNonceViaInsert(async (row) => {
    const { error } = await supabaseService().from("tiktok_oauth_used_nonces").insert(row);
    return { error };
  });
  const nonceResult = await consumeDb(parsed);
  if (nonceResult === "replay") {
    console.warn("[tt-oauth] oauth state nonce replay");
    return redirectAdmin({ tt_oauth: "error", reason: "state_replay" });
  }
  if (nonceResult === "error") {
    // Fail closed when DB cannot guarantee uniqueness (e.g. migration missing).
    const localOk = processLocalOAuthNonceStore.tryConsume(parsed.nonce, parsed.exp);
    if (!localOk) {
      return redirectAdmin({ tt_oauth: "error", reason: "state_replay" });
    }
    console.warn("[tt-oauth] nonce persist failed; refusing to continue without durable replay protection");
    return redirectAdmin({ tt_oauth: "error", reason: "nonce_store_unavailable" });
  }
  if (!processLocalOAuthNonceStore.tryConsume(parsed.nonce, parsed.exp)) {
    console.warn("[tt-oauth] oauth state nonce replay (local after db)");
    return redirectAdmin({ tt_oauth: "error", reason: "state_replay" });
  }

  try {
    const exchanged = await exchangeTikTokCodeForToken(code);
    if (!exchanged.ok) {
      console.error("[tt-oauth] token exchange failed", {
        error: redactSecrets(exchanged.error),
        code: exchanged.errorCode,
      });
      return redirectAdmin({
        tt_oauth: "error",
        reason: exchanged.requiresReauth ? "token_reauth_required" : "token_exchange_failed",
      });
    }

    const token = exchanged.token;
    if (!isCompleteTikTokTokenSet(token) || !token.openId) {
      console.error("[tt-oauth] incomplete token payload — refusing to overwrite connection");
      return redirectAdmin({ tt_oauth: "error", reason: "incomplete_token" });
    }

    const profile = await fetchTikTokUserInfo(token.accessToken);
    const username =
      profile.ok && profile.user.username
        ? profile.user.username
        : profile.ok && profile.user.display_name
          ? profile.user.display_name
          : null;

    const grantedScopes = parseGrantedScopes(token.scope);
    const scopesGrantedStr = formatGrantedScopes(grantedScopes);
    const spike = await runTikTokSpike(token.accessToken, {
      scopesGranted: scopesGrantedStr || undefined,
    });
    if (profile.ok) {
      spike.profile = { ok: true, user: profile.user };
    }

    let encryptedAccess: string;
    let encryptedRefresh: string;
    try {
      encryptedAccess = encryptSecret(token.accessToken);
      encryptedRefresh = encryptSecret(token.refreshToken);
    } catch (e) {
      const message = e instanceof Error ? e.message : "encrypt_failed";
      console.error("[tt-oauth] encrypt failed", redactSecrets(message));
      return redirectAdmin({ tt_oauth: "error", reason: "encrypt_failed" });
    }

    const accessExpiresAt = tokenExpiryIsoFromSeconds(token.expiresIn);
    const refreshExpiresAt = tokenExpiryIsoFromSeconds(token.refreshExpiresIn);

    // config_id is Meta Instagram Login only — never store TikTok scopes there.
    const { error: upErr } = await supabaseService().from("social_connections").upsert(
      {
        influencer_id: parsed.influencerId,
        platform: "tiktok",
        platform_user_id: token.openId,
        ig_user_id: null,
        username,
        client_business_id: null,
        encrypted_access_token: encryptedAccess,
        encrypted_refresh_token: encryptedRefresh,
        token_expires_at: accessExpiresAt,
        refresh_token_expires_at: refreshExpiresAt,
        granted_scopes: grantedScopes.length ? grantedScopes : null,
        config_id: null,
        graph_version: "v2",
        is_active: true,
        last_synced_at: new Date().toISOString(),
        last_error: profile.ok ? null : profile.error,
        last_spike_report: { ...spike, scopesGranted: scopesGrantedStr || "" },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "influencer_id,platform" }
    );

    if (upErr) {
      if (isMissingSchemaError(upErr)) {
        console.error("[tt-oauth] schema not ready", upErr.message);
        return redirectAdmin({ tt_oauth: "error", reason: "schema_not_ready" });
      }
      console.error("[tt-oauth] persist failed", upErr.message);
      return redirectAdmin({ tt_oauth: "error", reason: "persist_failed" });
    }

    return redirectAdmin({
      tt_oauth: "ok",
      open_id: token.openId,
      username: username || "",
      profile: spike.profile.ok ? "1" : "0",
      videos: spike.videos.ok ? "1" : "0",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "callback_failed";
    console.error("[tt-oauth] callback error", redactSecrets(message));
    return redirectAdmin({ tt_oauth: "error", reason: "exchange_or_persist_failed" });
  }
}
