/**
 * Send a site announcement as a Zoho Campaigns campaign (bulk all / all_brands).
 */

import {
  getZohoCampaignsEnv,
  zohoListKeyForAudience,
  type ZohoAudience,
} from "@/lib/zohoCampaignsConfig";
import {
  zohoCreateCampaign,
  zohoResponseOk,
  zohoSendCampaign,
} from "@/lib/zohoCampaignsClient";
import { syncAudienceToZoho } from "@/lib/zohoCampaignsSync";
import {
  ANNOUNCEMENT_EMAIL_SUBJECT,
  announcementContentUrl,
} from "@/lib/zohoAnnouncementContent";

export {
  ANNOUNCEMENT_EMAIL_SUBJECT,
  announcementContentUrl,
  announcementEmailHtml,
  dashboardPathForAudience,
} from "@/lib/zohoAnnouncementContent";

export type ZohoAnnouncementSendResult = {
  ok: boolean;
  campaignKey?: string;
  syncErrors: string[];
  error?: string;
};

/**
 * Sync list, create campaign from public content URL, send immediately.
 * Free Zoho plan has no scheduling — send is immediate.
 */
export async function sendAnnouncementViaZoho(opts: {
  audience: ZohoAudience;
  title: string;
  siteUrl?: string;
}): Promise<ZohoAnnouncementSendResult> {
  const env = getZohoCampaignsEnv();
  const siteUrl = (opts.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(
    /\/$/,
    ""
  );
  const listKey = zohoListKeyForAudience(opts.audience, env);

  const sync = await syncAudienceToZoho(opts.audience, env);
  const syncErrors = sync.errors.slice(0, 10);

  try {
    const stamp = new Date().toISOString().slice(0, 19).replace("T", " ");
    const name = `Influo announcement (${opts.audience}) ${stamp}`.slice(0, 180);
    const { campaignKey } = await zohoCreateCampaign(
      {
        name,
        subject: ANNOUNCEMENT_EMAIL_SUBJECT,
        listKey,
        contentUrl: announcementContentUrl(opts.audience, siteUrl),
      },
      env
    );

    const sendRaw = await zohoSendCampaign(campaignKey, env);
    if (!zohoResponseOk(sendRaw)) {
      const msg = JSON.stringify(sendRaw).slice(0, 300);
      const lower = msg.toLowerCase();
      if (!lower.includes("inprogress") && !lower.includes("success")) {
        return {
          ok: false,
          campaignKey,
          syncErrors,
          error: `sendcampaign unexpected: ${msg}`,
        };
      }
    }

    return { ok: true, campaignKey, syncErrors };
  } catch (err) {
    return {
      ok: false,
      syncErrors,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
