/** Public HTML body for Zoho category/related campaign bulk emails (content_url). */

export function campaignCategoryEmailSubject(title: string): string {
  return `Νέα καμπάνια στο Influo: ${String(title || "").trim()}`.slice(0, 150);
}

export function campaignCategoryContentUrl(campaignId: string, siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, "");
  return `${base}/api/public/zoho-campaign-content?campaignId=${encodeURIComponent(campaignId)}`;
}

export function campaignCategoryEmailHtml(input: {
  title: string;
  brandName: string;
  campaignId: string;
  siteUrl: string;
}): string {
  const base = input.siteUrl.replace(/\/$/, "");
  const link = `${base}/campaigns/${input.campaignId}`;
  const esc = (v: string) =>
    String(v || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  return `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px;">
  <p>Γεια σου,</p>
  <p>Άνοιξε νέα καμπάνια στο Influo που σχετίζεται με την κατηγορία σου.</p>
  <p><strong>Καμπάνια:</strong> ${esc(input.title)}<br/><strong>Επιχείρηση:</strong> ${esc(input.brandName)}</p>
  <p><a href="${esc(link)}">${esc(link)}</a></p>
  <p style="color:#6b7280;font-size:12px;">Λαμβάνεις αυτό το email επειδή έχεις εγκεκριμένο προφίλ στο Influo.</p>
  <p style="color:#6b7280;font-size:12px;">Hi — a new Influo campaign matching your category just opened. Open the link above to view it.</p>
</div>`;
}
