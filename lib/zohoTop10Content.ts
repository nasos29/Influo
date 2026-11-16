/** Generic Top 10 congrats body for Zoho bulk (content_url). */
import { emailNextSteps } from "@/lib/emailNextSteps";

export const TOP10_CONGRATS_ZOHO_SUBJECT = "Συγχαρητήρια! Μπήκες στο Top 10 του Influo 🏆";

export function top10CongratsContentUrl(siteUrl?: string): string {
  const base = (siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(/\/$/, "");
  return `${base}/api/public/zoho-top10-congrats-content`;
}

export function top10CongratsEmailHtml(opts?: { siteUrl?: string }): string {
  const base = (opts?.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(
    /\/$/,
    ""
  );
  return `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px;">
  <p>Γεια σου,</p>
  <p>Συγχαρητήρια — το προφίλ σου μπήκε στα <strong>Top 10 influencers</strong> του Influo.</p>
  <p>Τα Brands βλέπουν τώρα το προφίλ σου πιο ψηλά στην αρχική σελίδα.</p>
  <p><a href="${base}/dashboard">Δες το προφίλ σου</a></p>
  ${emailNextSteps("top10_congrats")}
  <p style="font-size: 12px; color: #6b7280;">Καλή συνέχεια,<br/>Η ομάδα του Influo</p>
</div>`;
}
