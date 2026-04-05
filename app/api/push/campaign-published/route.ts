import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushNewOpenCampaignToAllApprovedInfluencers } from "@/lib/push";

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
        brands ( brand_name )
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

    const br = row.brands as { brand_name?: string } | { brand_name?: string }[] | null;
    const brandName =
      (Array.isArray(br) ? br[0]?.brand_name : br?.brand_name) || "Brand";
    const result = await sendPushNewOpenCampaignToAllApprovedInfluencers({
      campaignId: row.id,
      campaignTitle: row.title,
      brandName,
    });

    let adminEmailSent = false;
    try {
      const siteUrl = req.nextUrl.origin;
      const emailRes = await fetch(`${siteUrl}/api/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "campaign_published_admin",
          campaignId: row.id,
          campaignTitle: row.title,
          brandName,
          budget: row.budget,
        }),
      });
      adminEmailSent = emailRes.ok;
      if (!emailRes.ok) {
        const errText = await emailRes.text();
        console.error(
          "[push/campaign-published] admin email API failed",
          emailRes.status,
          errText
        );
      }
    } catch (emailErr) {
      console.error("[push/campaign-published] admin email error", emailErr);
    }

    return NextResponse.json({ ok: true, ...result, adminEmailSent });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[push/campaign-published]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
