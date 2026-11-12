import { NextRequest, NextResponse } from "next/server";
import { isAdminUser, supabaseService } from "@/lib/apiAuth";
import {
  ADMIN_IG_RETURN_PATH,
  evaluateAdminIgCallbackOwnership,
  metaIgTestInfluencerId,
} from "@/lib/social/instagramAdminConfig";
import {
  exchangeCodeForToken,
  fetchClientBusinessId,
  listAssignedInstagramAccounts,
  metaIgConfigId,
  META_GRAPH_VERSION,
  redactSecrets,
  runInsightsSpike,
} from "@/lib/social/instagramUnified";
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
  const url = new URL(ADMIN_IG_RETURN_PATH, siteOrigin());
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url.toString());
}

/**
 * Admin-only Instagram Unified Login callback (testing phase).
 * Validates signed state, that state.uid is still an admin, and that influencerId is the designated test account.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const err = sp.get("error");
  const errDesc = sp.get("error_description");
  if (err) {
    console.warn("[ig-oauth] callback denied", { error: err, desc: errDesc?.slice(0, 200) });
    return redirectAdmin({ ig_oauth: "denied", reason: err });
  }

  const code = sp.get("code");
  const state = sp.get("state");
  if (!code || !state) {
    return redirectAdmin({ ig_oauth: "error", reason: "missing_code_or_state" });
  }

  const parsed = verifyOAuthState(state);
  if (!parsed) {
    console.warn("[ig-oauth] invalid or expired state");
    return redirectAdmin({ ig_oauth: "error", reason: "invalid_state" });
  }

  const { data: authUser, error: authErr } = await supabaseService().auth.admin.getUserById(
    parsed.uid
  );
  const stateUidIsAdmin = !authErr && !!authUser?.user && (await isAdminUser(authUser.user));
  const ownership = evaluateAdminIgCallbackOwnership({
    purpose: parsed.purpose,
    stateInfluencerId: parsed.influencerId,
    testInfluencerId: metaIgTestInfluencerId(),
    stateUidIsAdmin,
  });
  if (!ownership.ok) {
    console.warn("[ig-oauth] callback ownership failed", ownership.reason);
    return redirectAdmin({ ig_oauth: "error", reason: ownership.reason });
  }

  // Replay protection: consume nonce once (DB PK + process-local fallback).
  const consumeDb = await consumeOAuthNonceViaInsert(async (row) => {
    const { error } = await supabaseService().from("instagram_oauth_used_nonces").insert(row);
    return { error };
  });
  const nonceResult = await consumeDb(parsed);
  if (nonceResult === "replay") {
    console.warn("[ig-oauth] oauth state nonce replay");
    return redirectAdmin({ ig_oauth: "error", reason: "state_replay" });
  }
  if (nonceResult === "error") {
    // Fallback: still block same-process replay if DB insert failed transiently.
    if (!processLocalOAuthNonceStore.tryConsume(parsed.nonce, parsed.exp)) {
      console.warn("[ig-oauth] oauth state nonce replay (local)");
      return redirectAdmin({ ig_oauth: "error", reason: "state_replay" });
    }
    console.warn("[ig-oauth] nonce persist failed; used process-local store");
  } else if (!processLocalOAuthNonceStore.tryConsume(parsed.nonce, parsed.exp)) {
    // DB said ok but local already saw it (rare race across handlers).
    console.warn("[ig-oauth] oauth state nonce replay (local after db)");
    return redirectAdmin({ ig_oauth: "error", reason: "state_replay" });
  }

  try {
    const token = await exchangeCodeForToken(code);
    console.info("[ig-oauth] token exchange ok", {
      influencerId: parsed.influencerId,
      expiresIn: token.expiresIn,
      tokenType: token.tokenType,
    });

    const business = await fetchClientBusinessId(token.accessToken);
    const assigned = await listAssignedInstagramAccounts(token.accessToken);
    if (!assigned.ok) {
      console.error("[ig-oauth] assigned accounts failed", redactSecrets(assigned.error));
      return redirectAdmin({ ig_oauth: "error", reason: "assigned_accounts_failed" });
    }

    console.info("[ig-oauth] assigned accounts", {
      influencerId: parsed.influencerId,
      count: assigned.accounts.length,
      usernames: assigned.accounts.map((a) => a.username || a.id),
    });

    if (!assigned.accounts.length) {
      return redirectAdmin({ ig_oauth: "error", reason: "no_assigned_instagram_accounts" });
    }

    const primary = assigned.accounts[0]!;
    if (!primary.id) {
      return redirectAdmin({ ig_oauth: "error", reason: "invalid_ig_id" });
    }

    const spike = await runInsightsSpike(primary.id, token.accessToken);
    console.info("[ig-oauth] spike summary", {
      influencerId: parsed.influencerId,
      igUserId: primary.id,
      username: primary.username,
      profileOk: spike.profile.ok,
      insightsDayOk: spike.insightsDay.ok,
      demographicsOk: spike.demographics.filter((d) => d.ok).map((d) => d.breakdown),
      demographicsFail: spike.demographics
        .filter((d) => !d.ok)
        .map((d) => ({ b: d.breakdown, e: d.error })),
    });

    const encrypted = encryptSecret(token.accessToken);
    const expiresAt =
      token.expiresIn != null ? new Date(Date.now() + token.expiresIn * 1000).toISOString() : null;

    const { error: upErr } = await supabaseService().from("social_connections").upsert(
      {
        influencer_id: parsed.influencerId,
        platform: "instagram",
        ig_user_id: primary.id,
        username: primary.username || null,
        client_business_id: business.ok ? business.clientBusinessId : null,
        encrypted_access_token: encrypted,
        token_expires_at: expiresAt,
        config_id: metaIgConfigId(),
        graph_version: META_GRAPH_VERSION,
        is_active: true,
        last_synced_at: new Date().toISOString(),
        last_error: null,
        last_spike_report: spike,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "influencer_id,platform" }
    );

    if (upErr) {
      console.error("[ig-oauth] persist failed", upErr.message);
      return redirectAdmin({ ig_oauth: "error", reason: "persist_failed" });
    }

    return redirectAdmin({
      ig_oauth: "ok",
      ig_user_id: primary.id,
      username: primary.username || "",
      profile: spike.profile.ok ? "1" : "0",
      insights: spike.insightsDay.ok ? "1" : "0",
      demo: String(spike.demographics.filter((d) => d.ok).length),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "callback_failed";
    console.error("[ig-oauth] callback error", redactSecrets(message));
    return redirectAdmin({ ig_oauth: "error", reason: "exchange_or_spike_failed" });
  }
}
