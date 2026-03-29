"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface AnalyticsStats {
  profileViews: number;
  profileClicks: number;
  socialOutboundClicks?: number;
  socialOutboundByPlatform?: Record<string, number>;
  proposalsSent: number;
  messagesSent: number;
  conversationsStarted: number;
  totalEarnings: number;
  totalEvents: number;
  eventsByDate: Record<
    string,
    {
      views: number;
      clicks: number;
      socialOutbound: number;
      proposals: number;
      messages: number;
      conversations: number;
    }
  >;
}

interface AnalyticsEventRow {
  id?: string;
  event_type: string;
  created_at: string;
  metadata?: unknown;
}

const tr = {
  el: {
    title: "Στατιστικά ανά influencer",
    subtitle:
      "Ό,τι μετράνε συνήθως πλατφόρμες marketplace: προβολές, κλικ, funnel (προβολή → επαφή → συνομιλία → πρόταση), έσοδα, κατανομή ανά κοινωνικό δίκτυο και χρονοσειρά.",
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
    noData: "Δεν υπάρχουν γεγονότα για αυτή την περίοδο.",
    profileViews: "Προβολές προφίλ",
    profileClicks: "Κλικ προς προφίλ Influo",
    socialOutbound: "Έξοδος προς κοινωνικά",
    proposals: "Προτάσεις (events)",
    messages: "Μηνύματα",
    conversations: "Συνομιλίες",
    earnings: "Έσοδα (αποδεκτές/ολοκληρωμένες)",
    totalEvents: "Σύνολο events",
    funnel: "Funnel (ποσοστά επί προβολών)",
    stepViews: "Προβολές",
    stepClicks: "Κλικ προφίλ",
    stepConv: "Νέες συνομιλίες",
    stepMsg: "Μηνύματα",
    stepProp: "Προτάσεις",
    ctr: "CTR κλικ/προβολή",
    outboundShare: "Έξοδος κοιν. / (κλικ+έξοδος)",
    msgPerConv: "Μηνύματα / συνομιλία",
    platforms: "Έξοδος ανά πλατφόρμα",
    chart: "Χρονοσειρά (ανά ημέρα)",
    recent: "Πρόσφατα events",
    colType: "Τύπος",
    colTime: "Ώρα",
    colMeta: "Σημείωση",
    growthTitle: "Ακόλουθοι (εκτίμηση)",
    growthCurrent: "Τρέχον σύνολο",
    growth30d: "Μεταβολή 30 ημ.",
    growthNA: "Δεν υπάρχει ιστορικό snapshots",
  },
  en: {
    title: "Per-influencer analytics",
    subtitle:
      "Typical marketplace metrics: impressions/views, clicks, funnel (view → contact → chat → proposal), revenue, social breakdown, and timeline.",
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
    noData: "No events for this period.",
    profileViews: "Profile views",
    profileClicks: "Influo profile clicks",
    socialOutbound: "Outbound to social",
    proposals: "Proposals (events)",
    messages: "Messages",
    conversations: "Conversations",
    earnings: "Earnings (accepted/completed)",
    totalEvents: "Total events",
    funnel: "Funnel (% of profile views)",
    stepViews: "Views",
    stepClicks: "Profile clicks",
    stepConv: "New conversations",
    stepMsg: "Messages",
    stepProp: "Proposals",
    ctr: "Click-through (clicks/views)",
    outboundShare: "Social outbound / (clicks+outbound)",
    msgPerConv: "Messages per conversation",
    platforms: "Outbound by platform",
    chart: "Timeline (by day)",
    recent: "Recent events",
    colType: "Type",
    colTime: "Time",
    colMeta: "Note",
    growthTitle: "Followers (estimate)",
    growthCurrent: "Current total",
    growth30d: "30-day change",
    growthNA: "No snapshot history",
  },
};

function eventLabel(type: string, lang: "el" | "en"): string {
  const el: Record<string, string> = {
    profile_view: "Προβολή προφίλ",
    profile_click: "Κλικ προφίλ",
    proposal_sent: "Πρόταση",
    message_sent: "Μήνυμα",
    conversation_started: "Συνομιλία",
  };
  const en: Record<string, string> = {
    profile_view: "Profile view",
    profile_click: "Profile click",
    proposal_sent: "Proposal",
    message_sent: "Message",
    conversation_started: "Conversation",
  };
  return (lang === "el" ? el : en)[type] || type;
}

function pct(n: number, d: number): string {
  if (d <= 0) return "0%";
  return `${Math.min(100, Math.round((n / d) * 1000) / 10)}%`;
}

export default function AdminInfluencerStatsTab({
  influencers,
  lang,
}: {
  influencers: { id: string | number; display_name: string }[];
  lang: "el" | "en";
}) {
  const txt = tr[lang];
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [period, setPeriod] = useState<"7d" | "30d" | "quarter" | "year" | "all" | "custom">("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [events, setEvents] = useState<AnalyticsEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [growth, setGrowth] = useState<{
    currentTotal: number;
    growth?: number;
    growthPct?: number;
  } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return influencers;
    return influencers.filter((u) => u.display_name?.toLowerCase().includes(q));
  }, [influencers, query]);

  useEffect(() => {
    if (!selectedId && filtered.length > 0) {
      setSelectedId(String(filtered[0].id));
    }
  }, [filtered, selectedId]);

  const load = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      let startDate: string | null = null;
      const endIso = new Date().toISOString();

      if (period === "7d") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        startDate = d.toISOString();
      } else if (period === "30d") {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        startDate = d.toISOString();
      } else if (period === "quarter") {
        const d = new Date();
        d.setMonth(d.getMonth() - 3);
        startDate = d.toISOString();
      } else if (period === "year") {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        startDate = d.toISOString();
      } else if (period === "all") {
        startDate = null;
      } else if (period === "custom") {
        startDate = customStart ? new Date(customStart).toISOString() : null;
      }

      const params = new URLSearchParams({ influencerId: selectedId });
      if (period === "all") {
        /* full history: no date filters on events */
      } else if (period === "custom") {
        if (startDate) params.set("startDate", startDate);
        if (customEnd) params.set("endDate", new Date(customEnd).toISOString());
        else params.set("endDate", endIso);
      } else {
        if (startDate) params.set("startDate", startDate);
        params.set("endDate", endIso);
      }

      const [res, gRes] = await Promise.all([
        fetch(`/api/analytics/stats?${params.toString()}`),
        fetch(`/api/influencer/${encodeURIComponent(selectedId)}/growth`),
      ]);

      if (res.ok) {
        const data = await res.json();
        setStats(data.stats ?? null);
        setEvents(Array.isArray(data.events) ? data.events : []);
      } else {
        setStats(null);
        setEvents([]);
      }

      if (gRes.ok) {
        const g = await gRes.json();
        setGrowth({
          currentTotal: g.currentTotal ?? 0,
          growth: g.growth,
          growthPct: g.growthPct,
        });
      } else {
        setGrowth(null);
      }
    } catch {
      setStats(null);
      setEvents([]);
      setGrowth(null);
    } finally {
      setLoading(false);
    }
  }, [selectedId, period, customStart, customEnd]);

  useEffect(() => {
    load();
  }, [load]);

  const chartData = useMemo(() => {
    if (!stats?.eventsByDate) return [];
    return Object.entries(stats.eventsByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => {
        const dayTotal =
          data.views +
          data.clicks +
          (data.socialOutbound ?? 0) +
          data.proposals +
          data.messages +
          data.conversations;
        return {
          dateKey: date,
          label: new Date(date).toLocaleDateString(lang === "el" ? "el-GR" : "en-US", {
            month: "short",
            day: "numeric",
          }),
          ...data,
          socialOutbound: data.socialOutbound ?? 0,
          dayTotal,
        };
      });
  }, [stats, lang]);

  const views = stats?.profileViews ?? 0;
  const clicks = stats?.profileClicks ?? 0;
  const outbound = stats?.socialOutboundClicks ?? 0;
  const conv = stats?.conversationsStarted ?? 0;
  const msg = stats?.messagesSent ?? 0;
  const prop = stats?.proposalsSent ?? 0;

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
            className="w-full mb-2 px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 text-sm"
          >
            {filtered.length === 0 ? (
              <option value="">{txt.noInfluencers}</option>
            ) : (
              filtered.map((u) => (
                <option key={String(u.id)} value={String(u.id)}>
                  {u.display_name}
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
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="block mt-0.5 px-2 py-1 border border-slate-300 rounded text-sm"
                />
              </div>
              <div>
                <span className="text-xs text-slate-600">{txt.to}</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="block mt-0.5 px-2 py-1 border border-slate-300 rounded text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {!selectedId && <p className="text-sm text-slate-500">{txt.noSelection}</p>}

      {selectedId && loading && <p className="text-sm text-slate-500">{txt.loading}</p>}

      {selectedId && !loading && stats && stats.totalEvents === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">{txt.noData}</p>
      )}

      {selectedId && !loading && stats && stats.totalEvents > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <Kpi label={txt.profileViews} value={views} />
            <Kpi label={txt.profileClicks} value={clicks} />
            <Kpi label={txt.socialOutbound} value={outbound} />
            <Kpi label={txt.conversations} value={conv} />
            <Kpi label={txt.messages} value={msg} />
            <Kpi label={txt.proposals} value={prop} />
            <Kpi label={txt.totalEvents} value={stats.totalEvents} />
            <Kpi label={txt.earnings} value={`€${stats.totalEarnings.toFixed(0)}`} accent />
          </div>

          {growth && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-2">{txt.growthTitle}</h3>
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <span className="text-slate-500">{txt.growthCurrent}: </span>
                  <span className="font-semibold text-slate-900">{growth.currentTotal.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-500">{txt.growth30d}: </span>
                  {growth.growth != null ? (
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
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-3">{txt.funnel}</h3>
              <ul className="space-y-2 text-sm">
                <FunnelRow label={txt.stepViews} value={views} base={views} />
                <FunnelRow label={txt.stepClicks} value={clicks} base={views} />
                <FunnelRow label={txt.stepConv} value={conv} base={views} />
                <FunnelRow label={txt.stepMsg} value={msg} base={views} />
                <FunnelRow label={txt.stepProp} value={prop} base={views} />
              </ul>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-3">KPI</h3>
              <ul className="space-y-2 text-sm text-slate-700">
                <li>
                  <span className="text-slate-500">{txt.ctr}: </span>
                  <strong>{pct(clicks, views)}</strong>
                </li>
                <li>
                  <span className="text-slate-500">{txt.outboundShare}: </span>
                  <strong>{pct(outbound, clicks + outbound)}</strong>
                </li>
                <li>
                  <span className="text-slate-500">{txt.msgPerConv}: </span>
                  <strong>{conv > 0 ? (msg / conv).toFixed(1) : "—"}</strong>
                </li>
              </ul>
            </div>
          </div>

          {Object.keys(stats.socialOutboundByPlatform ?? {}).length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-3">{txt.platforms}</h3>
              <div className="space-y-2">
                {Object.entries(stats.socialOutboundByPlatform ?? {})
                  .sort((a, b) => b[1] - a[1])
                  .map(([plat, n]) => {
                    const max = Math.max(...Object.values(stats.socialOutboundByPlatform ?? {}), 1);
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

          {chartData.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-4">{txt.chart}</h3>
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {chartData.map((item) => (
                  <div key={item.dateKey} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>{item.label}</span>
                      <span className="font-medium text-slate-800">{item.dayTotal}</span>
                    </div>
                    <div className="flex h-5 w-full rounded overflow-hidden bg-slate-100">
                      {item.dayTotal > 0 && (
                        <>
                          {item.views > 0 && (
                            <div
                              className="bg-blue-500 h-full min-w-[2px]"
                              style={{ width: `${(item.views / item.dayTotal) * 100}%` }}
                              title={`${txt.profileViews}: ${item.views}`}
                            />
                          )}
                          {item.clicks > 0 && (
                            <div
                              className="bg-purple-500 h-full min-w-[2px]"
                              style={{ width: `${(item.clicks / item.dayTotal) * 100}%` }}
                              title={`${txt.profileClicks}: ${item.clicks}`}
                            />
                          )}
                          {item.socialOutbound > 0 && (
                            <div
                              className="bg-cyan-500 h-full min-w-[2px]"
                              style={{ width: `${(item.socialOutbound / item.dayTotal) * 100}%` }}
                              title={`${txt.socialOutbound}: ${item.socialOutbound}`}
                            />
                          )}
                          {item.proposals > 0 && (
                            <div
                              className="bg-green-500 h-full min-w-[2px]"
                              style={{ width: `${(item.proposals / item.dayTotal) * 100}%` }}
                              title={`${txt.proposals}: ${item.proposals}`}
                            />
                          )}
                          {item.messages > 0 && (
                            <div
                              className="bg-yellow-500 h-full min-w-[2px]"
                              style={{ width: `${(item.messages / item.dayTotal) * 100}%` }}
                              title={`${txt.messages}: ${item.messages}`}
                            />
                          )}
                          {item.conversations > 0 && (
                            <div
                              className="bg-red-500 h-full min-w-[2px]"
                              style={{ width: `${(item.conversations / item.dayTotal) * 100}%` }}
                              title={`${txt.conversations}: ${item.conversations}`}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 mt-4 text-[11px] text-slate-600">
                <Legend color="bg-blue-500" label={txt.profileViews} />
                <Legend color="bg-purple-500" label={txt.profileClicks} />
                <Legend color="bg-cyan-500" label={txt.socialOutbound} />
                <Legend color="bg-green-500" label={txt.proposals} />
                <Legend color="bg-yellow-500" label={txt.messages} />
                <Legend color="bg-red-500" label={txt.conversations} />
              </div>
            </div>
          )}

          {events.length > 0 && (
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
                    {events.slice(0, 40).map((ev, i) => {
                      const meta = ev.metadata as Record<string, unknown> | undefined;
                      const note =
                        ev.event_type === "profile_click" && meta?.source === "social_outbound"
                          ? String(meta.platform ?? "social")
                          : "";
                      return (
                        <tr key={ev.id ?? `${ev.created_at}-${i}`} className="border-t border-slate-100">
                          <td className="px-3 py-1.5 text-slate-800">{eventLabel(ev.event_type, lang)}</td>
                          <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                            {new Date(ev.created_at).toLocaleString(lang === "el" ? "el-GR" : "en-US")}
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

function FunnelRow({ label, value, base }: { label: string; value: number; base: number }) {
  return (
    <li className="flex justify-between items-center gap-2">
      <span className="text-slate-600">{label}</span>
      <span className="font-medium text-slate-900">
        {value} <span className="text-slate-400 font-normal">({pct(value, base)})</span>
      </span>
    </li>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-2.5 h-2.5 rounded ${color}`} />
      {label}
    </span>
  );
}
