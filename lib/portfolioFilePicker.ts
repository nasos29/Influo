/**
 * Portfolio file input: accept string + immediate client validation after pick.
 * `application/octet-stream` keeps Android Chrome on the full Files / Camera / Photos chooser.
 */

const VIDEO_MIME = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "video/3gpp",
  "video/x-matroska",
]);
const PHOTO_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
]);

const VIDEO_EXT = new Set(["mp4", "mov", "m4v", "webm", "3gp", "mkv"]);
const PHOTO_EXT = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "gif"]);

function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  return m ? m[1] : "";
}

/** MIME first; empty type or application/octet-stream falls back to extension. */
export function isPortfolioPickableFile(mimeType: string | null | undefined, fileName: string): boolean {
  const mime = String(mimeType ?? "").toLowerCase().trim();
  if (VIDEO_MIME.has(mime) || PHOTO_MIME.has(mime)) return true;
  if (mime && mime !== "application/octet-stream") return false;
  const ext = extOf(fileName);
  return VIDEO_EXT.has(ext) || PHOTO_EXT.has(ext);
}

export const PORTFOLIO_PICK_REJECTED = {
  el: "Επίλεξε βίντεο ή φωτογραφία",
  en: "Choose a video or photo",
} as const;

/** Mobile Files / desktop picker — explicit MIME + extensions (no `video/*` / `image/*`, no `capture`). */
export const PORTFOLIO_FILE_ACCEPT =
  "video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm,image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif,application/octet-stream";