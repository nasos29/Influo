import { NextResponse } from "next/server";
import { brandWeeklyNudgeEmailHtml } from "@/lib/zohoBrandNudgeContent";

export const dynamic = "force-dynamic";

/**
 * Public HTML body for Zoho createCampaign content_url (weekly brand no-campaign nudge).
 * Zoho's servers fetch this when a campaign is created — keep it unauthenticated.
 */
export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr";
  const html = brandWeeklyNudgeEmailHtml({ siteUrl });
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=120",
    },
  });
}
