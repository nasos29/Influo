import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin } from "@/lib/apiAuth";
import { getSiteSettings } from "@/lib/siteSettingsServer";
import {
  isZohoAnnouncementsFlagOn,
  zohoCampaignsCredentialsReady,
} from "@/lib/zohoCampaignsConfig";
import { syncAllAnnouncementAudiences, syncAudienceToZoho } from "@/lib/zohoCampaignsSync";

export async function POST(request: NextRequest) {
  const denied = await rejectUnlessAdmin(request);
  if (denied) return denied;

  if (!zohoCampaignsCredentialsReady()) {
    return NextResponse.json(
      {
        error:
          "Zoho Campaigns credentials missing (ZOHO_CAMPAIGNS_CLIENT_ID/SECRET/REFRESH_TOKEN and list keys).",
      },
      { status: 503 }
    );
  }

  const settings = await getSiteSettings();
  const flagOn = isZohoAnnouncementsFlagOn(settings.zoho_campaigns_announcements);
  // Allow sync even when flag is OFF so owner can dry-run after adding env vars.
  // Sending still requires the flag.

  let audience: "creators" | "brands" | "all" = "all";
  try {
    const body = await request.json().catch(() => ({}));
    const raw = String((body as { audience?: string }).audience || "all").trim();
    if (raw === "creators" || raw === "brands" || raw === "all") audience = raw;
  } catch {
    audience = "all";
  }

  try {
    if (audience === "all") {
      const result = await syncAllAnnouncementAudiences();
      return NextResponse.json({ ok: true, flagOn, result });
    }
    const result = await syncAudienceToZoho(audience);
    return NextResponse.json({ ok: true, flagOn, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    console.error("[admin zoho sync]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
