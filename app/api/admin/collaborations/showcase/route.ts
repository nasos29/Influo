import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdmin, supabaseService } from "@/lib/apiAuth";
import {
  deliveryStateLabel,
  isEventConfirmPending,
  isRealDeliveryComplete,
} from "@/lib/deliveryCompletion";
import { notifyRealCollaborationComplete } from "@/lib/notifyCollaborationComplete";
import { loadRecentCollaborations } from "@/lib/loadRecentCollaborations";
import { influencerContact } from "@/lib/proposalAccess";
import { parseSocialPostUrl, socialPostUrlErrorMessage } from "@/lib/socialPostUrl";

type Source = "proposal" | "campaign";

function revalidateRecentCollaborationsCache() {
  try {
    revalidateTag("recent-collaborations", { expire: 0 });
  } catch (err) {
    console.warn(
      "[showcase] revalidate recent-collaborations",
      err instanceof Error ? err.message : err
    );
  }
}

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
  const includeCancelled = url.searchParams.get("includeCancelled") === "1";
  const dualConsentOnly = url.searchParams.get("dualConsentOnly") === "1";

  const items: Array<{
    id: string;
    source: Source;
    brandName: string;
    influencerId: string;
    influencerName: string;
    postUrl: string | null;
    completedAt: string | null;
    createdAt: string | null;
    hidden: boolean;
    pinned: boolean;
    brandConsent: boolean;
    influencerConsent: boolean;
    pendingApproval: boolean;
    postUrlUpdatedBy: string | null;
    postUrlUpdatedAt: string | null;
    pinnedBy: string | null;
    deliveryMode?: string | null;
    deliverySubmittedAt?: string | null;
    deliveryConfirmedAt?: string | null;
    autoCompletedAt?: string | null;
    deliveryNote?: string | null;
    deliveryProofUrl?: string | null;
    eventAdminAllowed?: boolean;
    eventConfirmPending?: boolean;
    deliveryState?: string;
    deliverableStatus?: string | null;
    deliverableWarningSentAt?: string | null;
  }> = [];

  const deliverableWarningSentAtFromRow = (row: Record<string, unknown>): string | null =>
    typeof row.deliverable_warning_sent_at === "string" ? row.deliverable_warning_sent_at : null;

  try {
    let q = admin
      .from("proposals")
      .select(
        "id, brand_name, influencer_id, published_post_url, published_post_pending_approval, agreement_accepted_at, showcase_admin_hidden, showcase_admin_pinned, brand_showcase_consent, influencer_showcase_consent, showcase_post_url_updated_by, showcase_post_url_updated_at, showcase_admin_pinned_by, delivery_mode, delivery_submitted_at, delivery_confirmed_at, auto_completed_at, delivery_note, delivery_proof_url, showcase_event_admin_allowed, deliverable_warning_sent_at"
      )
      .eq("status", "completed")
      .order("agreement_accepted_at", { ascending: false })
      .limit(100);
    if (!includeHidden) q = q.eq("showcase_admin_hidden", false);
    if (dualConsentOnly) {
      q = q.eq("brand_showcase_consent", true).eq("influencer_showcase_consent", true);
    }
    let { data, error } = await q;
    if (error && /published_post_pending_approval|showcase_post_url_updated|showcase_admin_pinned_by|delivery_|showcase_event_admin|PGRST204|42703/i.test(error.message || "")) {
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
          influencerName: "",
          postUrl: typeof row.published_post_url === "string" ? row.published_post_url : null,
          completedAt:
            typeof row.agreement_accepted_at === "string" ? row.agreement_accepted_at : null,
          createdAt:
            typeof row.agreement_accepted_at === "string" ? row.agreement_accepted_at : null,
          hidden: !!row.showcase_admin_hidden,
          pinned: !!row.showcase_admin_pinned,
          brandConsent: !!row.brand_showcase_consent,
          influencerConsent: !!row.influencer_showcase_consent,
          pendingApproval: !!row.published_post_pending_approval,
          deliveryMode: typeof row.delivery_mode === "string" ? row.delivery_mode : null,
          deliverySubmittedAt:
            typeof row.delivery_submitted_at === "string" ? row.delivery_submitted_at : null,
          deliveryConfirmedAt:
            typeof row.delivery_confirmed_at === "string" ? row.delivery_confirmed_at : null,
          autoCompletedAt: typeof row.auto_completed_at === "string" ? row.auto_completed_at : null,
          deliveryNote: typeof row.delivery_note === "string" ? row.delivery_note : null,
          deliveryProofUrl:
            typeof row.delivery_proof_url === "string" ? row.delivery_proof_url : null,
          eventAdminAllowed: !!row.showcase_event_admin_allowed,
          eventConfirmPending: isEventConfirmPending({
            delivery_mode: typeof row.delivery_mode === "string" ? row.delivery_mode : null,
            delivery_submitted_at:
              typeof row.delivery_submitted_at === "string" ? row.delivery_submitted_at : null,
            delivery_confirmed_at:
              typeof row.delivery_confirmed_at === "string" ? row.delivery_confirmed_at : null,
            auto_completed_at:
              typeof row.auto_completed_at === "string" ? row.auto_completed_at : null,
          }),
          deliveryState: deliveryStateLabel(
            {
              status: "completed",
              delivery_mode: typeof row.delivery_mode === "string" ? row.delivery_mode : null,
              delivery_submitted_at:
                typeof row.delivery_submitted_at === "string" ? row.delivery_submitted_at : null,
              delivery_confirmed_at:
                typeof row.delivery_confirmed_at === "string" ? row.delivery_confirmed_at : null,
              auto_completed_at:
                typeof row.auto_completed_at === "string" ? row.auto_completed_at : null,
              published_post_url:
                typeof row.published_post_url === "string" ? row.published_post_url : null,
              published_post_pending_approval: !!row.published_post_pending_approval,
            },
            "el"
          ),
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
          deliverableWarningSentAt: deliverableWarningSentAtFromRow(row),
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
        "id, influencer_id, deliverable_url, deliverable_status, reviewed_at, showcase_admin_hidden, showcase_admin_pinned, brand_showcase_consent, influencer_showcase_consent, showcase_post_url_updated_by, showcase_post_url_updated_at, showcase_admin_pinned_by, delivery_mode, delivery_submitted_at, delivery_confirmed_at, auto_completed_at, delivery_proof_url, showcase_event_admin_allowed, deliverable_warning_sent_at, brand_campaigns ( brands ( brand_name ) )"
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
    if (error && /showcase_post_url_updated|showcase_admin_pinned_by|delivery_|showcase_event_admin|PGRST204|42703/i.test(error.message || "")) {
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
        const deliveryMode = typeof row.delivery_mode === "string" ? row.delivery_mode : null;
        const deliverySubmittedAt =
          typeof row.delivery_submitted_at === "string" ? row.delivery_submitted_at : null;
        const deliveryConfirmedAt =
          typeof row.delivery_confirmed_at === "string" ? row.delivery_confirmed_at : null;
        const autoCompletedAt =
          typeof row.auto_completed_at === "string" ? row.auto_completed_at : null;
        items.push({
          id: String(row.id),
          source: "campaign",
          brandName: (typeof brandRow?.brand_name === "string" && brandRow.brand_name) || "Brand",
          influencerId: String(row.influencer_id || ""),
          influencerName: "",
          postUrl: typeof row.deliverable_url === "string" ? row.deliverable_url : null,
          completedAt: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
          createdAt: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
          hidden: !!row.showcase_admin_hidden,
          pinned: !!row.showcase_admin_pinned,
          brandConsent: !!row.brand_showcase_consent,
          influencerConsent: !!row.influencer_showcase_consent,
          pendingApproval: false,
          deliverableStatus:
            typeof row.deliverable_status === "string" ? row.deliverable_status : null,
          deliveryMode,
          deliverySubmittedAt,
          deliveryConfirmedAt,
          autoCompletedAt,
          deliveryProofUrl:
            typeof row.delivery_proof_url === "string" ? row.delivery_proof_url : null,
          eventAdminAllowed: !!row.showcase_event_admin_allowed,
          eventConfirmPending: isEventConfirmPending({
            delivery_mode: deliveryMode,
            delivery_submitted_at: deliverySubmittedAt,
            delivery_confirmed_at: deliveryConfirmedAt,
            auto_completed_at: autoCompletedAt,
          }),
          deliveryState: deliveryStateLabel(
            {
              delivery_mode: deliveryMode,
              delivery_submitted_at: deliverySubmittedAt,
              delivery_confirmed_at: deliveryConfirmedAt,
              auto_completed_at: autoCompletedAt,
              deliverable_status: undefined,
            },
            "el"
          ),
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
          deliverableWarningSentAt: deliverableWarningSentAtFromRow(row),
        });
      }
    }
  } catch (error) {
    console.error("admin showcase campaigns", error);
  }

  if (includeCancelled) {
    try {
      const { data: cancelledProps } = await admin
        .from("proposals")
        .select(
          "id, brand_name, influencer_id, status, cancelled_by, auto_cancelled_at, deliverable_warning_sent_at, cancelled_at, published_post_url, delivery_submitted_at, delivery_confirmed_at, auto_completed_at, deliverable_status"
        )
        .eq("status", "cancelled")
        .order("cancelled_at", { ascending: false })
        .limit(50);
      for (const row of cancelledProps || []) {
        if (isRealDeliveryComplete(row as Record<string, unknown>)) continue;
        items.push({
          id: String(row.id),
          source: "proposal",
          brandName: String(row.brand_name || "").trim() || "—",
          influencerId: String(row.influencer_id || ""),
          influencerName: "",
          postUrl: typeof row.published_post_url === "string" ? row.published_post_url : null,
          completedAt: typeof row.cancelled_at === "string" ? row.cancelled_at : null,
          createdAt: typeof row.cancelled_at === "string" ? row.cancelled_at : null,
          hidden: false,
          pinned: false,
          brandConsent: false,
          influencerConsent: false,
          pendingApproval: false,
          postUrlUpdatedBy: null,
          postUrlUpdatedAt: null,
          pinnedBy: null,
          deliveryState: "cancelled",
          deliverableWarningSentAt: deliverableWarningSentAtFromRow(
            row as unknown as Record<string, unknown>
          ),
        });
      }
      const { data: cancelledApps } = await admin
        .from("campaign_applications")
        .select(
          "id, influencer_id, status, cancelled_by, auto_cancelled_at, deliverable_warning_sent_at, cancelled_at, deliverable_url, delivery_submitted_at, delivery_confirmed_at, auto_completed_at, deliverable_status, brand_campaigns ( brands ( brand_name ) )"
        )
        .eq("status", "cancelled")
        .order("cancelled_at", { ascending: false })
        .limit(50);
      for (const row of cancelledApps || []) {
        if (isRealDeliveryComplete(row as Record<string, unknown>)) continue;
        const raw = row.brand_campaigns as unknown;
        const campaign = Array.isArray(raw) ? raw[0] : raw;
        const brandsRaw = (campaign as { brands?: unknown })?.brands;
        const brand = Array.isArray(brandsRaw) ? brandsRaw[0] : brandsRaw;
        const brandName = String((brand as { brand_name?: string })?.brand_name || "").trim() || "—";
        items.push({
          id: String(row.id),
          source: "campaign",
          brandName,
          influencerId: String(row.influencer_id || ""),
          influencerName: "",
          postUrl: typeof row.deliverable_url === "string" ? row.deliverable_url : null,
          completedAt: typeof row.cancelled_at === "string" ? row.cancelled_at : null,
          createdAt: typeof row.cancelled_at === "string" ? row.cancelled_at : null,
          hidden: false,
          pinned: false,
          brandConsent: false,
          influencerConsent: false,
          pendingApproval: false,
          postUrlUpdatedBy: null,
          postUrlUpdatedAt: null,
          pinnedBy: null,
          deliveryState: "cancelled",
          deliverableWarningSentAt: deliverableWarningSentAtFromRow(
            row as unknown as Record<string, unknown>
          ),
        });
      }
    } catch (error) {
      console.error("admin showcase cancelled", error);
    }
  }

  // Batch-resolve creator display names from influencers (no emails).
  const influencerIds = [
    ...new Set(items.map((row) => row.influencerId).filter((id) => !!id)),
  ];
  const nameById = new Map<string, string>();
  if (influencerIds.length > 0) {
    try {
      const { data, error } = await admin
        .from("influencers")
        .select("id, display_name")
        .in("id", influencerIds);
      if (error) console.error("admin showcase influencers", error);
      else if (Array.isArray(data)) {
        for (const row of data as { id?: string; display_name?: string | null }[]) {
          if (typeof row.id !== "string") continue;
          const name = typeof row.display_name === "string" ? row.display_name.trim() : "";
          if (name) nameById.set(row.id, name);
        }
      }
    } catch (error) {
      console.error("admin showcase influencers", error);
    }
  }
  for (const row of items) {
    row.influencerName = nameById.get(row.influencerId) || "Creator";
  }

  const publicPreview = await loadRecentCollaborations(8, { surface: "homepage" }).catch(() => []);

  return NextResponse.json({ items, publicPreview });
}

/** PATCH: admin hide / pin / set post URL / complete delivery (audited). */
export async function PATCH(request: Request) {
  const adminUser = await requireAdmin(request);
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const source = asSource(body.source);
  const id = String(body.id || "").trim();
  if (!source || !id) {
    return NextResponse.json({ error: "source and id required" }, { status: 400 });
  }

  const admin = supabaseService();
  const adminEmail = (adminUser.email || adminUser.id || "admin").trim();
  const now = new Date().toISOString();

  // Admin manual completion («Ολοκλήρωση από admin») — real completion + email.
  if (body.adminComplete === true) {
    if (source === "proposal") {
      const { data: row, error: loadErr } = await admin
        .from("proposals")
        .select(
          "id, influencer_id, brand_name, brand_email, delivery_mode, delivery_submitted_at, delivery_confirmed_at, auto_completed_at, status"
        )
        .eq("id", id)
        .maybeSingle();
      if (loadErr || !row) {
        return NextResponse.json({ error: loadErr?.message || "Not found" }, { status: 404 });
      }
      if (isRealDeliveryComplete(row)) {
        return NextResponse.json({ ok: true, alreadyComplete: true });
      }
      if (!row.delivery_submitted_at) {
        return NextResponse.json(
          { error: "No delivery submitted — cannot complete abandoned deal" },
          { status: 400 }
        );
      }
      const update = {
        delivery_confirmed_at: now,
        published_post_pending_approval: false,
      };
      let { error } = await admin.from("proposals").update(update).eq("id", id);
      if (error && /delivery_confirmed|published_post_pending|PGRST204|42703/i.test(error.message || "")) {
        ({ error } = await admin
          .from("proposals")
          .update({ delivery_confirmed_at: now })
          .eq("id", id));
      }
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const contact = await influencerContact(String(row.influencer_id));
      await notifyRealCollaborationComplete(admin, {
        source: "proposal",
        id: row.id,
        influencerId: String(row.influencer_id),
        brandName: row.brand_name || "Επιχείρηση",
        brandEmail: row.brand_email,
        creatorName: contact.name,
        creatorEmail: contact.email,
        mode: "admin",
        deliveryMode: typeof row.delivery_mode === "string" ? row.delivery_mode : null,
      });
      await writeAudit(
        adminEmail,
        "delivery_admin_complete",
        source,
        id,
        { deliveryMode: row.delivery_mode || null },
        request
      );
      return NextResponse.json({
        ok: true,
        deliveryConfirmedAt: now,
        deliveryState: deliveryStateLabel(
          { delivery_confirmed_at: now, delivery_mode: row.delivery_mode },
          "el"
        ),
        eventConfirmPending: false,
      });
    }

    const { data: row, error: loadErr } = await admin
      .from("campaign_applications")
      .select(
        "id, influencer_id, delivery_mode, delivery_submitted_at, delivery_confirmed_at, auto_completed_at, deliverable_status, brand_campaigns ( brands ( brand_name, contact_email ) )"
      )
      .eq("id", id)
      .maybeSingle();
    if (loadErr || !row) {
      return NextResponse.json({ error: loadErr?.message || "Not found" }, { status: 404 });
    }
    if (isRealDeliveryComplete(row)) {
      return NextResponse.json({ ok: true, alreadyComplete: true });
    }
    if (!row.delivery_submitted_at) {
      return NextResponse.json(
        { error: "No delivery submitted — cannot complete abandoned deal" },
        { status: 400 }
      );
    }
    const update = {
      delivery_confirmed_at: now,
      deliverable_status: "approved",
      reviewed_at: now,
    };
    let { error } = await admin.from("campaign_applications").update(update).eq("id", id);
    if (error && /delivery_confirmed|PGRST204|42703/i.test(error.message || "")) {
      const soft = { ...update };
      delete (soft as { delivery_confirmed_at?: string }).delivery_confirmed_at;
      ({ error } = await admin.from("campaign_applications").update(soft).eq("id", id));
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const campaignRaw = (row as { brand_campaigns?: unknown }).brand_campaigns;
    const campaign = (Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw) as {
      brands?: { brand_name?: string; contact_email?: string } | { brand_name?: string; contact_email?: string }[] | null;
    } | null;
    const brandRow = Array.isArray(campaign?.brands) ? campaign?.brands[0] : campaign?.brands;
    const contact = await influencerContact(String(row.influencer_id));
    await notifyRealCollaborationComplete(admin, {
      source: "campaign",
      id: row.id,
      influencerId: String(row.influencer_id),
      brandName: brandRow?.brand_name || "Επιχείρηση",
      brandEmail: brandRow?.contact_email || null,
      creatorName: contact.name,
      creatorEmail: contact.email,
      mode: "admin",
      deliveryMode: typeof row.delivery_mode === "string" ? row.delivery_mode : null,
    });
    await writeAudit(
      adminEmail,
      "delivery_admin_complete",
      source,
      id,
      { deliveryMode: row.delivery_mode || null },
      request
    );
    return NextResponse.json({
      ok: true,
      deliveryConfirmedAt: now,
      deliveryState: deliveryStateLabel(
        { delivery_confirmed_at: now, delivery_mode: row.delivery_mode },
        "el"
      ),
      eventConfirmPending: false,
    });
  }

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
  let { error } = await admin.from(table).update(update).eq("id", id);
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
    ({ error } = await admin.from(table).update(soft).eq("id", id));
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

  if (
    typeof body.hidden === "boolean" ||
    typeof body.pinned === "boolean" ||
    "postUrl" in body ||
    "publishedPostUrl" in body
  ) {
    revalidateRecentCollaborationsCache();
  }

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
