import type { SupabaseClient } from "@supabase/supabase-js";

export type ChatStorageVerifyResult =
  | { ok: true; size: number; contentType: string }
  | { ok: false; reason: "missing" | "size" | "mime" };

/** Confirm object exists at the exact path with expected byte size and content type (via Storage info API). */
export async function verifyChatStorageObject(
  admin: SupabaseClient,
  bucket: string,
  objectName: string,
  expectedBytes: number,
  expectedMime: string
): Promise<ChatStorageVerifyResult> {
  const { data, error } = await admin.storage.from(bucket).info(objectName);
  if (error || !data) return { ok: false, reason: "missing" };

  const meta = data.metadata as { size?: number; mimetype?: string } | undefined;
  const size = Number(data.size ?? meta?.size);
  const contentType = String(data.contentType ?? meta?.mimetype ?? "")
    .toLowerCase()
    .trim();
  const wantMime = String(expectedMime || "")
    .toLowerCase()
    .trim();

  if (!Number.isFinite(size) || size !== expectedBytes) return { ok: false, reason: "size" };
  if (!contentType || !wantMime || contentType !== wantMime) return { ok: false, reason: "mime" };

  return { ok: true, size, contentType };
}