"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { portfolioLinkSourceKey, portfolioLinkUiPhase, type PortfolioLinkUiPhase } from "@/lib/portfolioHosted";

type PhaseRow = { sourceKey: string; phase: PortfolioLinkUiPhase };

export function usePublicPortfolioLinkPhases(
  influencerId: string | null | undefined,
  portfolioUrls: string[],
  opts?: { pollMs?: number }
) {
  const [rows, setRows] = useState<PhaseRow[]>([]);
  const pollMs = opts?.pollMs && opts.pollMs > 0 ? opts.pollMs : 0;
  const urlsRef = useRef(portfolioUrls);
  urlsRef.current = portfolioUrls;

  const watchKey = useMemo(
    () => portfolioUrls.map((u) => portfolioLinkSourceKey(u)).filter(Boolean).sort().join("|"),
    [portfolioUrls]
  );

  useEffect(() => {
    const id = String(influencerId || "").trim();
    if (!id || !watchKey) {
      setRows((r) => (r.length ? [] : r));
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({ influencerId: id });
    for (const url of urlsRef.current) {
      const u = String(url || "").trim();
      if (u) params.append("u", u);
    }

    const pull = () =>
      fetch(`/api/creator-media/link-phases?${params.toString()}`, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : { phases: [] }))
        .then((data: { phases?: PhaseRow[] }) => {
          if (!cancelled) setRows(Array.isArray(data.phases) ? data.phases : []);
        })
        .catch(() => {
          if (!cancelled) setRows([]);
        });

    void pull();
    const timer = pollMs > 0 ? setInterval(() => void pull(), pollMs) : undefined;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [influencerId, watchKey, pollMs]);

  const byKey = useMemo(() => {
    const map = new Map<string, PortfolioLinkUiPhase>();
    for (const row of rows) map.set(row.sourceKey, row.phase);
    return map;
  }, [rows]);

  const phaseForUrl = (url: string): PortfolioLinkUiPhase =>
    portfolioLinkUiPhase(url, undefined, new Map());

  return {
    phaseForUrl: (url: string): PortfolioLinkUiPhase => {
      const key = portfolioLinkSourceKey(url);
      const phase = byKey.get(key);
      if (phase) return phase;
      return phaseForUrl(url);
    },
  };
}
