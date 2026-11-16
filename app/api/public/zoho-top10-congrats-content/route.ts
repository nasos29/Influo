import { NextResponse } from "next/server";
import { top10CongratsEmailHtml } from "@/lib/zohoTop10Content";

export const dynamic = "force-dynamic";

/** Public HTML for Zoho Top 10 congrats bulk content_url. */
export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr";
  const html = top10CongratsEmailHtml({ siteUrl });
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=120",
    },
  });
}
