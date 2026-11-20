import type { SupabaseClient } from "@supabase/supabase-js";

export type SignedChatUploadToken = {
  token: string;
  path: string;
};

/** Service-role signed upload token for a single object path (no upsert). */
export async function createChatAttachmentSignedUploadToken(
  admin: SupabaseClient,
  bucket: string,
  objectName: string
): Promise<SignedChatUploadToken> {
  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(objectName, { upsert: false });
  if (error || !data?.token) {
    throw new Error(error?.message || "Could not create signed upload URL");
  }
  return { token: data.token, path: data.path };
}