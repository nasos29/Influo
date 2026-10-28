"use client";

import { useEffect, useMemo, useState } from "react";
import InfoTooltip from "@/components/InfoTooltip";
import { buildPlatformMix } from "@/lib/platformMix";
import { BUCKET_LABELS, type CatalogBenchmark } from "@/lib/catalogBenchmark";

type Props = {
  lang: "el" | "en";
  influencerId: string;
  followers: { [key: string]: number | undefined };
  engagementRate?: string | { [key: string]: string } | null;
  avgLikes?: string | { [key: string]: string } | number | null;
  accounts?: Array<{ platform?: string | null; avg_views?: string | number | null }> | null;
};

const TIP_ARIA = { el: "Τι σημαίνει", en: "What this means" } as const;

const INSIGHT_HINTS = {
  platformMix: {
    el: "Πού είναι το κοινό, με ER, μέσο likes και προβολές.",
    en: "Where the audience is, with ER, avg likes and views.",
  },
  catalogCompare: {
    el: "Engagement rate απέναντι σε creators ίδιου μεγέθους στο Influo.",
    en: "Engagement rate versus same-size creators on Influo.",
  },
} as const;

const INSIGHT_TITLES = {
  platformMix: { el: "Mix πλατφορμών", en: "Platform mix" },
  catalogCompare: { el: "Σύγκριση καταλόγου", en: "Catalog comparison" },
} as const;

const INSIGHT_COPY = {
  wholeCatalog: {
    el: "σε όλο τον κατάλογο (όλα τα μεγέθη)",
    en: "whole catalog (all sizes)",
  },
  percentile: {
    el: (x: number, bucket: string) => `Καλύτερο από το ${x}% των ${bucket} creators`,
    en: (x: number, bucket: string) => `Better than ${x}% of ${bucket} creators`,
  },
  erFlagged: {
    el: "Ακραίο ER – υπό έλεγχο",
    en: "Unusual ER – under review",
  },
  avgViews: { el: "Μ.Ο. προβολές", en: "Avg views" },
  avgLikes: { el: "Μ.Ο. likes", en: "Avg likes" },
  vsMedian: { el: "vs διάμεσο", en: "vs median" },
  medianLabel: { el: "Διάμεσος", en: "Catalog median" },
} as const;

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return Math.round(n).toLocaleString();
}

function deltaToneClass(delta: number): string {
  if (delta > 0) return "text-emerald-600";
  if (delta < 0) return "text-amber-600";
  return "text-slate-500";
}

export default function StatsInsightsPanel({
  lang,
  influencerId,
  followers,
  engagementRate,
  avgLikes,
  accounts,
}: Props) {
  const el = lang === "el";
  const mix = useMemo(
    () => buildPlatformMix(followers, engagementRate, avgLikes, accounts),
    [followers, engagementRate, avgLikes, accounts]
  );
  const [bench, setBench] = useState<CatalogBenchmark | null>(null);

  useEffect(() => {
    if (!influencerId) return;
    fetch(`/api/influencer/${influencerId}/catalog-benchmark`)
      .then((r) => r.json())
      .then((data: CatalogBenchmark) => {
        if (data && typeof data.bucket === "string") setBench(data);
        else setBench(null);
      })
      .catch(() => setBench(null));
  }, [influencerId]);

  const bucket = bench ? BUCKET_LABELS[bench.bucket] : null;
  let compareEr: number | null = null;
  if (bench) {
    compareEr = bench.peerCount >= 5 ? bench.peerAvgEr : bench.catalogAvgEr;
  }
  let compareLabel = "";
  if (bench && bench.peerCount >= 5) {
    compareLabel = el
      ? `${bench.peerCount} creators ${bucket?.range} στο Influo`
      : `${bench.peerCount} creators ${bucket?.range} on Influo`;
  } else if (bench) {
    compareLabel = INSIGHT_COPY.wholeCatalog[lang];
  }
  const maxEr = Math.max(bench?.thisEr || 0, compareEr || 0, 1);
  const bucketWord = bucket ? bucket[lang] : "creators";

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <h3 className="flex items-start gap-1 text-lg font-bold text-slate-900">
          <span className="leading-tight break-words">{INSIGHT_TITLES.platformMix[lang]}</span>
          <span className="mt-1 shrink-0">
            <InfoTooltip text={INSIGHT_HINTS.platformMix[lang]} ariaLabel={TIP_ARIA[lang]} />
          </span>
        </h3>
        {mix.length === 0 ? (
          <p className="text-sm text-slate-400 mt-6">
            {el ? "Δεν υπάρχουν followers ανά πλατφόρμα." : "No per-platform followers yet."}
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {mix.map((row) => (
              <div key={row.key}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-slate-800">{row.label[lang]}</span>
                  <span className="text-slate-500 tabular-nums">
                    {fmt(row.followers)} · {row.pct}%
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, row.pct)}%`, backgroundColor: row.color }}
                  />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>ER {row.er != null ? `${row.er.toFixed(1)}%` : "—"}</span>
                  <span>
                    {INSIGHT_COPY.avgLikes[lang]} {row.likes != null ? fmt(row.likes) : "—"}
                  </span>
                  {row.avgViews != null ? (
                    <span>
                      {INSIGHT_COPY.avgViews[lang]} {fmt(row.avgViews)}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <h3 className="flex items-start gap-1 text-lg font-bold text-slate-900">
          <span className="leading-tight break-words">{INSIGHT_TITLES.catalogCompare[lang]}</span>
          <span className="mt-1 shrink-0">
            <InfoTooltip text={INSIGHT_HINTS.catalogCompare[lang]} ariaLabel={TIP_ARIA[lang]} />
          </span>
        </h3>
        {!bench || bench.thisEr == null ? (
          <p className="text-sm text-slate-400 mt-6">
            {el ? "Χρειάζεται engagement rate για τη σύγκριση." : "Engagement rate is needed for comparison."}
          </p>
        ) : (
          <div className="mt-5">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="text-4xl font-extrabold text-slate-900 tabular-nums">
                {bench.thisEr.toFixed(1)}%
              </div>
              {bench.thisErFlagged ? (
                <div className="mb-1 inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                  {INSIGHT_COPY.erFlagged[lang]}
                </div>
              ) : null}
              {!bench.thisErFlagged && bench.delta != null ? (
                <div
                  className={`mb-1 text-sm font-semibold ${
                    deltaToneClass(bench.delta)
                  }`}
                >
                  {bench.delta > 0 ? "+" : ""}
                  {bench.delta.toFixed(1)}pp {INSIGHT_COPY.vsMedian[lang]}
                </div>
              ) : null}
            </div>
            {!bench.thisErFlagged && bench.percentile != null ? (
              <p className="mt-2 text-sm font-medium text-slate-700">
                {INSIGHT_COPY.percentile[lang](bench.percentile, bucketWord)}
              </p>
            ) : null}
            {bucket && (
              <p className="text-xs text-slate-500 mt-1">
                {bucket[lang]} {bucket.range} · {compareLabel}
              </p>
            )}

            <div className="mt-6 space-y-3">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                  <span>{el ? "Αυτό το προφίλ" : "This profile"}</span>
                  <span>{bench.thisEr.toFixed(1)}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${Math.min(100, (bench.thisEr / maxEr) * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                  <span>{INSIGHT_COPY.medianLabel[lang]}</span>
                  <span>{compareEr != null ? `${compareEr.toFixed(1)}%` : "—"}</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-slate-400"
                    style={{
                      width: `${compareEr != null ? Math.min(100, (compareEr / maxEr) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
