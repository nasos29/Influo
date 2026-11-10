/**
 * Client helper: POST a file the browser cannot canvas-decode (HEIC/HEIF) to
 * /api/images/convert and return a WebP File for Storage upload.
 */
import { supabase } from "@/lib/supabaseClient";

export function clientLooksLikeHeicOrHeif(file: File): boolean {
  const mime = (file.type || "").toLowerCase().trim();
  if (
    mime === "image/heic" ||
    mime === "image/heif" ||
    mime === "image/heic-sequence" ||
    mime === "image/heif-sequence"
  ) {
    return true;
  }
  return /\.(heic|heif)$/i.test(file.name || "");
}

export async function convertImageViaServer(
  file: File,
  options: { maxSide?: number; webpQuality?: number } = {}
): Promise<File> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error("auth-required-for-heic-convert");
  }

  const form = new FormData();
  form.append("file", file, file.name || "image.heic");
  form.append("filename", file.name || "image.heic");
  form.append("maxSide", String(options.maxSide ?? 1024));
  form.append("webpQuality", String(options.webpQuality ?? 0.82));

  const res = await fetch("/api/images/convert", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`server-convert-failed:${res.status}:${errText.slice(0, 120)}`);
  }

  const blob = await res.blob();
  if (!blob || blob.size < 32) {
    throw new Error("server-convert-empty");
  }

  const base =
    (file.name || "image").replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) ||
    "image";
  return new File([blob], `${base}.webp`, { type: "image/webp" });
}
