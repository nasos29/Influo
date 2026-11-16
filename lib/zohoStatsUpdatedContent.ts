/** Generic stats-updated body for Zoho bulk (content_url). Personalized diffs stay on Resend. */
import { emailNextSteps } from "@/lib/emailNextSteps";

export const STATS_UPDATED_ZOHO_SUBJECT = "Ενημερώσαμε τα στατιστικά σου στο Influo 📈";

export function statsUpdatedContentUrl(siteUrl?: string): string {
  const base = (siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(/\/$/, "");
  return `${base}/api/public/zoho-stats-updated-content`;
}

export function statsUpdatedEmailHtml(opts?: { siteUrl?: string }): string {
  const base = (opts?.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(
    /\/$/,
    ""
  );
  return `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px;">
  <p>Γεια σου,</p>
  <p>Ανανεώσαμε τα στατιστικά του προφίλ σου στο Influo (followers, engagement και σχετικά δεδομένα).</p>
  <p><a href="${base}/dashboard">Δες το προφίλ σου στο dashboard</a></p>
  ${emailNextSteps("stats_update")}
  <p style="font-size: 12px; color: #6b7280;">Τα στατιστικά ανανεώνονται αυτόματα κάθε 15 μέρες.</p>
</div>`;
}
