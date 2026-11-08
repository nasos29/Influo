import type { SupabaseClient } from "@supabase/supabase-js";

/** Read admin notices older than this many days are eligible for automatic deletion. */
export const ADMIN_NOTICE_READ_RETENTION_DAYS = 30;

/**
 * Delete read admin_notices older than retention. Never touches unread (read_at IS NULL).
 * Returns deleted count (best-effort; 0 on error).
 */
export async function pruneOldReadAdminNotices(
  admin: SupabaseClient,
  retentionDays = ADMIN_NOTICE_READ_RETENTION_DAYS
): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("admin_notices")
    .delete()
    .not("read_at", "is", null)
    .lt("read_at", cutoff)
    .select("id");
  if (error) {
    console.error("[pruneAdminNotices]", error.code, error.message);
    return 0;
  }
  return data?.length ?? 0;
}
