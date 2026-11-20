"use client";

import {
  PORTFOLIO_LINK_STATUS_COPY,
  portfolioLinkSourceKey,
  portfolioLinkUiPhase,
  type PortfolioLinkJob,
  type PortfolioLinkUiPhase,
} from "@/lib/portfolioHosted";
import { normalizeSourceUrl } from "@/lib/creatorMedia";

type Lang = "el" | "en";

type Props = {
  url: string;
  lang?: Lang;
  jobs: PortfolioLinkJob[];
};

function phaseFor(url: string, jobs: PortfolioLinkJob[]): PortfolioLinkUiPhase {
  const byKey = new Map(jobs.map((j) => [j.sourceKey, j]));
  const hostedByNorm = new Map<string, boolean>();
  for (const job of jobs) {
    if (job.mediaReady) hostedByNorm.set(normalizeSourceUrl(job.sourceUrl), true);
  }
  return portfolioLinkUiPhase(url, byKey.get(portfolioLinkSourceKey(url)), hostedByNorm);
}

export default function PortfolioLinkHostingStatus({ url, lang = "el", jobs }: Props) {
  const uiLang = lang === "en" ? "en" : "el";
  const phase = phaseFor(url, jobs);
  if (phase === "none") return null;

  const copy =
    phase === "ready"
      ? PORTFOLIO_LINK_STATUS_COPY.ready
      : phase === "failed"
        ? PORTFOLIO_LINK_STATUS_COPY.failed
        : PORTFOLIO_LINK_STATUS_COPY.pending;

  const className =
    phase === "failed"
      ? "mt-1 text-xs text-amber-800"
      : phase === "ready"
        ? "mt-1 text-xs text-emerald-700"
        : "mt-1 text-xs text-slate-500";

  return <p className={className}>{copy[uiLang]}</p>;
}