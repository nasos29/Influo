/**
 * Bulk category/related campaign emails via Zoho Campaigns (temp list + deferred cleanup),
 * same pattern as selected announcements. Caller filters opt-outs / empty emails.
 */

import {
  getZohoCampaignsEnv,
  type ZohoCampaignsEnv,
} from "@/lib/zohoCampaignsConfig";
import {
  sendZohoTempListCampaign,
  type ZohoTempContact,
  type ZohoTempListSendResult,
} from "@/lib/zohoTempListCampaign";
import {
  campaignCategoryContentUrl,
  campaignCategoryEmailSubject,
} from "@/lib/zohoCampaignCategoryContent";

export type ZohoCampaignCategoryContact = ZohoTempContact;
export type ZohoCampaignCategorySendResult = ZohoTempListSendResult;

export async function sendCampaignCategoryViaZoho(opts: {
  campaignId: string;
  title: string;
  brandName: string;
  contacts: ZohoCampaignCategoryContact[];
  siteUrl?: string;
  env?: ZohoCampaignsEnv;
  /** content_url kind: category (default) or strong-match copy. */
  kind?: "category" | "strong";
}): Promise<ZohoCampaignCategorySendResult> {
  const env = opts.env || getZohoCampaignsEnv();
  const siteUrl = (opts.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(
    /\/$/,
    ""
  );
  const kind = opts.kind || "category";
  const subject =
    kind === "strong"
      ? `Νέα καμπάνια: ${String(opts.title || "").trim()}`.slice(0, 150)
      : campaignCategoryEmailSubject(opts.title);
  const contentUrl = campaignCategoryContentUrl(opts.campaignId, siteUrl, kind);

  return sendZohoTempListCampaign({
    contacts: opts.contacts,
    subject,
    contentUrl,
    label: kind === "strong" ? "strong-match" : "campaign-category",
    audience: "creators",
    env,
  });
}
