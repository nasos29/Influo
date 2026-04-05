import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushBrandNewCampaignApplication } from "@/lib/push";

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Μετά από νέα αίτηση influencer — push στο brand (επιβεβαίωση applicationId + influencer). */
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
    const applicationId = body.applicationId as string | undefined;
    if (!applicationId) {
      return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
    }

    if (!serviceKey) {
      console.warn("[push/campaign-application] SUPABASE_SERVICE_ROLE_KEY missing");
      return NextResponse.json({ ok: true, skipped: true });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: app, error: appErr } = await admin
      .from("campaign_applications")
      .select(
        `
        id,
        influencer_id,
        brand_campaigns (
          title,
          brand_id,
          brands ( brand_name, contact_email )
        )
      `
      )
      .eq("id", applicationId)
      .single();

    if (appErr || !app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    if (app.influencer_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rawBc = app.brand_campaigns as unknown;
    const bc = (Array.isArray(rawBc) ? rawBc[0] : rawBc) as {
      title?: string;
      brands?: { brand_name?: string; contact_email?: string } | { brand_name?: string; contact_email?: string }[] | null;
    } | null;
    const brandsRow = bc?.brands;
    const b =
      Array.isArray(brandsRow) && brandsRow.length ? brandsRow[0] : (brandsRow as { contact_email?: string } | undefined);
    const contactEmail = b?.contact_email?.trim().toLowerCase();
    if (!contactEmail) {
      return NextResponse.json({ ok: true, skipped: true, reason: "no_brand_email" });
    }

    const { data: infRow } = await admin
      .from("influencers")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    const influencerName =
      (infRow as { display_name?: string } | null)?.display_name?.trim() ||
      "Influencer";

    const result = await sendPushBrandNewCampaignApplication({
      brandEmail: contactEmail,
      campaignTitle: (bc?.title as string) || "Καμπάνια",
      influencerName,
      applicationId: app.id,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[push/campaign-application]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
