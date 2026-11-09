import { NextRequest, NextResponse } from "next/server";
import {
  announcementEmailHtml,
  dashboardPathForAudience,
} from "@/lib/zohoAnnouncementContent";
import type { ZohoAudience } from "@/lib/zohoCampaignsConfig";

export const dynamic = "force-dynamic";

/**
 * Public HTML body for Zoho createCampaign content_url.
 * Zoho's servers fetch this when a campaign is created — keep it unauthenticated.
 */
export async function GET(request: NextRequest) {
  const audienceRaw = (request.nextUrl.searchParams.get("audience") || "creators").trim();
  const audience: ZohoAudience = audienceRaw === "brands" ? "brands" : "creators";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr";
  const html = announcementEmailHtml(dashboardPathForAudience(audience), siteUrl);

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
