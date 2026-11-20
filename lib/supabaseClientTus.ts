/** Browser-side Supabase Storage resumable (TUS) endpoint + auth headers for @uppy/tus. */

export const SUPABASE_TUS_ALLOWED_META = ["bucketName", "objectName", "contentType", "cacheControl"] as const;

export const SUPABASE_TUS_RETRY_DELAYS = [0, 1000, 3000, 5000, 10000] as const;

export type SupabaseTusAuth =
  | { mode: "signed"; signature: string }
  | { mode: "bearer"; accessToken: string };

export function supabasePublicBaseUrl(): string {
  const base = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  return base;
}

export function supabaseResumableTusTarget(auth: SupabaseTusAuth): { endpoint: string; headers: Record<string, string> } {
  const base = supabasePublicBaseUrl();
  if (auth.mode === "signed") {
    return {
      endpoint: `${base}/storage/v1/upload/resumable/sign`,
      headers: { "x-signature": auth.signature, "x-upsert": "false" },
    };
  }
  return {
    endpoint: `${base}/storage/v1/upload/resumable`,
    headers: { Authorization: `Bearer ${auth.accessToken}`, "x-upsert": "false" },
  };
}