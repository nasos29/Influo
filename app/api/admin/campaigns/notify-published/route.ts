import { NextRequest, NextResponse } from "next/server";
import { isTestBrand } from "@/lib/testAccounts";
import { rejectUnlessAdmin, supabaseService } from "@/lib/apiAuth";
import { notifyCampaignPublished } from "@/lib/campaignPublishedNotify";
import { categoryQueueStatus, markCategoryEmailsSent, queueCategoryCampaignEmails } from "@/lib/campaignCategoryEmail";
import { sendPushNewOpenCampaignToAllApprovedInfluencers } from "@/lib/push";

export const maxDuration = 60;

type Body = { campaignId?: string; action?: "all" | "push" | "category" | "markSent" | "status"; emails?: string[]; skipFirst?: number };

/**
 * Admin/cron only. Default action "all": (re)send every "campaign published" notification.
 * "push": push to all approved creators only. "category": re-derive the category email queue
 * (skips anyone already queued/sent). "markSent": record emails already sent. "status": queue size.
 */
export async function POST(req: NextRequest) {
  const denied = await rejectUnlessAdmin(req, { allowCronSecret: true });
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as Body;
  const action = body.action || "all";
  if (action === "status") return NextResponse.json({ ok: true, ...categoryQueueStatus() });
  if (!body.campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  if (action === "all") {
    const result = await notifyCampaignPublished(body.campaignId, { force: true });
    return NextResponse.json(result, { status: "status" in result ? result.status : 200 });
  }
  if (action === "markSent") {
    const added = markCategoryEmailsSent(body.campaignId, Array.isArray(body.emails) ? body.emails.map(String) : []);
    return NextResponse.json({ ok: true, added, ...categoryQueueStatus() });
  }
  const { data: row } = await supabaseService()
    .from("brand_campaigns")
    .select("id, brand_id, status, title, category, location, requires_presence, min_followers, platforms, brands ( brand_name, contact_email )")
    .eq("id", body.campaignId)
    .maybeSingle();
  if (!row || row.status !== "open") return NextResponse.json({ error: "Campaign not open" }, { status: 404 });
  const br = row.brands as { brand_name?: string | null; contact_email?: string | null } | { brand_name?: string | null; contact_email?: string | null }[] | null;
  const brandRow = Array.isArray(br) ? br[0] : br;
  const brandName = brandRow?.brand_name || "Brand";
  if (await isTestBrand(row.brand_id, brandRow?.contact_email)) {
    return NextResponse.json({ ok: true, skipped: "test_brand" });
  }
  if (action === "push") {
    const push = await sendPushNewOpenCampaignToAllApprovedInfluencers({ campaignTitle: row.title, brandName, campaignId: row.id });
    console.log("[campaign published] push backfill", row.id, push);
    return NextResponse.json({ ok: true, push });
  }
  const categoryEmails = await queueCategoryCampaignEmails({
    campaignId: row.id,
    title: row.title,
    brandName,
    category: row.category || null,
    location: row.location || null,
    minFollowers: row.min_followers ?? null,
    platforms: Array.isArray(row.platforms) ? row.platforms.map(String) : [],
    requiresPresence: row.requires_presence === true,
    includeStrong: true,
    skipFirst: Number(body.skipFirst) || 0,
  });
  return NextResponse.json({ ok: true, categoryEmails, ...categoryQueueStatus() });
}
