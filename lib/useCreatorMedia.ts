"use client";

import { useEffect, useState } from "react";
import { hostedMediaByNormalizedUrl, type HostedMedia } from "@/lib/creatorMedia";

export { lookupHostedMedia } from "@/lib/creatorMedia";

export function useHostedCreatorMedia(influencerId: string | null | undefined) {
  const [map, setMap] = useState<Map<string, HostedMedia>>(() => new Map());

  useEffect(() => {
    const id = String(influencerId || "").trim();
    if (!id) {
      setMap(new Map());
      return;
    }
    let cancelled = false;
    fetch(`/api/creator-media?influencerId=${encodeURIComponent(id)}`)
      .then((res) => (res.ok ? res.json() : { media: [] }))
      .then((data: { media?: HostedMedia[] }) => {
        if (cancelled) return;
        setMap(hostedMediaByNormalizedUrl(Array.isArray(data.media) ? data.media : []));
      })
      .catch(() => {
        if (!cancelled) setMap(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [influencerId]);

  return map;
}

