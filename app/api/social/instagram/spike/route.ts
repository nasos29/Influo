import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin, supabaseService } from "@/lib/apiAuth";
import {
  isMetaIgTestInfluencerId,
  metaIgTestInfluencerId,
  requireMetaIgTestInfluencerId,
} from "@/lib/social/instagramAdminConfig";
import { META_GRAPH_VERSION, runInsightsSpike } from "@/lib/social/instagramUnified";
import { decryptSecret } from "@/lib/social/tokenCrypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only insights re-test against the designated encrypted connection.
 * Never returns the access token.
 */
export async function GET(request: NextRequest) {
  const denied = await rejectUnlessAdmin(request);
  if (denied) return denied;

  const qId = request.nextUrl.searchParams.get("influencerId")?.trim() || "";
  const expected = metaIgTestInfluencerId();
  if (!expected) {
    return NextResponse.json({ error: "META_IG_TEST_INFLUENCER_ID is not configured" }, { status: 503 });
  }
  if (qId && !isMetaIgTestInfluencerId(qId)) {
    return NextResponse.json({ error: "Forbidden: influencerId mismatch" }, { status: 403 });
  }

  let influencerId: string;
  try {
    influencerId = requireMetaIgTestInfluencerId();
  } catch {
    return NextResponse.json({ error: "META_IG_TEST_INFLUENCER_ID is not configured" }, { status: 503 });
  }

  const { data: row, error } = await supabaseService()
    .from("social_connections")
    .select(
      "id, influencer_id, platform, ig_user_id, username, client_business_id, encrypted_access_token, token_expires_at, config_id, graph_version, is_active, last_spike_report, updated_at, last_synced_at"
    )
    .eq("influencer_id", influencerId)
    .eq("platform", "instagram")
    .eq("is_active", true)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: "No active Instagram connection" }, { status: 404 });
  }
  if (!row.ig_user_id || !row.encrypted_access_token) {
    return NextResponse.json({ error: "Connection incomplete" }, { status: 422 });
  }

  try {
    const accessToken = decryptSecret(row.encrypted_access_token);
    const report = await runInsightsSpike(row.ig_user_id, accessToken);

    await supabaseService()
      .from("social_connections")
      .update({
        last_spike_report: report,
        last_synced_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    return NextResponse.json({
      ok: true,
      connection: {
        influencerId: row.influencer_id,
        igUserId: row.ig_user_id,
        username: row.username,
        clientBusinessId: row.client_business_id,
        configId: row.config_id,
        graphVersion: row.graph_version || META_GRAPH_VERSION,
        tokenExpiresAt: row.token_expires_at,
        lastSyncedAt: new Date().toISOString(),
        updatedAt: row.updated_at,
      },
      report: {
        graphVersion: report.graphVersion,
        profile: {
          ok: report.profile.ok,
          error: report.profile.error || null,
          followers: report.profile.data?.followers_count ?? null,
          username: report.profile.data?.username ?? null,
          name: report.profile.data?.name ?? null,
          mediaCount: report.profile.data?.media_count ?? null,
        },
        insightsDay: {
          ok: report.insightsDay.ok,
          status: report.insightsDay.status,
          error: report.insightsDay.error || null,
          metricTried: report.insightsDay.metricTried || null,
          hasData: report.insightsDay.data != null,
          data: report.insightsDay.data ?? null,
          groups: report.insightsDay.groups.map((g) => ({
            kind: g.kind,
            metrics: g.metrics,
            metricType: g.metricType,
            representation: g.representation,
            ok: g.ok,
            error: g.error || null,
            hasData: g.data != null,
          })),
        },
        demographics: report.demographics.map((d) => ({
          breakdown: d.breakdown,
          ok: d.ok,
          error: d.error || null,
          hasData: d.data != null,
        })),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "spike failed";
    console.error("[ig-oauth] spike rerun error", message);
    return NextResponse.json({ error: "spike_failed" }, { status: 500 });
  }
}
