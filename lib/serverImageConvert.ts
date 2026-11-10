/**
 * Server-side image conversion. Decodes HEIC/HEIF (via heic-convert — sharp's
 * prebuilt libheif often lacks HEVC) then resizes/encodes to WebP with sharp.
 */
import convert from "heic-convert";
import sharp from "sharp";

export const IMAGE_CONVERT_MAX_BYTES = 10 * 1024 * 1024;

/** ISO BMFF brands commonly used by HEIC/HEIF. */
const HEIF_FTYP = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
]);

export type ServerConvertOptions = {
  maxSide?: number;
  webpQuality?: number;
};

export function looksLikeHeicOrHeif(opts: {
  mime?: string | null;
  fileName?: string | null;
  bytes?: Buffer | Uint8Array | null;
}): boolean {
  const mime = (opts.mime || "").toLowerCase().trim();
  if (
    mime === "image/heic" ||
    mime === "image/heif" ||
    mime === "image/heic-sequence" ||
    mime === "image/heif-sequence"
  ) {
    return true;
  }

  const name = (opts.fileName || "").toLowerCase();
  if (/\.(heic|heif)$/i.test(name)) return true;

  const bytes = opts.bytes;
  if (bytes && bytes.byteLength >= 12) {
    const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    // ftyp box at offset 4
    if (buf.subarray(4, 8).toString("ascii") === "ftyp") {
      const brand = buf.subarray(8, 12).toString("ascii").toLowerCase();
      if (HEIF_FTYP.has(brand)) return true;
    }
  }
  return false;
}

export function isConvertibleRasterInput(opts: {
  mime?: string | null;
  fileName?: string | null;
  bytes?: Buffer | Uint8Array | null;
}): boolean {
  const mime = (opts.mime || "").toLowerCase().trim();
  if (mime === "image/svg+xml" || mime === "image/gif") return false;
  if (mime.startsWith("image/")) return true;
  if (looksLikeHeicOrHeif(opts)) return true;
  // Empty/odd mime from iPhone — accept if extension looks like a raster
  const name = (opts.fileName || "").toLowerCase();
  if (/\.(jpe?g|png|webp|heic|heif|tiff?|bmp)$/i.test(name)) return true;
  return false;
}

async function decodeHeicToJpegBuffer(input: Buffer): Promise<Buffer> {
  const out = await convert({
    buffer: input,
    format: "JPEG",
    quality: 0.92,
  });
  return Buffer.from(out);
}

/**
 * Convert input bytes to WebP (rotated per EXIF, resized to maxSide).
 * HEIC/HEIF is decoded with heic-convert first, then sharp encodes WebP.
 * Throws if the buffer cannot be decoded.
 */
export async function convertImageBufferToWebp(
  input: Buffer,
  options: ServerConvertOptions = {}
): Promise<{ buffer: Buffer; contentType: "image/webp"; extension: "webp" }> {
  const maxSide = options.maxSide ?? 1024;
  const quality = Math.round(
    Math.min(100, Math.max(1, (options.webpQuality ?? 0.82) * 100))
  );

  let raster = input;
  if (looksLikeHeicOrHeif({ bytes: input })) {
    try {
      raster = await decodeHeicToJpegBuffer(input);
    } catch (heicErr) {
      // Fall through to sharp in case libvips can decode this variant
      console.warn(
        "[serverImageConvert] heic-convert failed, trying sharp:",
        heicErr instanceof Error ? heicErr.message : heicErr
      );
    }
  }

  try {
    const buffer = await sharp(raster, { failOn: "none", limitInputPixels: 40_000_000 })
      .rotate()
      .resize({
        width: maxSide,
        height: maxSide,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality })
      .toBuffer();
    return { buffer, contentType: "image/webp", extension: "webp" };
  } catch (sharpErr) {
    // Last chance: input may be HEIC without detectable ftyp (truncated) — try heic-convert
    if (!looksLikeHeicOrHeif({ bytes: input })) {
      try {
        raster = await decodeHeicToJpegBuffer(input);
        const buffer = await sharp(raster, { failOn: "none", limitInputPixels: 40_000_000 })
          .rotate()
          .resize({
            width: maxSide,
            height: maxSide,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality })
          .toBuffer();
        return { buffer, contentType: "image/webp", extension: "webp" };
      } catch {
        // rethrow original
      }
    }
    throw sharpErr;
  }
}
