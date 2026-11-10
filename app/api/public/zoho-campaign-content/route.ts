import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { campaignCategoryEmailHtml } from "@/lib/zohoCampaignCategoryContent";

export const dynamic = "force-dynamic";

/**
 * Public HTML body for Zoho createCampaign content_url (category/related campaign bulk).
 * Zoho's servers fetch this when a campaign is created — keep it unauthenticated.
 * Only returns content for open campaigns (avoids leaking draft titles via cold links).
 */
export async function GET(request: NextRequest) {
  const campaignId = (request.nextUrl.searchParams.get("campaignId") || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(campaignId)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new NextResponse("Unavailable", { status: 503 });

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: row } = await admin
    .from("brand_campaigns")
    .select("id, title, status, brands ( brand_name )")
    .eq("id", campaignId)
    .eq("status", "open")
    .maybeSingle();

  if (!row) return new NextResponse("Not found", { status: 404 });

  const br = row.brands as { brand_name?: string | null } | { brand_name?: string | null }[] | null;
  const brand = Array.isArray(br) ? br[0] : br;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr";
  const html = campaignCategoryEmailHtml({
    title: row.title || "Καμπάνια",
    brandName: brand?.brand_name || "Brand",
    campaignId,
    siteUrl,
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=120",
    },
  });
}
