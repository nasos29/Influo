import type { SupabaseClient } from "@supabase/supabase-js";

/** Durable send audit (no raw email addresses). Never throws. */
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
    const { error } = await supabaseAdmin.from("email_log").insert({
      email_type: input.emailType.slice(0, 64),
      ok: input.ok,
      influencer_id: input.influencerId || null,
      meta: input.meta && typeof input.meta === "object" ? input.meta : null,
    });
    if (error && !/relation|does not exist|schema cache/i.test(error.message)) {
      console.warn("[email_log]", error.message);
    }
  } catch (err) {
    console.warn("[email_log]", err instanceof Error ? err.message : err);
  }
}