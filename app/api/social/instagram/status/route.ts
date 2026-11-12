import { NextResponse } from "next/server";
import { rejectUnlessAdmin, supabaseService } from "@/lib/apiAuth";
import {
  metaIgTestInfluencerId,
  requireMetaIgTestInfluencerId,
} from "@/lib/social/instagramAdminConfig";
import { metaIgConfigId, metaIgRedirectUri, META_GRAPH_VERSION } from "@/lib/social/instagramUnified";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sanitize spike report for admin UI — never include tokens. */
function sanitizeSpikeReport(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as {
    graphVersion?: string;
    profile?: { ok?: boolean; error?: string; data?: Record<string, unknown> };
    insightsDay?: {
      ok?: boolean;
      status?: string;
      error?: string;
      metricTried?: string;
      data?: unknown;
      groups?: Array<{
        kind?: string;
        metrics?: string;
        metricType?: string | null;
        representation?: string;
        ok?: boolean;
        error?: string;
        data?: unknown;
      }>;
    };
    demographics?: Array<{ ok?: boolean; breakdown?: string; error?: string; data?: unknown }>;
  };
  return {
    graphVersion: r.graphVersion || null,
    profile: r.profile
      ? {
          ok: !!r.profile.ok,
          error: r.profile.error || null,
          followers: r.profile.data?.followers_count ?? null,
          username: r.profile.data?.username ?? null,
          name: r.profile.data?.name ?? null,
          mediaCount: r.profile.data?.media_count ?? null,
        }
      : null,
    insightsDay: r.insightsDay
      ? {
          ok: !!r.insightsDay.ok,
          status: r.insightsDay.status || (r.insightsDay.ok ? "complete" : "failed"),
          error: r.insightsDay.error || null,
          metricTried: r.insightsDay.metricTried || null,
          hasData: r.insightsDay.data != null,
          groups: Array.isArray(r.insightsDay.groups)
            ? r.insightsDay.groups.map((g) => ({
                kind: g.kind || "",
                metrics: g.metrics || "",
                metricType: g.metricType ?? null,
                representation: g.representation || "",
                ok: !!g.ok,
                error: g.error || null,
                hasData: g.data != null,
              }))
            : [],
        }
      : null,
    demographics: Array.isArray(r.demographics)
      ? r.demographics.map((d) => ({
          breakdown: d.breakdown || "",
          ok: !!d.ok,
          error: d.error || null,
          hasData: d.data != null,
        }))
      : [],
  };
}

/**
 * Admin-only connection status for the designated Instagram test account.
 * Never returns encrypted_access_token or secrets.
 */
export async function GET(request: Request) {
  const denied = await rejectUnlessAdmin(request);
  if (denied) return denied;

  const testId = metaIgTestInfluencerId();
  if (!testId) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        error: "META_IG_TEST_INFLUENCER_ID is not configured",
        oauth: {
          configId: metaIgConfigId(),
          redirectUri: metaIgRedirectUri(),
          graphVersion: META_GRAPH_VERSION,
        },
      },
      { status: 503 }
    );
  }

  let influencerId: string;
  try {
    influencerId = requireMetaIgTestInfluencerId();
  } catch {
    return NextResponse.json({ error: "META_IG_TEST_INFLUENCER_ID is not configured" }, { status: 503 });
  }

  const { data: inf } = await supabaseService()
    .from("influencers")
    .select("id, display_name, profile_slug")
    .eq("id", influencerId)
    .maybeSingle();

  const { data: row } = await supabaseService()
    .from("social_connections")
    .select(
      "influencer_id, platform, ig_user_id, username, client_business_id, token_expires_at, config_id, graph_version, is_active, last_synced_at, last_error, last_spike_report, updated_at, created_at"
    )
    .eq("influencer_id", influencerId)
    .eq("platform", "instagram")
    .eq("is_active", true)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    configured: true,
    oauth: {
      configId: metaIgConfigId(),
      redirectUri: metaIgRedirectUri(),
      graphVersion: META_GRAPH_VERSION,
    },
    testInfluencer: inf
      ? { id: inf.id, displayName: inf.display_name, profileSlug: inf.profile_slug }
      : { id: influencerId, displayName: null, profileSlug: null },
    connection: row
      ? {
          connected: true,
          igUserId: row.ig_user_id,
          username: row.username,
          clientBusinessId: row.client_business_id,
          configId: row.config_id,
          graphVersion: row.graph_version,
          tokenExpiresAt: row.token_expires_at,
          lastSyncedAt: row.last_synced_at,
          lastError: row.last_error,
          updatedAt: row.updated_at,
          createdAt: row.created_at,
          spike: sanitizeSpikeReport(row.last_spike_report),
        }
      : {
          connected: false,
          igUserId: null,
          username: null,
          lastSyncedAt: null,
          spike: null,
        },
  });
}
