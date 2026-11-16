import { NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { loadProposal, partyOf, requireActor } from "@/lib/proposalAccess";
import {
  parseSelfReportedCount,
  parseSocialPostUrl,
  socialPostUrlErrorMessage,
} from "@/lib/socialPostUrl";

type Source = "proposal" | "campaign";

function asSource(value: unknown): Source | null {
  return value === "proposal" || value === "campaign" ? value : null;
}

async function ownCampaignApplication(
  applicationId: string,
  userId: string,
  userEmail: string
): Promise<{
  id: string;
  party: "influencer" | "brand";
} | null> {
  const admin = supabaseService();
  const { data: app } = await admin
    .from("campaign_applications")
    .select("id, influencer_id, brand_campaigns ( brand_id, brands ( contact_email ) )")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return null;

  const campaignRaw = app.brand_campaigns as unknown;
  const campaign = (Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw) as {
    brand_id?: string;
    brands?: { contact_email?: string } | { contact_email?: string }[] | null;
  } | null;
  const brandId = typeof campaign?.brand_id === "string" ? campaign.brand_id : "";
  const brandRow = Array.isArray(campaign?.brands) ? campaign?.brands[0] : campaign?.brands;
  const brandEmail = (brandRow?.contact_email || "").trim().toLowerCase();

  const { data: influencer } = await admin
    .from("influencers")
    .select("id, auth_user_id, contact_email")
    .eq("id", app.influencer_id)
    .maybeSingle();
  if (!influencer) return null;

  const email = userEmail.trim().toLowerCase();
  const ownsInfluencer =
    influencer.auth_user_id === userId ||
    (!influencer.auth_user_id &&
      !!email &&
      (influencer.contact_email || "").trim().toLowerCase() === email);
  if (ownsInfluencer) return { id: app.id, party: "influencer" };
  if (brandId && brandId === userId) return { id: app.id, party: "brand" };
  if (brandEmail && email && brandEmail === email) return { id: app.id, party: "brand" };
  return null;
}

/**
 * PATCH consent / published post URL / self-reported metrics.
 * Each party can only set their own consent. Influencer may set post URL + δηλωμένα metrics.
 */
export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const source = asSource(body.source);
    const id = String(body.id || "").trim();
    if (!source || !id) {
      return NextResponse.json({ error: "source and id required" }, { status: 400 });
    }

    const admin = supabaseService();

    if (source === "proposal") {
      const session = await requireActor(request);
      if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const proposal = await loadProposal(id);
      if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const party = partyOf(session.actor, proposal);
      if (!party) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const update: Record<string, unknown> = {};
      if (typeof body.consent === "boolean") {
        if (party === "brand") {
          update.brand_showcase_consent = body.consent;
          update.brand_showcase_opted_out = !body.consent;
        } else {
          update.influencer_showcase_consent = body.consent;
          update.influencer_showcase_opted_out = !body.consent;
        }
      }

      if (party === "influencer") {
        if ("publishedPostUrl" in body) {
          const raw = body.publishedPostUrl;
          if (raw == null || raw === "") {
            update.published_post_url = null;
            update.published_post_pending_approval = false;
          } else {
            const parsed = parseSocialPostUrl(raw);
            if (!parsed.ok) {
              return NextResponse.json(
                { error: socialPostUrlErrorMessage(parsed.error) },
                { status: 400 }
              );
            }
            update.published_post_url = parsed.url;
            update.published_post_pending_approval = true;
            update.showcase_post_url_updated_at = new Date().toISOString();
            update.showcase_post_url_updated_by = `influencer:${session.user.email || session.user.id}`;
          }
        }
        if ("selfReportedViews" in body) {
          update.self_reported_views = parseSelfReportedCount(body.selfReportedViews);
        }
        if ("selfReportedReach" in body) {
          update.self_reported_reach = parseSelfReportedCount(body.selfReportedReach);
        }
      }

      // Brand can approve a pending published post URL.
      if (party === "brand" && body.approvePublishedPost === true) {
        update.published_post_pending_approval = false;
      }

      if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
      }

      let { error } = await admin.from("proposals").update(update).eq("id", id);
      if (
        error &&
        /showcase_opted_out|published_post_pending_approval|showcase_post_url_updated|schema cache|column|PGRST204|42703/i.test(
          error.message || ""
        )
      ) {
        const soft = { ...update };
        delete soft.brand_showcase_opted_out;
        delete soft.influencer_showcase_opted_out;
        delete soft.published_post_pending_approval;
        delete soft.showcase_post_url_updated_at;
        delete soft.showcase_post_url_updated_by;
        ({ error } = await admin.from("proposals").update(soft).eq("id", id));
      }
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    const user = await userFromBearer(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const owned = await ownCampaignApplication(id, user.id, user.email || "");
    if (!owned) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const update: Record<string, unknown> = {};
    if (typeof body.consent === "boolean") {
      if (owned.party === "brand") {
        update.brand_showcase_consent = body.consent;
        update.brand_showcase_opted_out = !body.consent;
      } else {
        update.influencer_showcase_consent = body.consent;
        update.influencer_showcase_opted_out = !body.consent;
      }
    }
    if (owned.party === "influencer") {
      if ("publishedPostUrl" in body) {
        const raw = body.publishedPostUrl;
        if (raw != null && raw !== "") {
          const parsed = parseSocialPostUrl(raw);
          if (!parsed.ok) {
            return NextResponse.json(
              { error: socialPostUrlErrorMessage(parsed.error) },
              { status: 400 }
            );
          }
          update.deliverable_url = parsed.url;
          // New URL from showcase editor → clear brand seen receipt (same as deliverable submit).
          update.deliverable_seen_at = null;
        }
      }
      if ("selfReportedViews" in body) {
        update.self_reported_views = parseSelfReportedCount(body.selfReportedViews);
      }
      if ("selfReportedReach" in body) {
        update.self_reported_reach = parseSelfReportedCount(body.selfReportedReach);
      }
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    let { error } = await admin.from("campaign_applications").update(update).eq("id", id);
    if (
      error &&
      /deliverable_seen_at|showcase_opted_out|schema cache|column|PGRST204|42703/i.test(error.message || "")
    ) {
      const soft = { ...update };
      delete soft.deliverable_seen_at;
      delete soft.brand_showcase_opted_out;
      delete soft.influencer_showcase_opted_out;
      ({ error } = await admin.from("campaign_applications").update(soft).eq("id", id));
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
