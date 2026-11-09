/**
 * Zoho Campaigns (EU) env + readiness helpers.
 * Secrets stay in server env — never in site_settings / client.
 */

export type ZohoCampaignsEnv = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  creatorsListKey: string;
  brandsListKey: string;
  fromEmail: string;
  fromName: string;
  topicId: string;
  accountsBase: string;
  apiBase: string;
};

export function getZohoCampaignsEnv(): ZohoCampaignsEnv {
  return {
    clientId: (process.env.ZOHO_CAMPAIGNS_CLIENT_ID || "").trim(),
    clientSecret: (process.env.ZOHO_CAMPAIGNS_CLIENT_SECRET || "").trim(),
    refreshToken: (process.env.ZOHO_CAMPAIGNS_REFRESH_TOKEN || "").trim(),
    creatorsListKey: (process.env.ZOHO_CAMPAIGNS_LIST_KEY_CREATORS || "").trim(),
    brandsListKey: (process.env.ZOHO_CAMPAIGNS_LIST_KEY_BRANDS || "").trim(),
    // Zoho Campaigns requires a verified sender; Influo account uses support@.
    fromEmail: (process.env.ZOHO_CAMPAIGNS_FROM_EMAIL || "support@influo.gr").trim(),
    fromName: (process.env.ZOHO_CAMPAIGNS_FROM_NAME || "Influo").trim(),
    topicId: (process.env.ZOHO_CAMPAIGNS_TOPIC_ID || "").trim(),
    accountsBase: (process.env.ZOHO_CAMPAIGNS_ACCOUNTS_BASE || "https://accounts.zoho.eu").replace(
      /\/$/,
      ""
    ),
    apiBase: (process.env.ZOHO_CAMPAIGNS_API_BASE || "https://campaigns.zoho.eu/api/v1.1").replace(
      /\/$/,
      ""
    ),
  };
}

/** All OAuth + list keys required before any Zoho Campaigns call. */
export function zohoCampaignsCredentialsReady(env: ZohoCampaignsEnv = getZohoCampaignsEnv()): boolean {
  return Boolean(
    env.clientId &&
      env.clientSecret &&
      env.refreshToken &&
      env.creatorsListKey &&
      env.brandsListKey
  );
}

/** site_settings flag: 1 = ON, anything else = OFF (default). */
export function isZohoAnnouncementsFlagOn(flagValue: number | null | undefined): boolean {
  return Number(flagValue) === 1;
}

/**
 * Use Zoho for all site announcements (bulk lists + selected temp lists)
 * when the admin flag is ON and server credentials/list keys are present.
 * Otherwise keep Resend.
 */
export function shouldUseZohoForAnnouncements(flagValue: number | null | undefined): boolean {
  return isZohoAnnouncementsFlagOn(flagValue) && zohoCampaignsCredentialsReady();
}

export type ZohoAudience = "creators" | "brands";

export function zohoListKeyForAudience(
  audience: ZohoAudience,
  env: ZohoCampaignsEnv = getZohoCampaignsEnv()
): string {
  return audience === "creators" ? env.creatorsListKey : env.brandsListKey;
}
