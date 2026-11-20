/**
 * Chat message attachments: validation, limits, chunked upload constants.
 * Small non-video files use POST /api/messages/upload; large videos use chunked /api/messages/uploads.
 */

import {
  UPLOAD_CHUNK_BYTES,
  UPLOAD_PARALLEL_CHUNKS,
  chunkCount,
  sniffMediaType,
} from "@/lib/portfolioUpload";

export const MESSAGE_ATTACHMENTS_BUCKET = "message-attachments";

export const MAX_CHAT_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_CHAT_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
export const CHAT_UPLOAD_CHUNK_BYTES = UPLOAD_CHUNK_BYTES;
export const CHAT_UPLOAD_PARALLEL_CHUNKS = UPLOAD_PARALLEL_CHUNKS;

export { chunkCount };

/** Abuse guard (uploads only). */
export const MAX_ACTIVE_CHAT_UPLOADS_PER_USER = 4;

export type ChatAttachmentKind = "video" | "image" | "pdf" | "text";

const VIDEO_MIME = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-m4v", "video/3gpp"]);
const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);
const VIDEO_EXT = new Set(["mp4", "mov", "webm", "m4v", "3gp"]);
const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"]);

function extOf(name: string | null | undefined): string {
  const m = String(name || "").toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  return m ? m[1] : "";
}

export function chatAttachmentKind(
  mimeType: string | null | undefined,
  fileName?: string | null
): ChatAttachmentKind | null {
  const mime = String(mimeType || "").toLowerCase().trim();
  if (VIDEO_MIME.has(mime)) return "video";
  if (IMAGE_MIME.has(mime) || (mime && mime.startsWith("image/"))) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime === "text/plain") return "text";
  if (mime && mime !== "application/octet-stream") return null;
  const ext = extOf(fileName);
  if (VIDEO_EXT.has(ext)) return "video";
  if (IMAGE_EXT.has(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (ext === "txt" || ext === "text") return "text";
  return null;
}

export type ChatAttachmentValidation =
  | { ok: true; kind: ChatAttachmentKind; mimeType: string }
  | { ok: false; code: "type" | "size" | "empty"; message: { el: string; en: string } };

export function validateChatAttachment(input: {
  mimeType?: string | null;
  fileName?: string | null;
  size?: number | null;
}): ChatAttachmentValidation {
  const size = Number(input.size);
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, code: "empty", message: { el: "Το αρχείο είναι κενό.", en: "The file is empty." } };
  }
  const kind = chatAttachmentKind(input.mimeType, input.fileName);
  if (!kind) {
    return {
      ok: false,
      code: "type",
      message: {
        el: "Εικόνα, PDF ή βίντεο (MP4, MOV, WebM, M4V, 3GP).",
        en: "Image, PDF, or video (MP4, MOV, WebM, M4V, 3GP).",
      },
    };
  }
  if (kind === "video" && size > MAX_CHAT_VIDEO_BYTES) {
    return {
      ok: false,
      code: "size",
      message: { el: "Το βίντεο ξεπερνά τα 2GB.", en: "The video is larger than 2 GB." },
    };
  }
  if (kind !== "video" && size > MAX_CHAT_FILE_BYTES) {
    return {
      ok: false,
      code: "size",
      message: { el: "Το αρχείο ξεπερνά τα 10MB.", en: "The file is larger than 10 MB." },
    };
  }
  const mime = String(input.mimeType || "").toLowerCase().trim();
  const defaultMime =
    kind === "video"
      ? "video/mp4"
      : kind === "pdf"
        ? "application/pdf"
        : kind === "text"
          ? "text/plain"
          : "image/jpeg";
  return { ok: true, kind, mimeType: mime || defaultMime };
}

/** Client-side pick validation (MIME first, extension fallback). */
export function isChatPickableFile(mimeType: string | null | undefined, fileName: string): boolean {
  return chatAttachmentKind(mimeType, fileName) !== null;
}

export const CHAT_PICK_REJECTED = {
  el: "Επίλεξε εικόνα, PDF, κείμενο ή βίντεο",
  en: "Choose an image, PDF, text file, or video",
} as const;

export const CHAT_FILE_ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif," +
  "video/mp4,video/quicktime,video/webm,video/x-m4v,video/3gpp,.mp4,.mov,.m4v,.webm,.3gp," +
  "application/pdf,text/plain,.pdf,.txt,application/octet-stream";

export function needsChunkedChatUpload(size: number, kind: ChatAttachmentKind): boolean {
  return kind === "video" && size > MAX_CHAT_FILE_BYTES;
}

/** Magic-byte check on first chunk (videos/images). */
export function sniffChatAttachmentKind(head: Uint8Array, expected: ChatAttachmentKind): boolean {
  if (expected === "pdf") {
    return head.length >= 4 && String.fromCharCode(head[0], head[1], head[2], head[3]) === "%PDF";
  }
  if (expected === "text") return true;
  const sniffed = sniffMediaType(head);
  if (expected === "video") return sniffed === "video";
  if (expected === "image") return sniffed === "photo";
  return false;
}

/** Display name: keep Unicode; strip path segments and HTML-risk chars. */
export function attachmentDisplayFilename(raw: string | null | undefined): string {
  let name = String(raw || "file").trim().slice(0, 200);
  name = name.replace(/^.*[/\\]/, "");
  name = name.replace(/[\x00-\x1f<>]/g, "");
  return name || "file";
}

/** ASCII-only storage object basename (extension preserved). */
export function attachmentStorageBasename(displayName: string, fallbackExt: string): string {
  const base = displayName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 60) || "file";
  const ext = fallbackExt.replace(/^\./, "").slice(0, 8) || "bin";
  const hasExt = /\.[a-z0-9]{2,8}$/i.test(base);
  return hasExt ? base : `${base}.${ext}`;
}