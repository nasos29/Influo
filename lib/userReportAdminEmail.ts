import { Resend } from "resend";
import { adminInboxAddress } from "@/lib/adminMessageSummary";
import { isUserReportEmailsEnabled } from "@/lib/userReportFlags";
import { userReportReasonLabel, type UserReportReason } from "@/lib/userReports";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** Notify admin inbox when USER_REPORT_EMAILS_ENABLED is on. Never throws. */
export async function emailAdminUserReport(opts: {
  reportId: string;
  reason: UserReportReason;
  targetLabel: string;
  reporterRole: string;
}): Promise<void> {
  if (!isUserReportEmailsEnabled() || !process.env.RESEND_API_KEY) return;
  try {
    const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.influo.gr").replace(/\/$/, "");
    const to = adminInboxAddress(process.env.ADMIN_EMAIL);
    const resend = new Resend(process.env.RESEND_API_KEY);
    const reasonEl = userReportReasonLabel(opts.reason, "el");
    const { error } = await resend.emails.send({
      from: "Influo <noreply@influo.gr>",
      to: [to],
      subject: `Νέα αναφορά χρήστη: ${opts.targetLabel}`,
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.6;color:#1f2937;max-width:560px">
<p>Νέα αναφορά από <strong>${esc(opts.reporterRole)}</strong> για <strong>${esc(opts.targetLabel)}</strong>.</p>
<p><strong>Λόγος:</strong> ${esc(reasonEl)}</p>
<p><a href="${site}/admin?tab=reports">Άνοιγμα αναφορών (admin)</a></p>
</div>`,
    });
    if (error) console.warn("[user report email]", error.message);
  } catch (err) {
    console.warn("[user report email]", err instanceof Error ? err.message : err);
  }
}