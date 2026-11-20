import path from "node:path";
import { MESSAGE_ATTACHMENTS_BUCKET } from "@/lib/chatAttachmentUpload";

export { MESSAGE_ATTACHMENTS_BUCKET as CHAT_ATTACHMENTS_BUCKET };

function storageExtension(fileName: string | null | undefined, mimeType: string): string {
  const ext = path.extname(String(fileName || "")).toLowerCase().replace(/^\./, "");
  if (ext && /^[a-z0-9]{2,6}$/.test(ext)) return ext;
  const mt = mimeType.toLowerCase();
  if (mt.includes("quicktime")) return "mov";
  if (mt.includes("webm")) return "webm";
  if (mt.includes("3gpp")) return "3gp";
  if (mt.includes("m4v")) return "m4v";
  return "mp4";
}

/** Storage object key for a direct TUS chat video upload. */
export function buildChatAttachmentObjectName(
  conversationId: string,
  fileName: string | null | undefined,
  mimeType: string
): string {
  const ext = storageExtension(fileName, mimeType);
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  return `conversations/${conversationId}/${ts}_${rand}.${ext}`;
}