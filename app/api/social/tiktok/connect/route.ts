import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_TT_OAUTH_PURPOSE,
  evaluateAdminTtConnectAccess,
  resolveTikTokAdminSession,
  tiktokTestInfluencerId,
} from "@/lib/social/tiktokAdminConfig";
import {
  buildTikTokAuthorizeUrl,
  redactSecrets,
  tiktokRedirectUri,
  tiktokScopes,
} from "@/lib/social/tiktokUnified";
import { signOAuthState } from "@/lib/social/tokenCrypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only TikTok Login Kit start (testing phase).
 * Connection always binds to TIKTOK_TEST_INFLUENCER_ID — browser influencer UUIDs are ignored.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await resolveTikTokAdminSession(request);
    if (!session.ok) {
      const status = session.status;
      if (status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (status === 503) {
        return NextResponse.json(
          { error: "TIKTOK_TEST_INFLUENCER_ID is not configured" },
          { status: 503 }
        );
      }
      if (status === 404) {
        return NextResponse.json({ error: "Test influencer not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "connect_failed" }, { status: 500 });
    }

    const qInfluencerId = request.nextUrl.searchParams.get("influencerId")?.trim() || "";
    const gate = evaluateAdminTtConnectAccess({
      hasUser: true,
      isAdmin: true,
      queryInfluencerId: qInfluencerId,
      testInfluencerId: tiktokTestInfluencerId(),
    });
    if (gate.status !== 200) {
      return NextResponse.json(
        { error: gate.reason === "influencer_mismatch" ? "Forbidden" : "Unauthorized" },
        { status: gate.status === 503 ? 503 : gate.status }
      );
    }

    const state = signOAuthState({
      influencerId: session.testInfluencerId,
      uid: session.user.id,
      purpose: ADMIN_TT_OAUTH_PURPOSE,
    });
    const authorizeUrl = buildTikTokAuthorizeUrl(state);

    console.info("[tt-oauth] admin connect start", {
      influencerId: session.testInfluencerId,
      byUser: session.user.id,
      redirectUri: tiktokRedirectUri(),
      scopes: tiktokScopes(),
    });

    return NextResponse.json({
      ok: true,
      authorizeUrl,
      redirectUri: tiktokRedirectUri(),
      scopes: tiktokScopes(),
      influencerId: session.testInfluencerId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "connect failed";
    console.error("[tt-oauth] connect error", redactSecrets(message));
    if (/TIKTOK_CLIENT_KEY|TIKTOK_CLIENT_SECRET|SOCIAL_TOKEN|SOCIAL_OAUTH/i.test(message)) {
      return NextResponse.json({ error: "oauth_config_missing" }, { status: 503 });
    }
    return NextResponse.json({ error: "connect_failed" }, { status: 500 });
  }
}
