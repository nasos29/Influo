/**
 * Resize + encode profile/brand images before Supabase Storage upload (WebP when supported, else JPEG).
 * Reduces egress: smaller files from Storage/CDN.
 *
 * Bakes EXIF/orientation into pixels (`imageOrientation: 'from-image'`) so card
 * CSS never depends on client EXIF handling. Does not mutate the user's local
 * original file — only the uploaded Storage object is the derivative.
 */

export type PrepareImageOptions = {
  /** Max width/height in px; longer side scaled down. Default 1024. */
  maxSide?: number;
  /** WebP quality 0–1. Default 0.82 */
  webpQuality?: number;
  /** JPEG fallback quality. Default 0.85 */
  jpegQuality?: number;
};

function stripExtension(name: string): string {
  return name.replace(/\.[^/.]+$/, '') || 'image';
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });
}

async function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode-failed'));
    };
    img.src = url;
  });
}

/**
 * @param file Original image file from input
 * @returns WebP (preferred) or JPEG File; unchanged if not a raster image or conversion fails
 */
export async function prepareImageForStorage(
  file: File,
  options: PrepareImageOptions = {}
): Promise<File> {
  const maxSide = options.maxSide ?? 1024;
  const webpQ = options.webpQuality ?? 0.82;
  const jpegQ = options.jpegQuality ?? 0.85;

  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file;
  }

  let width: number;
  let height: number;
  let bitmap: ImageBitmap | null = null;
  let imgEl: HTMLImageElement | null = null;
  /** True when decode applied EXIF orientation — always re-encode to bake it. */
  let orientedDecode = false;

  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    width = bitmap.width;
    height = bitmap.height;
    orientedDecode = true;
  } catch {
    try {
      bitmap = await createImageBitmap(file);
      width = bitmap.width;
      height = bitmap.height;
      orientedDecode = true;
    } catch {
      try {
        imgEl = await loadImageElement(file);
        width = imgEl.naturalWidth;
        height = imgEl.naturalHeight;
      } catch {
        return file;
      }
    }
  }

  if (width < 1 || height < 1) {
    bitmap?.close();
    return file;
  }

  let outW = width;
  let outH = height;
  if (outW > maxSide || outH > maxSide) {
    const scale = maxSide / Math.max(outW, outH);
    outW = Math.max(1, Math.round(outW * scale));
    outH = Math.max(1, Math.round(outH * scale));
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap?.close();
    return file;
  }

  if (bitmap) {
    ctx.drawImage(bitmap, 0, 0, outW, outH);
    bitmap.close();
  } else if (imgEl) {
    ctx.drawImage(imgEl, 0, 0, outW, outH);
  }

  const baseName = stripExtension(file.name).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'image';
  const downscaled = outW < width || outH < height;
  const mustBake = orientedDecode || downscaled;

  const webpBlob = await canvasToBlob(canvas, 'image/webp', webpQ);
  const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', jpegQ);

  // Prefer smaller WebP when it beats the original.
  if (webpBlob && webpBlob.size > 0 && webpBlob.size < file.size) {
    return new File([webpBlob], `${baseName}.webp`, { type: 'image/webp' });
  }

  // Prefer smaller JPEG when it beats the original.
  if (jpegBlob && jpegBlob.size > 0 && jpegBlob.size < file.size) {
    return new File([jpegBlob], `${baseName}.jpg`, { type: 'image/jpeg' });
  }

  // Bake oriented / downscaled pixels even when encode is not smaller than the source.
  if (mustBake && jpegBlob && jpegBlob.size > 0) {
    return new File([jpegBlob], `${baseName}.jpg`, { type: 'image/jpeg' });
  }
  if (mustBake && webpBlob && webpBlob.size > 0) {
    return new File([webpBlob], `${baseName}.webp`, { type: 'image/webp' });
  }

  return file;
}
