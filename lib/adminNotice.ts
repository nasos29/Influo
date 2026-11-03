import { supabaseService } from "@/lib/apiAuth";

/**
 * In-app admin notice (table admin_notices, service role only). Idempotent by `dedupeKey`
 * (unique column). Never throws; plain text.
 */
export async function addAdminNotice(n: { kind: string; title: string; body?: string | null; url?: string | null; dedupeKey: string }): Promise<boolean> {
  try {
    const { error } = await supabaseService()
      .from("admin_notices")
      .upsert(
        { kind: n.kind, title: n.title.slice(0, 200), body: n.body ?? null, url: n.url ?? null, dedupe_key: n.dedupeKey },
        { onConflict: "dedupe_key", ignoreDuplicates: true }
      );
    if (error) {
      console.error("[admin notice]", n.kind, error.code, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[admin notice]", n.kind, err instanceof Error ? err.message : err);
    return false;
  }
}
