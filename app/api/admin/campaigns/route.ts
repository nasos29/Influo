import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { isAdminUser, userFromBearer } from "@/lib/apiAuth";
import { parseAdminCampaignPatch } from "@/lib/adminCampaignPatch";
import { normalizeDeadlineForOpen } from "@/lib/campaignLifecycle";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

async function requireLoggedInAdmin(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!(await isAdminUser(user))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

type CampaignApplicationRow = {
  id: string;
  campaign_id: string;
  influencer_id: string;
  status: string;
  message: string | null;
  proposed_price: number | null;
  work_links: string | null;
  created_at: string;
  deliverable_url?: string | null;
  deliverable_note?: string | null;
  deliverable_status?: string | null;
  deliverable_review_note?: string | null;
  influencers:
    | { display_name: string | null; avatar_url: string | null }
    | Array<{ display_name: string | null; avatar_url: string | null }>
    | null;
};

const BRAND_EMBED = "brands ( brand_name, contact_email, verified, logo_url )";

const CAMPAIGN_SELECTS = [
  `id, brand_id, title, description, budget, category, status, deadline, platforms, compensation_type, deliverables, location, starts_on, min_followers, cover_url, opened_at, closed_at, auto_closed, created_at, updated_at, ${BRAND_EMBED}`,
  `id, brand_id, title, description, budget, category, status, deadline, platforms, compensation_type, deliverables, created_at, updated_at, ${BRAND_EMBED}`,
];

// display_name and avatar only. min_rate stays off this admin payload and off public responses.
const APPLICATION_SELECTS = [
  `id, campaign_id, influencer_id, status, message, proposed_price, work_links, created_at, deliverable_url, deliverable_note, deliverable_status, deliverable_review_note, influencers ( display_name, avatar_url )`,
  `id, campaign_id, influencer_id, status, message, proposed_price, work_links, created_at, influencers ( display_name, avatar_url )`,
];

const OPTIONAL_UPDATE_KEYS = [
  "platforms",
  "compensation_type",
  "deliverables",
  "location",
  "starts_on",
  "min_followers",
  "cover_url",
  "opened_at",
  "close_reminder_sent_at",
  "closed_at",
  "auto_closed",
] as const;

function isMissingColumn(message: string): boolean {
  return /does not exist|schema cache|could not find the/i.test(message);
}

function columnMissing(message: string, key: string): boolean {
  return isMissingColumn(message) && message.toLowerCase().includes(key.toLowerCase());
}

/** Λίστα όλων των καμπανιών (service role — μόνο admin). */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireLoggedInAdmin(request);
    if (auth.error) return auth.error;

    let data: Array<Record<string, unknown>> | null = null;
    let error: { code?: string; message?: string } | null = null;
    for (const select of CAMPAIGN_SELECTS) {
      const result = await supabaseAdmin
        .from("brand_campaigns")
        .select(select)
        .order("created_at", { ascending: false });
      if (!result.error) {
        data = (result.data ?? []) as unknown as Array<Record<string, unknown>>;
        error = null;
        break;
      }
      error = result.error;
      if (error.code === "42P01" || !isMissingColumn(error.message || "")) break;
    }

    if (error) {
      if (error.code === "42P01" || error.message?.includes("brand_campaigns")) {
        return NextResponse.json({
          success: true,
          campaigns: [],
          schemaMissing: true,
        });
      }
      console.error("[admin/campaigns GET]", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const campaigns = data ?? [];
    const ids = campaigns.map((c) => String(c.id || "")).filter(Boolean);
    const appsByCampaign = new Map<string, CampaignApplicationRow[]>();

    if (ids.length > 0) {
      let apps: CampaignApplicationRow[] | null = null;
      let appsError: { message?: string } | null = null;
      for (const select of APPLICATION_SELECTS) {
        const result = await supabaseAdmin
          .from("campaign_applications")
          .select(select)
          .in("campaign_id", ids)
          .order("created_at", { ascending: false });
        if (!result.error) {
          apps = (result.data ?? []) as unknown as CampaignApplicationRow[];
          appsError = null;
          break;
        }
        appsError = result.error;
        if (!isMissingColumn(result.error.message || "")) break;
      }

      if (appsError) {
        console.error("[admin/campaigns GET applications]", appsError);
      } else {
        for (const row of apps ?? []) {
          const list = appsByCampaign.get(row.campaign_id) || [];
          list.push(row);
          appsByCampaign.set(row.campaign_id, list);
        }
      }
    }

    const withApps = campaigns.map((c) => {
      const applications = appsByCampaign.get(String(c.id)) || [];
      return {
        ...c,
        applications,
        applications_count: applications.filter((app) => app.status !== "withdrawn").length,
      };
    });

    return NextResponse.json({
      success: true,
      campaigns: withApps,
      schemaMissing: false,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[admin/campaigns GET]", e);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/** Ενημέρωση υπαρχόντων πεδίων. Μόνο admin. Δεν δέχεται min_rate ούτε brand_id. */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireLoggedInAdmin(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => null);
    const parsed = parseAdminCampaignPatch(body);
    if (!parsed.ok) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }

    const { data: existing, error: loadError } = await supabaseAdmin
      .from("brand_campaigns")
      .select("id, status")
      .eq("id", parsed.campaignId)
      .maybeSingle();
    if (loadError) {
      console.error("[admin/campaigns PATCH load]", loadError);
      return NextResponse.json({ success: false, error: loadError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ success: false, error: "not_found" }, { status: 404 });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    let deadline = parsed.patch.deadline;
    let deadlineCleared = false;
    if (parsed.patch.status === "open") {
      const normalized = normalizeDeadlineForOpen(deadline, now);
      deadline = normalized.deadline;
      deadlineCleared = normalized.clearedPastDeadline;
    }

    const payload: Record<string, unknown> = {
      title: parsed.patch.title,
      description: parsed.patch.description,
      budget: parsed.patch.budget,
      category: parsed.patch.category,
      deliverables: parsed.patch.deliverables,
      status: parsed.patch.status,
      deadline,
      starts_on: parsed.patch.starts_on,
      location: parsed.patch.location,
      min_followers: parsed.patch.min_followers,
      platforms: parsed.patch.platforms,
      compensation_type: parsed.patch.compensation_type,
      updated_at: nowIso,
    };
    if (parsed.patch.cover_url !== undefined) payload.cover_url = parsed.patch.cover_url;

    const wasOpen = existing.status === "open";
    const wasClosed = existing.status === "closed";
    if (parsed.patch.status === "open" && !wasOpen) {
      payload.opened_at = nowIso;
      payload.close_reminder_sent_at = null;
      payload.closed_at = null;
      payload.auto_closed = false;
    }
    if (parsed.patch.status === "closed" && !wasClosed) {
      payload.closed_at = nowIso;
    }

    const current = { ...payload };
    let lastMessage = "save_failed";
    for (let attempt = 0; attempt < OPTIONAL_UPDATE_KEYS.length + 1; attempt++) {
      const result = await supabaseAdmin
        .from("brand_campaigns")
        .update(current)
        .eq("id", parsed.campaignId)
        .select("id")
        .maybeSingle();
      if (!result.error && result.data) {
        return NextResponse.json({
          success: true,
          deadlineCleared,
          campaign: { id: parsed.campaignId, ...current },
        });
      }
      if (!result.error && !result.data) {
        return NextResponse.json({ success: false, error: "not_found" }, { status: 404 });
      }
      lastMessage = result.error?.message || lastMessage;
      const missing = OPTIONAL_UPDATE_KEYS.find((key) => key in current && columnMissing(lastMessage, key));
      if (!missing) break;
      delete current[missing];
    }

    console.error("[admin/campaigns PATCH]", lastMessage);
    return NextResponse.json({ success: false, error: lastMessage }, { status: 500 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[admin/campaigns PATCH]", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Διαγραφή καμπάνιας και (μέσω CASCADE) των αιτήσεων. */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireLoggedInAdmin(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const campaignId = body.campaignId as string | undefined;
    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: "Missing campaignId" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("brand_campaigns")
      .delete()
      .eq("id", campaignId);

    if (error) {
      console.error("[admin/campaigns DELETE]", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[admin/campaigns DELETE]", e);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
