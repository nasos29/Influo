"use client";

import { useEffect, useState } from "react";
import { hostedMediaByNormalizedUrl, type HostedMedia } from "@/lib/creatorMedia";

export { lookupHostedMedia } from "@/lib/creatorMedia";

export function useHostedCreatorMedia(
  influencerId: string | null | undefined,
  opts?: { pollMs?: number }
) {
  const [map, setMap] = useState<Map<string, HostedMedia>>(() => new Map());
  const pollMs = opts?.pollMs && opts.pollMs > 0 ? opts.pollMs : 0;

  useEffect(() => {
    const id = String(influencerId || "").trim();
    if (!id) {
      setMap(new Map());
      return;
    }
    let cancelled = false;
    const pull = () =>
      fetch(`/api/creator-media?influencerId=${encodeURIComponent(id)}`)
        .then((res) => (res.ok ? res.json() : { media: [] }))
        .then((data: { media?: HostedMedia[] }) => {
          if (cancelled) return;
          setMap(hostedMediaByNormalizedUrl(Array.isArray(data.media) ? data.media : []));
        })
        .catch(() => {
          if (!cancelled) setMap(new Map());
        });
    void pull();
    const timer = pollMs > 0 ? setInterval(() => void pull(), pollMs) : undefined;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [influencerId, pollMs]);

  return map;
}

