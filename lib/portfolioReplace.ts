import { extractTikTokVideoId } from "./tikTokPlayer";

export function normalizeMediaUrl(url: string): string {
  return String(url || "").trim().replace(/\/+$/, "");
}

/** True when both URLs are the same TikTok item (by video id) or the same normalized URL. */
export function samePortfolioMediaUrl(a: string, b: string): boolean {
  const idA = extractTikTokVideoId(a);
  const idB = extractTikTokVideoId(b);
  if (idA && idB) return idA === idB;
  return normalizeMediaUrl(a).toLowerCase() === normalizeMediaUrl(b).toLowerCase();
}

/**
 * First candidate not already in the visible list and not the failed item.
 * Used to swap a portfolio TikTok that the official embed player rejects.
 */
export function pickReplacementPortfolioVideo(
  failedUrl: string,
  currentlyShown: string[],
  candidates: string[]
): string | null {
  const failed = String(failedUrl || "").trim();
  const shown = currentlyShown
    .map((u) => String(u || "").trim())
    .filter((u) => u && !samePortfolioMediaUrl(u, failed));
  for (const raw of candidates) {
    const candidate = String(raw || "").trim();
    if (!candidate) continue;
    if (samePortfolioMediaUrl(candidate, failed)) continue;
    if (shown.some((u) => samePortfolioMediaUrl(u, candidate))) continue;
    return candidate;
  }
  return null;
}