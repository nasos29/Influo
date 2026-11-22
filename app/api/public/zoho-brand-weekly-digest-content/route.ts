import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchDigestInfluencersForWindow,
  getWeeklyDigestWindow,
} from "@/lib/brandWeeklyInfluencerDigest";
import { brandWeeklyDigestEmailHtml } from "@/lib/zohoBrandWeeklyDigestContent";
import { getServerSupabaseUrl } from "@/lib/supabaseServerUrl";

export const dynamic = "force-dynamic";

/**
 * Public HTML body for Zoho createCampaign content_url (weekly brand new-influencers digest).
 * Zoho's servers fetch this when a campaign is created — keep it unauthenticated.
 * Window via ?start=&end= (ISO); falls back to last 7 days.
 */
export async function GET(request: NextRequest) {
  const url = getServerSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new NextResponse("Unavailable", { status: 503 });

  const startRaw = (request.nextUrl.searchParams.get("start") || "").trim();
  const endRaw = (request.nextUrl.searchParams.get("end") || "").trim();
  const fallback = getWeeklyDigestWindow();
  const start = startRaw && !Number.isNaN(Date.parse(startRaw)) ? startRaw : fallback.start;
  const end = endRaw && !Number.isNaN(Date.parse(endRaw)) ? endRaw : fallback.end;
  const window = {
    start,
    end,
    startDate: new Date(start),
    endDate: new Date(end),
  };

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let influencers;
  try {
    influencers = await fetchDigestInfluencersForWindow(admin, window);
  } catch (err) {
    console.error(
      "[zoho-brand-weekly-digest-content]",
      err instanceof Error ? err.message : err
    );
    return new NextResponse("Unavailable", { status: 503 });
  }

  if (!influencers.length) {
    return new NextResponse("Not found", { status: 404 });
  }

  const html = brandWeeklyDigestEmailHtml(influencers, window);
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=120",
    },
  });
}
