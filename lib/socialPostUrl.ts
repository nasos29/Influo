import { isAllowedTopPostUrl } from "@/lib/topPosts";
import { detectProvider, isEmbeddableVideoUrl } from "@/lib/videoThumbnail";

export type SocialPostProvider = "instagram" | "tiktok" | "youtube";

/** Normalize and validate a published IG / TikTok / YouTube post URL. */
export function parseSocialPostUrl(raw: unknown): {
  ok: true;
  url: string;
  provider: SocialPostProvider;
} | { ok: false; error: "empty" | "invalid" } {
  const url = typeof raw === "string" ? raw.trim() : "";
  if (!url) return { ok: false, error: "empty" };
  if (!isAllowedTopPostUrl(url)) return { ok: false, error: "invalid" };
  const provider = detectProvider(url);
  if (!provider) return { ok: false, error: "invalid" };
  if (!isEmbeddableVideoUrl(url)) return { ok: false, error: "invalid" };
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return { ok: true, url: parsed.toString(), provider };
  } catch {
    return { ok: false, error: "invalid" };
  }
}

export function socialPostUrlErrorMessage(
  error: "empty" | "invalid",
  lang: "el" | "en" = "el"
): string {
  if (error === "empty") {
    return lang === "el" ? "Βάλε link δημοσίευσης (URL)." : "Add a published post URL.";
  }
  return lang === "el"
    ? "Δώσε link δημοσιευμένου post (reel / post / video) — όχι προφίλ. Επιτρέπονται Instagram, TikTok και YouTube (https)."
    : "Use a published post URL (reel / post / video) — not a profile. Instagram, TikTok, and YouTube only (https).";
}

/** Optional non-negative integer for self-reported views/reach. */
export function parseSelfReportedCount(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim().replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(Math.round(n), 1_000_000_000_000);
}