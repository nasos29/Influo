import { NextRequest, NextResponse } from "next/server";
import { isAdminUser, supabaseService, userFromBearer } from "@/lib/apiAuth";
import {
  evaluateAdminIgConnectAccess,
  metaIgTestInfluencerId,
  requireMetaIgTestInfluencerId,
} from "@/lib/social/instagramAdminConfig";
import {
  buildUnifiedAuthorizeUrl,
  metaIgConfigId,
  metaIgRedirectUri,
  META_GRAPH_VERSION,
} from "@/lib/social/instagramUnified";
import { signOAuthState } from "@/lib/social/tokenCrypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only Instagram Unified Login start (testing phase).
 * Ordinary authenticated users receive 403. Unauthenticated → 401.
 * influencerId query is ignored as privilege; connection always binds to META_IG_TEST_INFLUENCER_ID.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await userFromBearer(request);
    const admin = user ? await isAdminUser(user) : false;
    const qInfluencerId = request.nextUrl.searchParams.get("influencerId")?.trim() || "";
    const gate = evaluateAdminIgConnectAccess({
      hasUser: !!user,
      isAdmin: admin,
      queryInfluencerId: qInfluencerId,
      testInfluencerId: metaIgTestInfluencerId(),
    });
    if (gate.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (gate.status === 403) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (gate.status === 503) {
      return NextResponse.json(
        { error: "META_IG_TEST_INFLUENCER_ID is not configured" },
        { status: 503 }
      );
    }
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const influencerId = requireMetaIgTestInfluencerId();

    const { data: inf, error } = await supabaseService()
      .from("influencers")
      .select("id, display_name")
      .eq("id", influencerId)
      .maybeSingle();
    if (error || !inf) {
      return NextResponse.json({ error: "Test influencer not found" }, { status: 404 });
    }

    const state = signOAuthState({
      influencerId: inf.id,
      uid: user.id,
      purpose: "admin_ig_test",
    });
    const authorizeUrl = buildUnifiedAuthorizeUrl(state);

    console.info("[ig-oauth] admin connect start", {
      influencerId: inf.id,
      byUser: user.id,
      configId: metaIgConfigId(),
      redirectUri: metaIgRedirectUri(),
      graphVersion: META_GRAPH_VERSION,
    });

    return NextResponse.json({
      ok: true,
      authorizeUrl,
      configId: metaIgConfigId(),
      redirectUri: metaIgRedirectUri(),
      graphVersion: META_GRAPH_VERSION,
      influencerId: inf.id,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "connect failed";
    console.error("[ig-oauth] connect error", message);
    return NextResponse.json({ error: "connect_failed" }, { status: 500 });
  }
}
