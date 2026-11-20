import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { supabaseService } from "@/lib/apiAuth";
import { chatStagingRoot, removeChatUploadStaging } from "@/lib/chatAttachmentUploadStaging";

const STALE_MS = 2 * 60 * 60 * 1000;

export async function processChatUploadCleanup(): Promise<{
  staleCancelled: number;
  orphanDirsRemoved: number;
}> {
  const admin = supabaseService();
  const cutoff = new Date(Date.now() - STALE_MS).toISOString();

  const { data: stale } = await admin
    .from("message_attachment_uploads")
    .select("id, created_by")
    .eq("status", "uploading")
    .lt("updated_at", cutoff);

  let staleCancelled = 0;
  for (const row of stale || []) {
    await admin
      .from("message_attachment_uploads")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "uploading");
    await removeChatUploadStaging(row.created_by, row.id);
    staleCancelled += 1;
  }

  const { data: active } = await admin
    .from("message_attachment_uploads")
    .select("id")
    .eq("status", "uploading");
  const activeIds = new Set((active || []).map((r) => String(r.id).toLowerCase()));

  let orphanDirsRemoved = 0;
  const root = chatStagingRoot();
  let userDirs: string[];
  try {
    userDirs = await readdir(root);
  } catch {
    return { staleCancelled, orphanDirsRemoved };
  }

  for (const userId of userDirs) {
    const userPath = path.join(root, userId);
    let uploadIds: string[];
    try {
      const st = await stat(userPath);
      if (!st.isDirectory()) continue;
      uploadIds = await readdir(userPath);
    } catch {
      continue;
    }
    for (const uploadId of uploadIds) {
      const uploadPath = path.join(userPath, uploadId);
      try {
        const st = await stat(uploadPath);
        if (!st.isDirectory()) continue;
      } catch {
        continue;
      }
      if (!activeIds.has(uploadId.toLowerCase())) {
        await rm(uploadPath, { recursive: true, force: true }).catch(() => undefined);
        orphanDirsRemoved += 1;
      }
    }
  }

  return { staleCancelled, orphanDirsRemoved };
}