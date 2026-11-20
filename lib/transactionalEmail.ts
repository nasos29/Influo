import { Resend } from "resend";

const FROM = "Influo <noreply@influo.gr>";

export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendTransactional(
  to: string | null | undefined,
  subject: string,
  html: string,
  opts?: { type?: string; recipientId?: string | null }
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const recipient = String(to || "").trim();
  const logType = (opts?.type || "transactional").slice(0, 120);
  if (!recipient || !recipient.includes("@")) return { ok: false, skipped: true };
  if (!process.env.RESEND_API_KEY) return { ok: false, skipped: true, error: "RESEND_API_KEY missing" };
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: FROM,
      to: [recipient],
      subject,
      html,
    });
    const ok = !error;
    void import("@/lib/emailLogDb").then(({ persistEmailLog }) =>
      persistEmailLog({ type: logType, ok, recipientId: opts?.recipientId })
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "send failed";
    void import("@/lib/emailLogDb").then(({ persistEmailLog }) =>
      persistEmailLog({ type: logType, ok: false, recipientId: opts?.recipientId })
    );
    return { ok: false, error: message };
  }
}
