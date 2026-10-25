import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  CAMPAIGN_REMINDER_DAYS_BEFORE,
  campaignClosesAt,
} from "@/lib/campaignLifecycle";
import { SITE_URL } from "@/lib/site";

export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type BrandBits = {
  brand_name?: string | null;
  contact_email?: string | null;
};

type OpenCampaign = {
  id: string;
  title: string;
  deadline: string | null;
  opened_at: string | null;
  created_at: string;
  close_reminder_sent_at: string | null;
  brand_id: string;
  brands: BrandBits | BrandBits[] | null;
};

function brandOf(row: OpenCampaign): BrandBits | null {
  const raw = row.brands;
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] || null : raw;
}

async function sendEmail(payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`${SITE_URL}/api/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[campaign-lifecycle] email failed", res.status, text);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[campaign-lifecycle] email error", e);
    return false;
  }
}

async function applicationsCount(campaignId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("campaign_applications")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);
  if (error) {
    console.error("[campaign-lifecycle] applications count", error);
    return 0;
  }
  return count ?? 0;
}

/**
 * Auto-closes open campaigns past deadline / 30 days, and sends a 3-day reminder.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron =
    req.headers.get("x-vercel-cron") === "1" ||
    req.headers.get("user-agent")?.includes("vercel-cron");

  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}` && !isVercelCron) {
      return NextResponse.json(
        { error: "Unauthorized. Missing or invalid CRON_SECRET." },
        { status: 401 }
      );
    }
  } else if (!isVercelCron) {
    return NextResponse.json(
      { error: "Unauthorized. CRON_SECRET not configured." },
      { status: 401 }
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("brand_campaigns")
      .select(
        "id, title, deadline, opened_at, created_at, close_reminder_sent_at, brand_id, brands(brand_name, contact_email)"
      )
      .eq("status", "open");

    if (error) {
      console.error("[campaign-lifecycle] select", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const now = new Date();
    let closed = 0;
    let reminded = 0;
    let emailsFailed = 0;

    for (const row of (data || []) as OpenCampaign[]) {
      const closesAt = campaignClosesAt(row);
      const brand = brandOf(row);
      const brandEmail = brand?.contact_email?.trim().toLowerCase() || "";
      const brandName = brand?.brand_name?.trim() || "Επιχείρηση";
      const campaignTitle = row.title || "Καμπάνια";

      if (now.getTime() >= closesAt.getTime()) {
        const nowIso = now.toISOString();
        const { data: updated, error: updErr } = await supabaseAdmin
          .from("brand_campaigns")
          .update({
            status: "closed",
            closed_at: nowIso,
            auto_closed: true,
          })
          .eq("id", row.id)
          .eq("status", "open")
          .select("id")
          .maybeSingle();

        if (updErr) {
          console.error("[campaign-lifecycle] close update", row.id, updErr);
          continue;
        }
        if (!updated) continue;
        closed += 1;

        const appsCount = await applicationsCount(row.id);
        if (brandEmail) {
          const ok = await sendEmail({
            type: "campaign_closed_brand",
            email: brandEmail,
            brandName,
            campaignTitle,
            applicationsCount: appsCount,
          });
          if (!ok) emailsFailed += 1;
        }

        const { data: pendingApps, error: pendingErr } = await supabaseAdmin
          .from("campaign_applications")
          .select("influencer_id, influencers(contact_email, display_name)")
          .eq("campaign_id", row.id)
          .eq("status", "pending");

        if (pendingErr) {
          console.error("[campaign-lifecycle] pending apps", row.id, pendingErr);
        } else {
          for (const app of pendingApps || []) {
            const infRaw = (app as { influencers?: unknown }).influencers;
            const inf = (
              Array.isArray(infRaw) ? infRaw[0] : infRaw
            ) as { contact_email?: string | null; display_name?: string | null } | null;
            const email = inf?.contact_email?.trim().toLowerCase() || "";
            if (!email) continue;
            const ok = await sendEmail({
              type: "campaign_closed_applicant",
              email,
              influencerName: inf?.display_name?.trim() || "Influencer",
              campaignTitle,
              brandName,
            });
            if (!ok) emailsFailed += 1;
          }
        }
        continue;
      }

      if (row.close_reminder_sent_at) continue;
      const reminderAt = new Date(
        closesAt.getTime() - CAMPAIGN_REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000
      );
      if (now.getTime() < reminderAt.getTime()) continue;

      if (brandEmail) {
        const appsCount = await applicationsCount(row.id);
        const ok = await sendEmail({
          type: "campaign_closing_soon_brand",
          email: brandEmail,
          brandName,
          campaignTitle,
          closesAt: closesAt.toISOString(),
          applicationsCount: appsCount,
        });
        if (!ok) {
          emailsFailed += 1;
          continue;
        }
      }

      const { error: remErr } = await supabaseAdmin
        .from("brand_campaigns")
        .update({ close_reminder_sent_at: now.toISOString() })
        .eq("id", row.id)
        .eq("status", "open");
      if (remErr) {
        console.error("[campaign-lifecycle] reminder stamp", row.id, remErr);
        continue;
      }
      reminded += 1;
    }

    return NextResponse.json({ closed, reminded, emailsFailed });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[campaign-lifecycle]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
