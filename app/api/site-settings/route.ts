import { NextResponse } from "next/server";
import { publicSiteSettings } from "@/lib/siteSettings";
import { getSiteSettings } from "@/lib/siteSettingsServer";

export const runtime = "nodejs";
export const revalidate = 300;

/** Public, non-sensitive display settings (safe defaults if table missing). */
export async function GET() {
  const settings = publicSiteSettings(await getSiteSettings());
  return NextResponse.json(
    { settings },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
