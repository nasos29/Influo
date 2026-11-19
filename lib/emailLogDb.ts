/** Durable send log (additive email_log table). Never stores raw addresses. */

export type EmailLogInsert = {
  type: string;
  ok: boolean;
  provider?: string;
  recipientId?: string | null;
};

export async function persistEmailLog(entry: EmailLogInsert): Promise<void> {
  try {
    const { supabaseService } = await import("@/lib/apiAuth");
    const admin = supabaseService();
    await admin.from("email_log").insert({
      type: entry.type.slice(0, 120),
      ok: entry.ok,
      provider: (entry.provider || "resend").slice(0, 32),
      recipient_id: entry.recipientId ?? null,
    });
  } catch (err) {
    console.error("[email_log]", err instanceof Error ? err.message : err);
  }
}