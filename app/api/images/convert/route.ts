import { NextRequest, NextResponse } from "next/server";
import { userFromBearer } from "@/lib/apiAuth";
import {
  IMAGE_CONVERT_MAX_BYTES,
  convertImageBufferToWebp,
  isConvertibleRasterInput,
  looksLikeHeicOrHeif,
} from "@/lib/serverImageConvert";

export const runtime = "nodejs";

/**
 * Authenticated image → WebP converter for HEIC/HEIF (and other rasters the
 * client cannot canvas-decode). Returns raw WebP bytes; caller uploads to Storage.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await userFromBearer(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const raw = form.get("file");
    if (!raw || typeof raw === "string") {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    const file = raw as Blob & { name?: string };

    const size = file.size;
    if (!size || size > IMAGE_CONVERT_MAX_BYTES) {
      return NextResponse.json(
        { error: `File exceeds ${IMAGE_CONVERT_MAX_BYTES} byte limit` },
        { status: 400 }
      );
    }

    const fileName =
      (typeof file.name === "string" && file.name) || String(form.get("filename") || "image");
    const mime = (file.type || "").trim();
    const input = Buffer.from(await file.arrayBuffer());

    if (
      !isConvertibleRasterInput({ mime, fileName, bytes: input }) &&
      !looksLikeHeicOrHeif({ mime, fileName, bytes: input })
    ) {
      return NextResponse.json({ error: "unsupported_type" }, { status: 400 });
    }

    const maxSideRaw = Number(form.get("maxSide") || 1024);
    const maxSide = Number.isFinite(maxSideRaw)
      ? Math.min(4096, Math.max(64, Math.round(maxSideRaw)))
      : 1024;
    const webpQRaw = Number(form.get("webpQuality") || 0.82);
    const webpQuality = Number.isFinite(webpQRaw)
      ? Math.min(1, Math.max(0.4, webpQRaw))
      : 0.82;

    const { buffer, contentType } = await convertImageBufferToWebp(input, {
      maxSide,
      webpQuality,
    });

    const base =
      fileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) ||
      "image";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${base}.webp"`,
        "Cache-Control": "no-store",
        "X-Converted-From": looksLikeHeicOrHeif({ mime, fileName, bytes: input })
          ? "heic"
          : "raster",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[images/convert]", msg);
    return NextResponse.json({ error: "convert_failed" }, { status: 500 });
  }
}
