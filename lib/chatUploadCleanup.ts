import { supabaseService } from "@/lib/apiAuth";
import { MESSAGE_ATTACHMENTS_BUCKET } from "@/lib/chatAttachmentUpload";

const STALE_MS = 24 * 60 * 60 * 1000;

/** Cancel uploads stuck in `uploading` for 24h+ and remove partial storage objects. */
export async function processChatUploadCleanup(): Promise<{ staleCancelled: number }> {
  const admin = supabaseService();
  const cutoff = new Date(Date.now() - STALE_MS).toISOString();

  const { data: stale } = await admin
    .from("message_attachment_uploads")
    .select("id, storage_path")
    .eq("status", "uploading")
    .lt("updated_at", cutoff);

  let staleCancelled = 0;
  for (const row of stale || []) {
    const { data: updated } = await admin
      .from("message_attachment_uploads")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "uploading")
      .select("id")
      .maybeSingle();
    if (!updated) continue;
    if (row.storage_path) {
      await admin.storage.from(MESSAGE_ATTACHMENTS_BUCKET).remove([row.storage_path]).catch(() => undefined);
    }
    staleCancelled += 1;
  }

  return { staleCancelled };
}