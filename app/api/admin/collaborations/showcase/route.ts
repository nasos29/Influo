import { NextResponse } from "next/server";
import { requireAdmin, supabaseService } from "@/lib/apiAuth";
import { loadRecentCollaborations } from "@/lib/loadRecentCollaborations";
import { parseSocialPostUrl, socialPostUrlErrorMessage } from "@/lib/socialPostUrl";

type Source = "proposal" | "campaign";

function asSource(value: unknown): Source | null {
  return value === "proposal" || value === "campaign" ? value : null;
}

function clientMeta(request: Request): { ip: string; ua: string } {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const ua = request.headers.get("user-agent") || "unknown";
  return { ip, ua };
}

async function writeAudit(
  adminEmail: string,
  action: string,
  source: Source,
  id: string,
  details: Record<string, unknown>,
  request: Request
) {
  const { ip, ua } = clientMeta(request);
  try {
    await supabaseService().from("admin_audit_log").insert({
      action_type: action,
      admin_email: adminEmail,
      target_type: source === "proposal" ? "proposal" : "campaign_application",
      target_id: id,
      details,
      ip_address: ip,
      user_agent: ua,
    });
  } catch (err) {
    console.error("admin showcase audit", err);
  }
}

/** GET: admin list of collaborations (any completed/approved — not only dual consent). */
export async function GET(request: Request) {
  const adminUser = await requireAdmin(request);
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = supabaseService();
  const url = new URL(request.url);
  const includeHidden = url.searchParams.get("includeHidden") !== "0";
  const dualConsentOnly = url.searchParams.get("dualConsentOnly") === "1";

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
    pendingApproval: boolean;
    postUrlUpdatedBy: string | null;
    postUrlUpdatedAt: string | null;
    pinnedBy: string | null;
  }> = [];

  try {
    let q = admin
      .from("proposals")
      .select(
        "id, brand_name, influencer_id, published_post_url, published_post_pending_approval, agreement_accepted_at, showcase_admin_hidden, showcase_admin_pinned, brand_showcase_consent, influencer_showcase_consent, showcase_post_url_updated_by, showcase_post_url_updated_at, showcase_admin_pinned_by"
      )
      .eq("status", "completed")
      .order("agreement_accepted_at", { ascending: false })
      .limit(100);
    if (!includeHidden) q = q.eq("showcase_admin_hidden", false);
    if (dualConsentOnly) {
      q = q.eq("brand_showcase_consent", true).eq("influencer_showcase_consent", true);
    }
    let { data, error } = await q;
    if (error && /published_post_pending_approval|showcase_post_url_updated|showcase_admin_pinned_by|PGRST204|42703/i.test(error.message || "")) {
      let q2 = admin
        .from("proposals")
        .select(
          "id, brand_name, influencer_id, published_post_url, agreement_accepted_at, showcase_admin_hidden, showcase_admin_pinned, brand_showcase_consent, influencer_showcase_consent"
        )
        .eq("status", "completed")
        .order("agreement_accepted_at", { ascending: false })
        .limit(100);
      if (!includeHidden) q2 = q2.eq("showcase_admin_hidden", false);
      if (dualConsentOnly) {
        q2 = q2.eq("brand_showcase_consent", true).eq("influencer_showcase_consent", true);
      }
      const fallback = await q2;
      data = fallback.data as any;
      error = fallback.error;
    }
    if (error) console.error("admin showcase proposals", error);
    else if (Array.isArray(data)) {
      for (const row of data as unknown as Record<string, unknown>[]) {
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
          pendingApproval: !!row.published_post_pending_approval,
          postUrlUpdatedBy:
            typeof row.showcase_post_url_updated_by === "string"
              ? row.showcase_post_url_updated_by
              : null,
          postUrlUpdatedAt:
            typeof row.showcase_post_url_updated_at === "string"
              ? row.showcase_post_url_updated_at
              : null,
          pinnedBy:
            typeof row.showcase_admin_pinned_by === "string" ? row.showcase_admin_pinned_by : null,
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
        "id, influencer_id, deliverable_url, reviewed_at, showcase_admin_hidden, showcase_admin_pinned, brand_showcase_consent, influencer_showcase_consent, showcase_post_url_updated_by, showcase_post_url_updated_at, showcase_admin_pinned_by, brand_campaigns ( brands ( brand_name ) )"
      )
      .in("deliverable_status", ["approved", "submitted", "changes_requested"])
      .order("reviewed_at", { ascending: false })
      .limit(100);
    if (!includeHidden) q = q.eq("showcase_admin_hidden", false);
    if (dualConsentOnly) {
      q = q
        .eq("deliverable_status", "approved")
        .eq("brand_showcase_consent", true)
        .eq("influencer_showcase_consent", true);
    }
    let { data, error } = await q;
    if (error && /showcase_post_url_updated|showcase_admin_pinned_by|PGRST204|42703/i.test(error.message || "")) {
      let q2 = admin
        .from("campaign_applications")
        .select(
          "id, influencer_id, deliverable_url, reviewed_at, showcase_admin_hidden, showcase_admin_pinned, brand_showcase_consent, influencer_showcase_consent, brand_campaigns ( brands ( brand_name ) )"
        )
        .in("deliverable_status", ["approved", "submitted", "changes_requested"])
        .order("reviewed_at", { ascending: false })
        .limit(100);
      if (!includeHidden) q2 = q2.eq("showcase_admin_hidden", false);
      if (dualConsentOnly) {
        q2 = q2
          .eq("deliverable_status", "approved")
          .eq("brand_showcase_consent", true)
          .eq("influencer_showcase_consent", true);
      }
      const fallback = await q2;
      data = fallback.data as any;
      error = fallback.error;
    }
    if (error) console.error("admin showcase campaigns", error);
    else if (Array.isArray(data)) {
      for (const row of data as unknown as Record<string, unknown>[]) {
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
          pendingApproval: false,
          postUrlUpdatedBy:
            typeof row.showcase_post_url_updated_by === "string"
              ? row.showcase_post_url_updated_by
              : null,
          postUrlUpdatedAt:
            typeof row.showcase_post_url_updated_at === "string"
              ? row.showcase_post_url_updated_at
              : null,
          pinnedBy:
            typeof row.showcase_admin_pinned_by === "string" ? row.showcase_admin_pinned_by : null,
        });
      }
    }
  } catch (error) {
    console.error("admin showcase campaigns", error);
  }

  const publicPreview = await loadRecentCollaborations(8).catch(() => []);

  return NextResponse.json({ items, publicPreview });
}

/** PATCH: admin hide / pin / set post URL (audited). */
export async function PATCH(request: Request) {
  const adminUser = await requireAdmin(request);
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const source = asSource(body.source);
  const id = String(body.id || "").trim();
  if (!source || !id) {
    return NextResponse.json({ error: "source and id required" }, { status: 400 });
  }

  const adminEmail = (adminUser.email || adminUser.id || "admin").trim();
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {};
  const auditDetails: Record<string, unknown> = {};

  if (typeof body.hidden === "boolean") {
    update.showcase_admin_hidden = body.hidden;
    auditDetails.hidden = body.hidden;
  }
  if (typeof body.pinned === "boolean") {
    update.showcase_admin_pinned = body.pinned;
    update.showcase_admin_pinned_at = body.pinned ? now : null;
    update.showcase_admin_pinned_by = adminEmail;
    auditDetails.pinned = body.pinned;
  }
  if ("postUrl" in body || "publishedPostUrl" in body) {
    const raw = body.postUrl ?? body.publishedPostUrl;
    if (raw == null || raw === "") {
      if (source === "proposal") {
        update.published_post_url = null;
        update.published_post_pending_approval = false;
      } else {
        update.deliverable_url = null;
      }
      update.showcase_post_url_updated_by = adminEmail;
      update.showcase_post_url_updated_at = now;
      auditDetails.postUrl = null;
    } else {
      const parsed = parseSocialPostUrl(raw);
      if (!parsed.ok) {
        return NextResponse.json(
          { error: socialPostUrlErrorMessage(parsed.error) },
          { status: 400 }
        );
      }
      if (source === "proposal") {
        update.published_post_url = parsed.url;
        // Admin set = trusted, no pending brand approval.
        update.published_post_pending_approval = false;
      } else {
        update.deliverable_url = parsed.url;
      }
      update.showcase_post_url_updated_by = adminEmail;
      update.showcase_post_url_updated_at = now;
      auditDetails.postUrl = parsed.url;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const table = source === "proposal" ? "proposals" : "campaign_applications";
  let { error } = await supabaseService().from(table).update(update).eq("id", id);
  if (
    error &&
    /showcase_post_url_updated|showcase_admin_pinned_by|published_post_pending_approval|PGRST204|42703/i.test(
      error.message || ""
    )
  ) {
    const soft = { ...update };
    delete soft.showcase_post_url_updated_by;
    delete soft.showcase_post_url_updated_at;
    delete soft.showcase_admin_pinned_by;
    delete soft.published_post_pending_approval;
    ({ error } = await supabaseService().from(table).update(soft).eq("id", id));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const action =
    "postUrl" in auditDetails
      ? "showcase_set_post_url"
      : typeof body.pinned === "boolean"
        ? body.pinned
          ? "showcase_pin"
          : "showcase_unpin"
        : "showcase_admin_update";
  await writeAudit(adminEmail, action, source, id, auditDetails, request);

  return NextResponse.json({
    ok: true,
    postUrlUpdatedBy: typeof update.showcase_post_url_updated_by === "string"
      ? update.showcase_post_url_updated_by
      : undefined,
    postUrlUpdatedAt: typeof update.showcase_post_url_updated_at === "string"
      ? update.showcase_post_url_updated_at
      : undefined,
    pinnedBy: typeof update.showcase_admin_pinned_by === "string" ? update.showcase_admin_pinned_by : undefined,
  });
}
