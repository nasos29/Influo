"use client";

import { useEffect, useMemo, useState } from "react";
import {
  portfolioLinkSourceKey,
  portfolioLinkUiPhase,
  type PortfolioLinkJob,
  type PortfolioLinkUiPhase,
} from "@/lib/portfolioHosted";
import { normalizeSourceUrl } from "@/lib/creatorMedia";
import { sessionFetch } from "@/lib/sessionFetch";

type StatusResponse = { links?: PortfolioLinkJob[] };

export function usePortfolioLinkStatus(influencerId: string | null | undefined, portfolioUrls: string[]) {
  const [jobs, setJobs] = useState<PortfolioLinkJob[]>([]);

  const watchKeys = useMemo(() => {
    const keys = portfolioUrls.map((u) => portfolioLinkSourceKey(u)).filter(Boolean);
    return keys.sort().join("|");
  }, [portfolioUrls]);

  useEffect(() => {
    if (!influencerId) {
      setJobs([]);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const pull = async () => {
      const res = await sessionFetch(
        `/api/portfolio-media/uploads?influencerId=${encodeURIComponent(influencerId)}`,
        { cache: "no-store" }
      ).catch(() => null);
      if (!res?.ok || cancelled) return;
      const data = (await res.json().catch(() => ({}))) as StatusResponse;
      setJobs(Array.isArray(data.links) ? data.links : []);
    };

    void pull();
    timer = setInterval(() => void pull(), 12_000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [influencerId, watchKeys]);

  const byKey = useMemo(() => {
    const map = new Map<string, PortfolioLinkJob>();
    for (const job of jobs) map.set(job.sourceKey, job);
    return map;
  }, [jobs]);

  const hostedByNorm = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const job of jobs) {
      if (job.mediaReady) map.set(normalizeSourceUrl(job.sourceUrl), true);
    }
    return map;
  }, [jobs]);

  const phaseForUrl = (url: string): PortfolioLinkUiPhase =>
    portfolioLinkUiPhase(url, byKey.get(portfolioLinkSourceKey(url)), hostedByNorm);

  const anyPending = portfolioUrls.some((u) => phaseForUrl(u) === "pending");

  return { phaseForUrl, anyPending, jobs };
}