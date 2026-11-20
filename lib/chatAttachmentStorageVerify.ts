import type { SupabaseClient } from "@supabase/supabase-js";

function splitObjectPath(objectName: string): { folder: string; name: string } {
  const normalized = objectName.replace(/^\/+/, "");
  const i = normalized.lastIndexOf("/");
  if (i < 0) return { folder: "", name: normalized };
  return { folder: normalized.slice(0, i), name: normalized.slice(i + 1) };
}

/** Confirm an object exists at the exact path and matches the expected byte size. */
export async function verifyStorageObjectSize(
  admin: SupabaseClient,
  bucket: string,
  objectName: string,
  expectedBytes: number
): Promise<boolean> {
  const { folder, name } = splitObjectPath(objectName);
  const { data, error } = await admin.storage.from(bucket).list(folder || undefined, {
    limit: 100,
    search: name,
  });
  if (error || !data?.length) return false;
  const match = data.find((f) => f.name === name);
  if (!match) return false;
  const size = Number((match as { metadata?: { size?: number } }).metadata?.size);
  return Number.isFinite(size) && size === expectedBytes;
}