/** Public HTML body for Zoho category/related / strong-match campaign bulk emails (content_url). */
import { emailNextSteps } from "@/lib/emailNextSteps";

export type CampaignZohoContentKind = "category" | "strong";

export function campaignCategoryEmailSubject(title: string): string {
  return `Νέα καμπάνια στο Influo: ${String(title || "").trim()}`.slice(0, 150);
}

export function campaignCategoryContentUrl(
  campaignId: string,
  siteUrl: string,
  kind: CampaignZohoContentKind = "category"
): string {
  const base = siteUrl.replace(/\/$/, "");
  const q = new URLSearchParams({ campaignId });
  if (kind === "strong") q.set("kind", "strong");
  return `${base}/api/public/zoho-campaign-content?${q.toString()}`;
}

export function campaignCategoryEmailHtml(input: {
  title: string;
  brandName: string;
  campaignId: string;
  siteUrl: string;
  kind?: CampaignZohoContentKind;
}): string {
  const base = input.siteUrl.replace(/\/$/, "");
  const link = `${base}/campaigns/${input.campaignId}`;
  const esc = (v: string) =>
    String(v || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const strong = input.kind === "strong";
  const lead = strong
    ? "Η επιχείρηση δημοσίευσε καμπάνια που ταιριάζει με το προφίλ σου."
    : "Άνοιξε νέα καμπάνια στο Influo που σχετίζεται με την κατηγορία σου.";
  const next = strong ? "campaign_new_creator" : "campaign_category_bulk";
  return `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px;">
  <p>Γεια σου,</p>
  <p>${lead}</p>
  <p><strong>Καμπάνια:</strong> ${esc(input.title)}<br/><strong>Επιχείρηση:</strong> ${esc(input.brandName)}</p>
  <p><a href="${esc(link)}">${esc(link)}</a></p>
  ${emailNextSteps(next)}
  <p style="color:#6b7280;font-size:12px;">Λαμβάνεις αυτό το email επειδή έχεις εγκεκριμένο προφίλ στο Influo.</p>
</div>`;
}
