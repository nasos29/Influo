/** Resolve YouTube watch/shorts/live/embed/m./youtu.be → 11-char video id. */
export function resolveYouTubeVideoId(url: string): string | null {
  const clean = String(url || "").trim();
  if (!clean) return null;
  const patterns = [
    /(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i,
    /[?&]v=([A-Za-z0-9_-]{11})/i,
  ];
  for (const re of patterns) {
    const m = clean.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}
