/**
 * Prepare a campaign cover image before upload: center-crop to 16:9, max side 1600px,
 * WebP with iteratively lowered quality until under ~300KB (best effort).
 */

export const CAMPAIGN_COVER_MAX_BYTES = 300 * 1024;
const MAX_SIDE = 1600;
const ASPECT = 16 / 9;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("decode-failed"));
        el.src = url;
      });
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/**
 * @throws Error("not-an-image") for non-raster files, Error("decode-failed") if the image can't be read.
 */
export async function prepareCampaignCover(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    throw new Error("not-an-image");
  }
  const decoded = await decode(file);
  const { width, height } = decoded;
  if (width < 1 || height < 1) {
    decoded.close();
    throw new Error("decode-failed");
  }

  // Center crop to 16:9
  let sw = width;
  let sh = height;
  if (width / height > ASPECT) sw = Math.round(height * ASPECT);
  else sh = Math.round(width / ASPECT);
  const sx = Math.round((width - sw) / 2);
  const sy = Math.round((height - sh) / 2);

  const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const outW = Math.max(1, Math.round(sw * scale));
  const outH = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    decoded.close();
    throw new Error("canvas-unavailable");
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(decoded.source, sx, sy, sw, sh, 0, 0, outW, outH);
  decoded.close();

  const base = (file.name.replace(/\.[^/.]+$/, "") || "cover").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 60) || "cover";

  let type = "image/webp";
  let ext = "webp";
  let best: Blob | null = null;
  for (let quality = 0.85; quality >= 0.4; quality -= 0.1) {
    const blob = await canvasToBlob(canvas, type, quality);
    if (!blob || blob.size === 0) continue;
    if (blob.type && blob.type !== type) {
      // Browser doesn't support WebP encoding and returned PNG — fall back to JPEG.
      type = "image/jpeg";
      ext = "jpg";
      best = null;
      quality = 0.95;
      continue;
    }
    best = blob;
    if (blob.size <= CAMPAIGN_COVER_MAX_BYTES) break;
  }
  if (!best && type === "image/webp") {
    type = "image/jpeg";
    ext = "jpg";
  }
  if (type === "image/jpeg" && (!best || best.size > CAMPAIGN_COVER_MAX_BYTES)) {
    for (let quality = 0.85; quality >= 0.4; quality -= 0.1) {
      const blob = await canvasToBlob(canvas, type, quality);
      if (!blob || blob.size === 0) continue;
      best = blob;
      if (blob.size <= CAMPAIGN_COVER_MAX_BYTES) break;
    }
  }
  if (!best) throw new Error("encode-failed");
  return new File([best], `${base}.${ext}`, { type });
}
