/**
 * Supabase project URL for server-side API calls (service role, REST, storage upload).
 * Prefer SUPABASE_INTERNAL_URL when set so saturated public links do not affect DB traffic.
 * Do not import from client components; browser-facing URLs must use NEXT_PUBLIC_SUPABASE_URL.
 */

export function getServerSupabaseUrl(): string {
  const internal = (process.env.SUPABASE_INTERNAL_URL ?? "").trim();
  if (internal) return internal.replace(/\/+$/, "");
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
}

/** Public storage object URL for responses stored in the DB or sent to browsers. */
export function publicSupabaseStorageObjectUrl(bucket: string, objectPath: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const key = objectPath.replace(/^\/+/, "");
  return encodeURI(`${base}/storage/v1/object/public/${bucket}/${key}`);
}