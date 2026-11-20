/**
 * Direct portfolio uploads (video/photo): shared limits + validation.
 * Used by the upload API (server) and PortfolioMediaUploader (client).
 */

export const PORTFOLIO_UPLOAD_BUCKET = "creator-uploads";

export const MAX_UPLOAD_VIDEO_BYTES = 500 * 1024 * 1024;
export const MAX_UPLOAD_PHOTO_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_VIDEO_SECONDS = 180;
/** Chunk size: below nginx client_max_body_size (50m) and the staging bucket limit (16 MB). */
export const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;
/** Parallel in-flight chunk PUTs (server accepts out-of-order chunk indices). */
export const UPLOAD_PARALLEL_CHUNKS = 3;

export { PORTFOLIO_FILE_ACCEPT, isPortfolioPickableFile } from "./portfolioFilePicker";

/** Abuse guards (uploads only; nothing here limits emails). */
export const MAX_ACTIVE_UPLOADS_PER_CREATOR = 6;
export const MAX_UPLOADS_PER_CREATOR_PER_DAY = 30;

export type UploadMediaType = "video" | "photo";

const VIDEO_MIME = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-m4v", "video/3gpp"]);
const PHOTO_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const VIDEO_EXT = new Set(["mp4", "mov", "webm", "m4v", "3gp"]);
const PHOTO_EXT = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);

function extOf(name: string | null | undefined): string {
  const m = String(name || "").toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  return m ? m[1] : "";
}

/** Video or photo from MIME, falling back to the extension (iOS sometimes sends an empty type for HEIC). */
export function uploadMediaType(mimeType: string | null | undefined, fileName?: string | null): UploadMediaType | null {
  const mime = String(mimeType || "").toLowerCase().trim();
  if (VIDEO_MIME.has(mime)) return "video";
  if (PHOTO_MIME.has(mime)) return "photo";
  if (mime && mime !== "application/octet-stream") return null;
  const ext = extOf(fileName);
  if (VIDEO_EXT.has(ext)) return "video";
  if (PHOTO_EXT.has(ext)) return "photo";
  return null;
}

export type UploadValidation =
  | { ok: true; mediaType: UploadMediaType; mimeType: string }
  | { ok: false; code: "type" | "size" | "duration" | "empty"; message: { el: string; en: string } };

export function validateUploadRequest(input: {
  mimeType?: string | null;
  fileName?: string | null;
  size?: number | null;
  durationSec?: number | null;
}): UploadValidation {
  const size = Number(input.size);
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, code: "empty", message: { el: "Το αρχείο είναι κενό.", en: "The file is empty." } };
  }
  const mediaType = uploadMediaType(input.mimeType, input.fileName);
  if (!mediaType) {
    return {
      ok: false,
      code: "type",
      message: {
        el: "Επιτρέπονται βίντεο (MP4, MOV, WebM) ή φωτογραφίες JPG, PNG, HEIC, WebP.",
        en: "Allowed: videos (MP4, MOV, WebM) or JPG, PNG, HEIC, WebP photos.",
      },
    };
  }
  if (mediaType === "video" && size > MAX_UPLOAD_VIDEO_BYTES) {
    return { ok: false, code: "size", message: { el: "Το βίντεο ξεπερνά τα 500 MB.", en: "The video is larger than 500 MB." } };
  }
  if (mediaType === "photo" && size > MAX_UPLOAD_PHOTO_BYTES) {
    return { ok: false, code: "size", message: { el: "Η φωτογραφία ξεπερνά τα 20 MB.", en: "The photo is larger than 20 MB." } };
  }
  const dur = Number(input.durationSec);
  if (mediaType === "video" && Number.isFinite(dur) && dur > MAX_UPLOAD_VIDEO_SECONDS + 0.5) {
    return { ok: false, code: "duration", message: { el: "Το βίντεο ξεπερνά τα 3 λεπτά.", en: "The video is longer than 3 minutes." } };
  }
  const mime = String(input.mimeType || "").toLowerCase().trim();
  return { ok: true, mediaType, mimeType: mime || (mediaType === "video" ? "video/mp4" : "image/jpeg") };
}

/** Magic-byte check on the first chunk so a renamed file cannot pass as media. */
export function sniffMediaType(head: Uint8Array): UploadMediaType | null {
  if (head.length < 12) return null;
  const ascii = (from: number, to: number) => String.fromCharCode(...head.slice(from, to));
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "photo"; // JPEG
  if (head[0] === 0x89 && ascii(1, 4) === "PNG") return "photo";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "photo";
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return "video"; // WebM/Matroska
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12).toLowerCase();
    if (["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1", "avif"].includes(brand)) {
      return brand === "avif" ? null : "photo";
    }
    return "video"; // isom, mp41, mp42, qt  , M4V , 3gp*, …
  }
  return null;
}

export function chunkCount(totalBytes: number, chunkBytes = UPLOAD_CHUNK_BYTES): number {
  return Math.max(1, Math.ceil(totalBytes / chunkBytes));
}

export function chunkObjectPath(influencerId: string, uploadId: string, index: number): string {
  return `uploads/${influencerId.toLowerCase()}/${uploadId.toLowerCase()}/${String(index).padStart(5, "0")}`;
}

/**
 * Validate one PUT chunk: must start at a chunk boundary, be a full chunk unless last,
 * and never run past the declared size.
 */
export function validateChunk(input: {
  offset: number;
  length: number;
  totalBytes: number;
  chunkBytes: number;
}): { ok: true; index: number } | { ok: false; reason: string } {
  const { offset, length, totalBytes, chunkBytes } = input;
  if (!Number.isInteger(offset) || offset < 0) return { ok: false, reason: "bad offset" };
  if (offset % chunkBytes !== 0) return { ok: false, reason: "offset not on a chunk boundary" };
  if (length <= 0) return { ok: false, reason: "empty chunk" };
  if (length > chunkBytes) return { ok: false, reason: "chunk too large" };
  if (offset + length > totalBytes) return { ok: false, reason: "chunk past end of file" };
  const isLast = offset + length === totalBytes;
  if (!isLast && length !== chunkBytes) return { ok: false, reason: "short chunk before end" };
  return { ok: true, index: offset / chunkBytes };
}

/** Slots left in the portfolio (6 total) after saved items and uploads still in flight. */
export function portfolioSlotsLeft(savedCount: number, inFlightCount: number, max = 6): number {
  return Math.max(0, max - Math.max(0, savedCount) - Math.max(0, inFlightCount));
}

export const IN_FLIGHT_UPLOAD_STATUSES = ["uploading", "uploaded", "processing"] as const;

export { isUploadedPortfolioUrl } from "@/lib/portfolioHosted";
