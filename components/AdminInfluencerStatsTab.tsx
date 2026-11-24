"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FollowerGrowthChart from "@/components/FollowerGrowthChart";
import DmyDateField from "@/components/DmyDateField";
import { formatEuro } from "@/lib/formatEuro";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/formatDate";
import { type FollowerGrowthPoint } from "@/lib/followerGrowth";
import { supabase } from "@/lib/supabaseClient";

interface InfluencerStatsPayload {
  period: { start: string | null; end: string | null };
  analytics: {
    profileViews: number;
    profileClicksInfluo: number;
    socialOutboundClicks: number;
    socialOutboundByPlatform: Record<string, number>;
    daily: { date: string; views: number; clicks: number }[];
  };
  proposals: {
    total: number;
    byStatus: Record<string, number>;
    collaborations: number;
    earnings: number;
  };
  applications: { total: number; byStatus: Record<string, number> };
  messages: { total: number };
  reviews: { count: number; avgRating: number | null };
  growth: {
    currentTotal: number;
    growth: number | null;
    growthPct: number | null;
    series: FollowerGrowthPoint[];
  };
  platformAccounts: {
    platform: string;
    followers: number;
    engagement_rate: string;
    avg_likes: string;
  }[];
  recentEvents: { id?: string; event_type: string; created_at: string; metadata?: unknown }[];
}

const tr = {
  el: {
    title: "Στατιστικά ανά influencer",
    subtitle:
      "Προβολές/κλικ από analytics, πραγματικές προτάσεις, αιτήσεις καμπανιών, μηνύματα, έσοδα, αξιολογήσεις και ακολουθοί ανά πλατφόρμα.",
    pick: "Επιλογή influencer",
    search: "Αναζήτηση ονόματος…",
    period: "Περίοδος",
    last7: "7 ημέρες",
    last30: "30 ημέρες",
    quarter: "Τρίμηνο",
    year: "Έτος",
    all: "Όλο το διάστημα",
    custom: "Προσαρμοσμένο",
    from: "Από",
    to: "Έως",
    refresh: "Ανανέωση",
    loading: "Φόρτωση…",
    noInfluencers: "Δεν υπάρχουν influencers.",
    noSelection: "Επίλεξε influencer για να δεις στατιστικά.",
    loadError: "Δεν φορτώθηκαν τα στατιστικά.",
    profileViews: "Προβολές προφίλ",
    profileClicks: "Κλικ προφίλ Influo",
    socialOutbound: "Έξοδος προς κοινωνικά",
    applications: "Αιτήσεις καμπανιών",
    proposals: "Προτάσεις",
    collaborations: "Συνεργασίες (αποδ./ολοκλ.)",
    messages: "Μηνύματα",
    earnings: "Έσοδα (αποδεκτές/ολοκληρωμένες)",
    reviews: "Αξιολογήσεις",
    reviewsAvg: "Μέσος βαθμός",
    outboundPlatforms: "Έξοδος ανά πλατφόρμα (κλικ)",
    dailyChart: "Ημερήσιες προβολές & κλικ Influo",
    chartViews: "Προβολές",
    chartClicks: "Κλικ Influo",
    recent: "Πρόσφατα events (analytics)",
    colType: "Τύπος",
    colTime: "Ώρα",
    colMeta: "Σημείωση",
    platformAccounts: "Λογαριασμοί (τρέχον προφίλ)",
    followers: "Followers",
    er: "ER",
    avgLikes: "Μ. likes",
    ctr: "CTR κλικ/προβολή",
    growthTitle: "Ακόλουθοι (εκτίμηση)",
    growthCurrent: "Τρέχον σύνολο",
    growth15d: "Μεταβολή 15 ημ.",
    growthNA: "Δεν υπάρχει ιστορικό snapshots",
    noDaily: "Δεν υπάρχουν ημερήσιες τιμές για αυτή την περίοδο.",
  },
  en: {
    title: "Per-influencer analytics",
    subtitle:
      "Analytics views/clicks, real proposals, campaign applications, messages, earnings, reviews, and per-platform followers.",
    pick: "Select influencer",
    search: "Search by name…",
    period: "Period",
    last7: "Last 7 days",
    last30: "Last 30 days",
    quarter: "Last quarter",
    year: "Last year",
    all: "All time",
    custom: "Custom",
    from: "From",
    to: "To",
    refresh: "Refresh",
    loading: "Loading…",
    noInfluencers: "No influencers loaded.",
    noSelection: "Pick an influencer to see stats.",
    loadError: "Could not load statistics.",
    profileViews: "Profile views",
    profileClicks: "Influo profile clicks",
    socialOutbound: "Outbound to social",
    applications: "Campaign applications",
    proposals: "Proposals",
    collaborations: "Collaborations (acc./completed)",
    messages: "Messages",
    earnings: "Earnings (accepted/completed)",
    reviews: "Reviews",
    reviewsAvg: "Avg. rating",
    outboundPlatforms: "Outbound clicks by platform",
    dailyChart: "Daily views & Influo clicks",
    chartViews: "Views",
    chartClicks: "Influo clicks",
    recent: "Recent analytics events",
    colType: "Type",
    colTime: "Time",
    colMeta: "Note",
    platformAccounts: "Accounts (current profile)",
    followers: "Followers",
    er: "ER",
    avgLikes: "Avg. likes",
    ctr: "Click-through (clicks/views)",
    growthTitle: "Followers (estimate)",
    growthCurrent: "Current total",
    growth15d: "15-day change",
    growthNA: "No snapshot history",
    noDaily: "No daily values for this period.",
  },
};

async function adminAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

function eventLabel(type: string, lang: "el" | "en"): string {
  const el: Record<string, string> = {
    profile_view: "Προβολή προφίλ",
    profile_click: "Κλικ προφίλ",
    proposal_sent: "Πρόταση (event)",
    message_sent: "Μήνυμα (event)",
    conversation_started: "Συνομιλία (event)",
  };
  const en: Record<string, string> = {
    profile_view: "Profile view",
    profile_click: "Profile click",
    proposal_sent: "Proposal (event)",
    message_sent: "Message (event)",
    conversation_started: "Conversation (event)",
  };
  return (lang === "el" ? el : en)[type] || type;
}

function pct(n: number, d: number): string {
  if (d <= 0) return "0%";
  return `${Math.min(100, Math.round((n / d) * 1000) / 10)}%`;
}

function DailyVolumeChart({
  lang,
  daily,
  viewsLabel,
  clicksLabel,
}: {
  lang: "el" | "en";
  daily: { date: string; views: number; clicks: number }[];
  viewsLabel: string;
  clicksLabel: string;
}) {
  const maxVal = Math.max(1, ...daily.map((d) => Math.max(d.views, d.clicks)));
  const barMaxPx = 120;

  if (!daily.length) {
    return <p className="text-sm text-slate-500">{tr[lang].noDaily}</p>;
  }

  return (
    <div>
      <div className="flex items-end gap-1 overflow-x-auto pb-2 min-h-[140px]">
        {daily.map((d) => {
          const vH = (d.views / maxVal) * barMaxPx;
          const cH = (d.clicks / maxVal) * barMaxPx;
          return (
            <div key={d.date} className="flex flex-col items-center shrink-0 w-7" title={`${formatDisplayDate(d.date)}`}>
              <div className="flex items-end justify-center gap-0.5 h-[124px] w-full">
                <div
                  className="w-2.5 bg-blue-500 rounded-t-sm min-h-[2px]"
                  style={{ height: `${Math.max(d.views > 0 ? 2 : 0, vH)}px` }}
                  title={`${viewsLabel}: ${d.views}`}
                />
                <div
                  className="w-2.5 bg-violet-500 rounded-t-sm min-h-[2px]"
                  style={{ height: `${Math.max(d.clicks > 0 ? 2 : 0, cH)}px` }}
                  title={`${clicksLabel}: ${d.clicks}`}
                />
              </div>
              <span className="text-[9px] text-slate-400 mt-1 rotate-[-45deg] origin-top-left whitespace-nowrap max-w-[48px] overflow-hidden">
                {formatDisplayDate(d.date).replace(/\//g, "/")}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 text-[11px] text-slate-600 mt-2">
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />
          {viewsLabel}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-violet-500 rounded-sm" />
          {clicksLabel}
        </span>
      </div>
    </div>
  );
}

export default function AdminInfluencerStatsTab({
  influencers,
  lang,
}: {
  influencers: { id: string | number; display_name: string; contact_email?: string | null }[];
  lang: "el" | "en";
}) {
  const txt = tr[lang];
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [period, setPeriod] = useState<"7d" | "30d" | "quarter" | "year" | "all" | "custom">("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [payload, setPayload] = useState<InfluencerStatsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const uniqueInfluencers = useMemo(() => {
    const seen = new Set<string>();
    const deduped: typeof influencers = [];
    for (const u of influencers) {
      const id = String(u.id);
      if (seen.has(id)) continue;
      seen.add(id);
      deduped.push(u);
    }

    const nameKey = (u: (typeof influencers)[number]) => (u.display_name || "").trim().toLowerCase();
    const nameCounts = new Map<string, number>();
    for (const u of deduped) nameCounts.set(nameKey(u), (nameCounts.get(nameKey(u)) ?? 0) + 1);

    const nameEmailCounts = new Map<string, number>();
    for (const u of deduped) {
      const k = `${nameKey(u)}|${(u.contact_email || "").trim().toLowerCase()}`;
      nameEmailCounts.set(k, (nameEmailCounts.get(k) ?? 0) + 1);
    }

    const out = deduped.map((u) => {
      const base = (u.display_name || "").trim() || String(u.id);
      if ((nameCounts.get(nameKey(u)) ?? 0) < 2) return { ...u, label: base };
      const email = (u.contact_email || "").trim();
      const shortId = String(u.id).slice(0, 8);
      const emailUnique =
        !!email && (nameEmailCounts.get(`${nameKey(u)}|${email.toLowerCase()}`) ?? 0) < 2;
      const suffix = emailUnique ? email : email ? `${email} · #${shortId}` : `#${shortId}`;
      return { ...u, label: `${base} (${suffix})` };
    });

    out.sort((a, b) => a.label.localeCompare(b.label, "el", { sensitivity: "base" }));
    return out;
  }, [influencers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return uniqueInfluencers;
    return uniqueInfluencers.filter((u) => u.label.toLowerCase().includes(q));
  }, [uniqueInfluencers, query]);

  useEffect(() => {
    if (!selectedId && filtered.length > 0) {
      setSelectedId(String(filtered[0].id));
    }
  }, [filtered, selectedId]);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!selectedId) return;
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ id: selectedId });
      const endIso = new Date().toISOString();

      if (period === "all") {
        params.set("range", "all");
      } else if (period === "custom") {
        if (customStart) params.set("start", new Date(customStart).toISOString());
        if (customEnd) params.set("end", new Date(customEnd).toISOString());
        else params.set("end", endIso);
      } else {
        const d = new Date();
        if (period === "7d") d.setDate(d.getDate() - 7);
        else if (period === "30d") d.setDate(d.getDate() - 30);
        else if (period === "quarter") d.setMonth(d.getMonth() - 3);
        else if (period === "year") d.setFullYear(d.getFullYear() - 1);
        params.set("start", d.toISOString());
        params.set("end", endIso);
      }

      const res = await fetch(`/api/admin/stats/influencer?${params.toString()}`, {
        headers: await adminAuthHeaders(),
        signal,
      });
      if (signal?.aborted) return;
      if (!res.ok) {
        setPayload(null);
        setError(true);
        return;
      }
      const data = (await res.json()) as InfluencerStatsPayload;
      if (signal?.aborted) return;
      setPayload(data);
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
      setPayload(null);
      setError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [selectedId, period, customStart, customEnd]);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const views = payload?.analytics.profileViews ?? 0;
  const clicks = payload?.analytics.profileClicksInfluo ?? 0;
  const outbound = payload?.analytics.socialOutboundClicks ?? 0;
  const growth = payload?.growth;

  const maxFollowers = useMemo(() => {
    const list = payload?.platformAccounts ?? [];
    return Math.max(1, ...list.map((a) => a.followers));
  }, [payload?.platformAccounts]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{txt.title}</h2>
        <p className="text-sm text-slate-600 mt-1 max-w-3xl">{txt.subtitle}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-semibold text-slate-700 mb-1">{txt.pick}</label>
          <input
            type="text"
            placeholder={txt.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full mb-2 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black placeholder:text-slate-500 [color-scheme:light]"
          />
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-black text-sm [color-scheme:light]"
          >
            {filtered.length === 0 ? (
              <option value="">{txt.noInfluencers}</option>
            ) : (
              filtered.map((u) => (
                <option key={String(u.id)} value={String(u.id)}>
                  {u.label}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="flex-1 min-w-0">
          <label className="block text-xs font-semibold text-slate-700 mb-1">{txt.period}</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {(
              [
                ["7d", txt.last7],
                ["30d", txt.last30],
                ["quarter", txt.quarter],
                ["year", txt.year],
                ["all", txt.all],
                ["custom", txt.custom],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setPeriod(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  period === k ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || !selectedId}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {txt.refresh}
            </button>
          </div>
          {period === "custom" && (
            <div className="flex gap-3 flex-wrap">
              <div>
                <span className="text-xs text-slate-600">{txt.from}</span>
                <DmyDateField
                  lang={lang}
                  ariaLabel={txt.from}
                  value={customStart}
                  onChange={setCustomStart}
                  className="block mt-0.5 px-2 py-1 border border-slate-300 rounded text-sm bg-white text-black"
                />
              </div>
              <div>
                <span className="text-xs text-slate-600">{txt.to}</span>
                <DmyDateField
                  lang={lang}
                  ariaLabel={txt.to}
                  value={customEnd}
                  onChange={setCustomEnd}
                  className="block mt-0.5 px-2 py-1 border border-slate-300 rounded text-sm bg-white text-black"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {!selectedId && <p className="text-sm text-slate-500">{txt.noSelection}</p>}

      {selectedId && loading && <p className="text-sm text-slate-500">{txt.loading}</p>}

      {selectedId && !loading && error && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">{txt.loadError}</p>
      )}

      {selectedId && !loading && payload && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <Kpi label={txt.profileViews} value={views} />
            <Kpi label={txt.profileClicks} value={clicks} />
            <Kpi label={txt.socialOutbound} value={outbound} />
            <Kpi label={txt.applications} value={payload.applications.total} />
            <Kpi label={txt.proposals} value={payload.proposals.total} />
            <Kpi label={txt.collaborations} value={payload.proposals.collaborations} />
            <Kpi label={txt.messages} value={payload.messages.total} />
            <Kpi
              label={txt.reviews}
              value={
                payload.reviews.count > 0
                  ? `${payload.reviews.count}${payload.reviews.avgRating != null ? ` · ${payload.reviews.avgRating}` : ""}`
                  : "0"
              }
            />
            <Kpi label={txt.earnings} value={formatEuro(payload.proposals.earnings, lang, 0)} accent />
          </div>

          <p className="text-xs text-slate-500">
            {txt.ctr}: <strong className="text-slate-800">{pct(clicks, views)}</strong>
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-2">{txt.growthTitle}</h3>
            <div className="flex flex-wrap gap-6 text-sm mb-4">
              <div>
                <span className="text-slate-500">{txt.growthCurrent}: </span>
                <span className="font-semibold text-slate-900">{(growth?.currentTotal ?? 0).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500">{txt.growth15d}: </span>
                {growth?.growth != null ? (
                  <span className={`font-semibold ${growth.growth >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {growth.growth >= 0 ? "+" : ""}
                    {growth.growth.toLocaleString()}
                    {growth.growthPct != null ? ` (${growth.growthPct >= 0 ? "+" : ""}${growth.growthPct}%)` : ""}
                  </span>
                ) : (
                  <span className="text-slate-500">{txt.growthNA}</span>
                )}
              </div>
            </div>
            {growth?.series?.length ? <FollowerGrowthChart lang={lang} points={growth.series} /> : null}
          </div>

          {(payload.platformAccounts.length > 0 || Object.keys(payload.analytics.socialOutboundByPlatform).length > 0) && (
            <div className="grid md:grid-cols-2 gap-4">
              {payload.platformAccounts.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-slate-900 mb-3">{txt.platformAccounts}</h3>
                  <div className="space-y-3">
                    {[...payload.platformAccounts]
                      .sort((a, b) => b.followers - a.followers)
                      .map((acc) => (
                        <div key={acc.platform}>
                          <div className="flex justify-between text-xs mb-0.5 gap-2">
                            <span className="capitalize text-slate-700 font-medium">{acc.platform}</span>
                            <span className="text-slate-600 text-right">
                              {acc.followers.toLocaleString()} {txt.followers}
                              {acc.engagement_rate ? ` · ${txt.er} ${acc.engagement_rate}` : ""}
                              {acc.avg_likes ? ` · ${txt.avgLikes} ${acc.avg_likes}` : ""}
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${(acc.followers / maxFollowers) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {Object.keys(payload.analytics.socialOutboundByPlatform).length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-slate-900 mb-3">{txt.outboundPlatforms}</h3>
                  <div className="space-y-2">
                    {Object.entries(payload.analytics.socialOutboundByPlatform)
                      .sort((a, b) => b[1] - a[1])
                      .map(([plat, n]) => {
                        const max = Math.max(...Object.values(payload.analytics.socialOutboundByPlatform), 1);
                        return (
                          <div key={plat}>
                            <div className="flex justify-between text-xs mb-0.5">
                              <span className="capitalize text-slate-700">{plat}</span>
                              <span className="font-medium">{n}</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(n / max) * 100}%` }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-4">{txt.dailyChart}</h3>
            <DailyVolumeChart
              lang={lang}
              daily={payload.analytics.daily}
              viewsLabel={txt.chartViews}
              clicksLabel={txt.chartClicks}
            />
          </div>

          {payload.recentEvents.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900">{txt.recent}</h3>
              </div>
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-semibold">{txt.colType}</th>
                      <th className="px-3 py-2 font-semibold">{txt.colTime}</th>
                      <th className="px-3 py-2 font-semibold">{txt.colMeta}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.recentEvents.map((ev, i) => {
                      const meta = ev.metadata as Record<string, unknown> | undefined;
                      const note =
                        ev.event_type === "profile_click" && meta?.source === "social_outbound"
                          ? String(meta.platform ?? "social")
                          : "";
                      return (
                        <tr key={ev.id ?? `${ev.created_at}-${i}`} className="border-t border-slate-100">
                          <td className="px-3 py-1.5 text-slate-800">{eventLabel(ev.event_type, lang)}</td>
                          <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                            {formatDisplayDateTime(ev.created_at)}
                          </td>
                          <td className="px-3 py-1.5 text-slate-500">{note}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        accent ? "border-emerald-200 bg-emerald-50/80" : "border-slate-200 bg-white"
      }`}
    >
      <div className={`text-xl font-bold ${accent ? "text-emerald-800" : "text-slate-900"}`}>{value}</div>
      <div className={`text-[11px] mt-0.5 leading-tight ${accent ? "text-emerald-700" : "text-slate-600"}`}>{label}</div>
    </div>
  );
}