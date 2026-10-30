/**
 * Client helper: call /api/check-video for a portfolio URL.
 */

export type ClientVideoCheck = {
  playable: boolean;
  reason?: string;
  checking?: boolean;
};

export async function fetchCheckVideo(url: string): Promise<ClientVideoCheck> {
  const trimmed = String(url || "").trim();
  if (!trimmed) return { playable: true, reason: "empty" };
  try {
    const res = await fetch(`/api/check-video?url=${encodeURIComponent(trimmed)}`);
    if (res.status === 429) {
      // Rate limited — do not block the user.
      return { playable: true, reason: "unchecked" };
    }
    if (!res.ok) {
      return { playable: true, reason: "unchecked" };
    }
    const data = (await res.json()) as { playable?: boolean; reason?: string };
    return {
      playable: data.playable !== false,
      reason: data.reason,
    };
  } catch {
    return { playable: true, reason: "unchecked" };
  }
}
