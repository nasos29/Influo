import { NextRequest, NextResponse, after } from "next/server";
import { siteUrl as publicSiteUrl } from "@/lib/proposalMail";
import { createClient } from "@supabase/supabase-js";
import { notifyMatchingOpenCampaign } from "@/lib/campaignNotify";
import { publishedToBrand } from "@/lib/campaignMail";
import { campaignClosesAt } from "@/lib/campaignLifecycle";
import { send } from "@/lib/proposalMail";

/** Brand confirmation goes out once per opening: only right after opened_at, and once per process. */
const BRAND_CONFIRM_WINDOW_MS = 15 * 60 * 1000;
const confirmedOpenings = new Set<string>();

export const maxDuration = 60;

function platformList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String);
}

function userClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    }
  );
}

/** Καλείται όταν μια καμπάνια γίνεται «ανοιχτή» — push σε όλους τους εγκεκριμένους influencers. */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const supabase = userClient(token);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const campaignId = body.campaignId as string | undefined;
    if (!campaignId) {
      return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
    }

    const { data: row, error } = await supabase
      .from("brand_campaigns")
      .select(
        `
        id,
        brand_id,
        status,
        title,
        budget,
        category,
        location,
        min_followers,
        platforms,
        deadline,
        opened_at,
        created_at,
        brands ( brand_name, contact_email )
      `
      )
      .eq("id", campaignId)
      .single();

    if (error || !row) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    if (row.brand_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (row.status !== "open") {
      return NextResponse.json({ ok: true, skipped: true, reason: "not_open" });
    }

    type BrandRow = { brand_name?: string; contact_email?: string | null };
    const br = row.brands as BrandRow | BrandRow[] | null;
    const brandOne = Array.isArray(br) ? br[0] : br;
    const brandName = brandOne?.brand_name || "Brand";
    const brandEmail = (brandOne?.contact_email || "").trim().toLowerCase();
    const title = row.title;
    const category = (row as { category?: string | null }).category || null;
    const location = (row as { location?: string | null }).location || null;
    const minFollowers = (row as { min_followers?: number | null }).min_followers ?? null;
    const platforms = platformList((row as { platforms?: unknown }).platforms);
    const budget = row.budget;
    // req.nextUrl.origin is the internal http host behind nginx (https → http port fails with SSL "wrong version number").
    const siteUrl = publicSiteUrl();

    after(() =>
      notifyMatchingOpenCampaign({
        campaignId,
        title,
        category,
        brandName,
        location,
        minFollowers,
        platforms,
      }).catch((err) => {
        console.error("[push/campaign-published] notify", err);
      })
    );
    after(() =>
      fetch(`${siteUrl}/api/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "campaign_published_admin",
          campaignId,
          campaignTitle: title,
          brandName,
          budget,
        }),
        signal: AbortSignal.timeout(12000),
      })
        .then(async (emailRes) => {
          if (!emailRes.ok) {
            const errText = await emailRes.text();
            console.error("[push/campaign-published] admin email API failed", emailRes.status, errText);
          }
        })
        .catch((emailErr) => {
          console.error("[push/campaign-published] admin email error", emailErr);
        })
    );

    const timing = row as { deadline?: string | null; opened_at?: string | null; created_at?: string };
    const openedAt = timing.opened_at || timing.created_at || "";
    const openingKey = `${campaignId}:${openedAt}`;
    const fresh = openedAt && Date.now() - new Date(openedAt).getTime() < BRAND_CONFIRM_WINDOW_MS;
    if (brandEmail && fresh && !confirmedOpenings.has(openingKey)) {
      confirmedOpenings.add(openingKey);
      let closesAt: string | null = null;
      try {
        closesAt = campaignClosesAt({
          deadline: timing.deadline ?? null,
          opened_at: timing.opened_at ?? null,
          created_at: timing.created_at || new Date().toISOString(),
        }).toISOString();
      } catch {
        closesAt = null;
      }
      const mail = publishedToBrand({ brandEmail, brandName, campaignTitle: title, campaignId, budget, closesAt });
      after(() =>
        send("campaign_published_brand", brandEmail, mail.subject, mail.html).catch((err) => {
          console.error("[push/campaign-published] brand email", err);
        })
      );
    }

    return NextResponse.json({ ok: true, queued: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[push/campaign-published]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
