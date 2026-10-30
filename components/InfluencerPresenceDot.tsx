"use client";

import { useEffect, useState } from "react";
import { formatActiveLabel, presenceOnline } from "@/lib/presenceStatus";
import { getInfluencerPresenceCached } from "@/lib/presenceCache";

/**
 * Shared presence cache + slow poll (no per-dot postgres_changes).
 * Interval 2 minutes; skips while the tab is hidden.
 */
export default function InfluencerPresenceDot({
  influencerId,
  lang = "el",
  className = "",
}: {
  influencerId: string;
  lang?: "el" | "en";
  className?: string;
}) {
  const [online, setOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  useEffect(() => {
    if (!influencerId) return;
    let cancelled = false;

    const check = async () => {
      if (document.hidden) return;
      const row = await getInfluencerPresenceCached(influencerId);
      if (cancelled) return;
      if (!row) {
        setOnline(false);
        setLastSeen(null);
        return;
      }
      setLastSeen(row.last_seen || null);
      setOnline(presenceOnline(row));
    };

    void check();
    const interval = setInterval(() => {
      if (document.hidden) return;
      void check();
    }, 120_000);

    const onVisibility = () => {
      if (!document.hidden) void check();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [influencerId]);

  const title = formatActiveLabel(lastSeen, online, lang);

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      title={title}
      aria-label={title}
    >
      <span
        className={`inline-block w-2 h-2 rounded-full shrink-0 ${
          online ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
        }`}
      />
    </span>
  );
}
