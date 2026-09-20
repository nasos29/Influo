"use client";

import { useEffect, useMemo, useState } from "react";
import { buildPlatformMix } from "@/lib/platformMix";
import { BUCKET_LABELS, type CatalogBenchmark } from "@/lib/catalogBenchmark";

type Props = {
  lang: "el" | "en";
  influencerId: string;
  followers: { [key: string]: number | undefined };
  engagementRate?: string | { [key: string]: string } | null;
  avgLikes?: string | { [key: string]: string } | number | null;
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return Math.round(n).toLocaleString();
}

export default function StatsInsightsPanel({
  lang,
  influencerId,
  followers,
  engagementRate,
  avgLikes,
}: Props) {
  const el = lang === "el";
  const mix = useMemo(
    () => buildPlatformMix(followers, engagementRate, avgLikes),
    [followers, engagementRate, avgLikes]
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
  const compareEr =
    bench && bench.peerCount >= 5 ? bench.peerAvgEr : bench?.catalogAvgEr ?? null;
  const compareLabel =
    bench && bench.peerCount >= 5
      ? el
        ? `${bench.peerCount} creators ${bucket?.range} στο Influo`
        : `${bench.peerCount} creators ${bucket?.range} on Influo`
      : bench
        ? el
          ? `${bench.catalogCount} creators στον κατάλογο`
          : `${bench.catalogCount} creators in the catalog`
        : "";
  const maxEr = Math.max(bench?.thisEr || 0, compareEr || 0, 1);

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <h3 className="text-lg font-bold text-slate-900">
          {el ? "Mix πλατφορμών" : "Platform mix"}
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          {el ? "Πού είναι το κοινό, με ER και μέσο likes." : "Where the audience is, with ER and avg likes."}
        </p>
        {mix.length === 0 ? (
          <p className="text-sm text-slate-400 mt-6">{el ? "Δεν υπάρχουν followers ανά πλατφόρμα." : "No per-platform followers yet."}</p>
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
                  <span>{el ? "Μ.Ο. likes" : "Avg likes"} {row.likes != null ? fmt(row.likes) : "—"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <h3 className="text-lg font-bold text-slate-900">
          {el ? "Σύγκριση καταλόγου" : "Catalog comparison"}
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          {el
            ? "Engagement rate απέναντι σε creators ίδιου μεγέθους στο Influo."
            : "Engagement rate versus same-size creators on Influo."}
        </p>
        {!bench || bench.thisEr == null ? (
          <p className="text-sm text-slate-400 mt-6">
            {el ? "Χρειάζεται engagement rate για τη σύγκριση." : "Engagement rate is needed for comparison."}
          </p>
        ) : (
          <div className="mt-5">
            <div className="flex items-end gap-3">
              <div className="text-4xl font-extrabold text-slate-900 tabular-nums">{bench.thisEr.toFixed(1)}%</div>
              {bench.delta != null && (
                <div
                  className={`mb-1 text-sm font-semibold ${
                    bench.delta > 0 ? "text-emerald-600" : bench.delta < 0 ? "text-amber-600" : "text-slate-500"
                  }`}
                >
                  {bench.delta > 0 ? "+" : ""}
                  {bench.delta.toFixed(1)}pp {el ? "vs μέσο όρο" : "vs average"}
                </div>
              )}
            </div>
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
                  <span>{el ? "Μέσος όρος" : "Catalog average"}</span>
                  <span>{compareEr != null ? `${compareEr.toFixed(1)}%` : "—"}</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-slate-400"
                    style={{ width: `${compareEr != null ? Math.min(100, (compareEr / maxEr) * 100) : 0}%` }}
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
