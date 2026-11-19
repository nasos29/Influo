import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Durable send audit (no raw email addresses). Never throws.
 * Writes the shared email_log schema from #478/#480 (type, ok, provider,
 * recipient_id, deal_ref, party) — same columns as lib/emailLogDb.
 */
export async function persistEmailLog(
  supabaseAdmin: SupabaseClient,
  input: {
    emailType: string;
    ok: boolean;
    influencerId?: string | null;
    meta?: Record<string, unknown> | null;
  }
): Promise<void> {
  try {
    const meta = input.meta && typeof input.meta === "object" ? input.meta : null;
    const ref = meta
      ? Object.values(meta)
          .filter((v) => typeof v === "string" || typeof v === "number")
          .join(":")
      : "";
    const { error } = await supabaseAdmin.from("email_log").insert({
      type: input.emailType.slice(0, 120),
      ok: input.ok,
      provider: "resend",
      recipient_id: input.influencerId || null,
      deal_ref: ref ? ref.slice(0, 64) : null,
      party: input.influencerId ? "influencer" : null,
    });
    if (error && !/relation|does not exist|schema cache/i.test(error.message)) {
      console.warn("[email_log]", error.message);
    }
  } catch (err) {
    console.warn("[email_log]", err instanceof Error ? err.message : err);
  }
}
