/**
 * Public URL + backend switch for self-hosted creator media.
 *
 * Objects stay on our server (Supabase Storage) by default. To serve (and,
 * with the hosting/purge jobs, store) files from Cloudflare R2 later, set
 * env only — no R2 resources are created here.
 *
 *   MEDIA_STORAGE_BACKEND=supabase|r2          (default: supabase)
 *   MEDIA_PUBLIC_BASE_URL=https://media.example.com
 *
 * NEXT_PUBLIC_* aliases are also read so client bundles can build URLs if needed.
 * When MEDIA_PUBLIC_BASE_URL is unset, URLs stay
 * {NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/{bucket}/{key}.
 */

export type MediaStorageBackend = "supabase" | "r2";

const DEFAULT_BUCKET = "creator-videos";

function env(name: string, fallback = ""): string {
  const value = (process.env[name] || "").trim();
  return value || fallback;
}

export function mediaStorageBackend(): MediaStorageBackend {
  const raw = (
    env("MEDIA_STORAGE_BACKEND") ||
    env("NEXT_PUBLIC_MEDIA_STORAGE_BACKEND") ||
    "supabase"
  ).toLowerCase();
  return raw === "r2" ? "r2" : "supabase";
}

export function mediaBucket(): string {
  return env("R2_BUCKET") || env("MEDIA_BUCKET") || DEFAULT_BUCKET;
}

/**
 * Public prefix for object keys (no trailing slash). The object path is
 * appended as `base + "/" + key`. For R2 this is typically a custom domain
 * bound to the bucket.
 */
export function mediaPublicBaseUrl(): string | null {
  const explicit = (
    env("MEDIA_PUBLIC_BASE_URL") || env("NEXT_PUBLIC_MEDIA_PUBLIC_BASE_URL")
  ).replace(/\/+$/, "");
  if (explicit) return explicit;
  const supabase = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  if (!supabase) return null;
  return `${supabase}/storage/v1/object/public/${mediaBucket()}`;
}

/** Absolute public URL for a stored object key such as creators/<id>/.../video.mp4 */
export function publicMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = mediaPublicBaseUrl();
  if (!base) return null;
  return `${base}/${String(path).replace(/^\/+/, "")}`;
}

/** Hostname/pathname for Next.js image remotePatterns when a custom base is set. */
export function mediaPublicRemotePattern(): {
  protocol: "http" | "https";
  hostname: string;
  port?: string;
  pathname: string;
} | null {
  const base = mediaPublicBaseUrl();
  if (!base) return null;
  try {
    const parsed = new URL(base);
    const protocol = parsed.protocol.replace(/:$/, "");
    if (protocol !== "http" && protocol !== "https") return null;
    if (!parsed.hostname) return null;
    let pathname = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname.replace(/\/+$/, "") : "";
    pathname = `${pathname}/**` || "/**";
    return {
      protocol,
      hostname: parsed.hostname,
      ...(parsed.port ? { port: parsed.port } : {}),
      pathname,
    };
  } catch {
    return null;
  }
}
