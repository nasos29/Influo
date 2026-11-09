import type { ZohoAudience } from "@/lib/zohoCampaignsConfig";

export const ANNOUNCEMENT_EMAIL_SUBJECT = "Υπάρχει μια νέα ανακοίνωση στο Influo";

export function announcementEmailHtml(dashboardPath: string, siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, "");
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 560px; margin: 0 auto;">
  <p style="margin: 0 0 16px 0;">Υπάρχει μια νέα ανακοίνωση στο Influo.</p>
  <p style="margin: 0 0 20px 0;">Συνδέσου στο dashboard σου για να τη δεις.</p>
  <p style="margin: 0;"><a href="${base}${dashboardPath}" style="color: #2563eb; font-weight: 600;">Άνοιξε το Influo →</a></p>
</div>`;
}

export function announcementContentUrl(audience: ZohoAudience, siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, "");
  return `${base}/api/public/zoho-announcement-content?audience=${audience}`;
}

export function dashboardPathForAudience(audience: ZohoAudience): string {
  if (audience === "brands") {
    return `/brand/login?redirect=${encodeURIComponent("/brand/dashboard?tab=announcements")}`;
  }
  return "/login?redirect=/dashboard";
}
