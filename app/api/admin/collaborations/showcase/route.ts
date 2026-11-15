import { NextResponse } from "next/server";
import { requireAdmin, supabaseService } from "@/lib/apiAuth";
import { loadRecentCollaborations } from "@/lib/loadRecentCollaborations";

type Source = "proposal" | "campaign";

function asSource(value: unknown): Source | null {
  return value === "proposal" || value === "campaign" ? value : null;
}

/** GET: admin list of dual-consent showcase candidates (includes hidden). */
export async function GET(request: Request) {
  const adminUser = await requireAdmin(request);
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = supabaseService();
  const url = new URL(request.url);
  const includeHidden = url.searchParams.get("includeHidden") !== "0";

  const items: Array<{
    id: string;
    source: Source;
    brandName: string;
    influencerId: string;
    postUrl: string | null;
    completedAt: string | null;
    hidden: boolean;
    pinned: boolean;
    brandConsent: boolean;
    influencerConsent: boolean;
  }> = [];

  try {
    let q = admin
      .from("proposals")
      .select(
        "id, brand_name, influencer_id, published_post_url, agreement_accepted_at, showcase_admin_hidden, showcase_admin_pinned, brand_showcase_consent, influencer_showcase_consent"
      )
      .eq("status", "completed")
      .eq("brand_showcase_consent", true)
      .eq("influencer_showcase_consent", true)
      .order("agreement_accepted_at", { ascending: false })
      .limit(50);
    if (!includeHidden) q = q.eq("showcase_admin_hidden", false);
    const { data, error } = await q;
    if (error) console.error("admin showcase proposals", error);
    else if (Array.isArray(data)) {
      for (const row of data) {
        items.push({
          id: String(row.id),
          source: "proposal",
          brandName: (typeof row.brand_name === "string" && row.brand_name) || "Brand",
          influencerId: String(row.influencer_id || ""),
          postUrl: typeof row.published_post_url === "string" ? row.published_post_url : null,
          completedAt:
            typeof row.agreement_accepted_at === "string" ? row.agreement_accepted_at : null,
          hidden: !!row.showcase_admin_hidden,
          pinned: !!row.showcase_admin_pinned,
          brandConsent: !!row.brand_showcase_consent,
          influencerConsent: !!row.influencer_showcase_consent,
        });
      }
    }
  } catch (error) {
    console.error("admin showcase proposals", error);
  }

  try {
    let q = admin
      .from("campaign_applications")
      .select(
        "id, influencer_id, deliverable_url, reviewed_at, showcase_admin_hidden, showcase_admin_pinned, brand_showcase_consent, influencer_showcase_consent, brand_campaigns ( brands ( brand_name ) )"
      )
      .eq("deliverable_status", "approved")
      .eq("brand_showcase_consent", true)
      .eq("influencer_showcase_consent", true)
      .order("reviewed_at", { ascending: false })
      .limit(50);
    if (!includeHidden) q = q.eq("showcase_admin_hidden", false);
    const { data, error } = await q;
    if (error) console.error("admin showcase campaigns", error);
    else if (Array.isArray(data)) {
      for (const row of data) {
        const campaignRaw = row.brand_campaigns as unknown;
        const campaign = (Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw) as {
          brands?: { brand_name?: string } | { brand_name?: string }[] | null;
        } | null;
        const brandRow = Array.isArray(campaign?.brands) ? campaign?.brands[0] : campaign?.brands;
        items.push({
          id: String(row.id),
          source: "campaign",
          brandName: (typeof brandRow?.brand_name === "string" && brandRow.brand_name) || "Brand",
          influencerId: String(row.influencer_id || ""),
          postUrl: typeof row.deliverable_url === "string" ? row.deliverable_url : null,
          completedAt: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
          hidden: !!row.showcase_admin_hidden,
          pinned: !!row.showcase_admin_pinned,
          brandConsent: !!row.brand_showcase_consent,
          influencerConsent: !!row.influencer_showcase_consent,
        });
      }
    }
  } catch (error) {
    console.error("admin showcase campaigns", error);
  }

  // Also return the public preview cards (dual consent, not hidden) for sanity check.
  const publicPreview = await loadRecentCollaborations(8).catch(() => []);

  return NextResponse.json({ items, publicPreview });
}

/** PATCH: admin hide / pin a showcase collaboration. */
export async function PATCH(request: Request) {
  const adminUser = await requireAdmin(request);
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const source = asSource(body.source);
  const id = String(body.id || "").trim();
  if (!source || !id) {
    return NextResponse.json({ error: "source and id required" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.hidden === "boolean") update.showcase_admin_hidden = body.hidden;
  if (typeof body.pinned === "boolean") {
    update.showcase_admin_pinned = body.pinned;
    update.showcase_admin_pinned_at = body.pinned ? new Date().toISOString() : null;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const table = source === "proposal" ? "proposals" : "campaign_applications";
  const { error } = await supabaseService().from(table).update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
