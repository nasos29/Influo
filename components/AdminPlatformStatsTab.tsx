"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { changePct, type PeriodKpi } from "@/lib/adminPlatformStats";
import { formatDisplayDate } from "@/lib/formatDate";
import { ExternalLink, RefreshCw } from "lucide-react";

const GA_PROPERTY_URL = "https://analytics.google.com/";

type TrafficPayload = {
  configured: boolean;
  error?: string;
  users?: PeriodKpi;
  sessions?: PeriodKpi;
  newUsers?: PeriodKpi;
  signUp?: PeriodKpi;
  topChannels?: { channel: string; sessions: number }[];
  topLandingPages?: { path: string; sessions: number }[];
};

type OverviewPayload = {
  kpis: Record<string, PeriodKpi>;
  dailySignups: { date: string; creators: number; brands: number }[];
  analyticsDaily: { date: string; views: number; clicks: number; social: number }[];
  funnel: {
    signups: number;
    approved: number;
    applications: number;
    acceptedProposals: number;
    completed: number;
  };
  tops: {
    categories: { label: string; count: number }[];
    locations: { label: string; count: number }[];
    industries: { label: string; count: number }[];
  };
  reviews: {
    avgRatingToday: number | null;
    avgRating7d: number | null;
    avgRating30d: number | null;
  };
  emails?: {
    topTypes7d: { type: string; count: number }[];
    topTypes30d: { type: string; count: number }[];
  };
  error?: string;
};

const tr = {
  el: {
    title: "Στατιστικά πλατφόρμας",
    subtitle: "Κλειδικά KPI, funnel, εγγραφές ανά ημέρα και δραστηριότητα Influo (όχι traffic ιστότοπου).",
    refresh: "Ανανέωση",
    loading: "Φόρτωση στατιστικών…",
    error: "Δεν φορτώθηκαν τα στατιστικά.",
    retry: "Ξανά",
    today: "Σήμερα",
    d7: "7 ημέρες",
    d30: "30 ημέρες",
    vsPrev: "vs προηγ.",
    total: "Σύνολο",
    siteTrafficTitle: "Traffic ιστότοπου",
    siteTrafficNote: "Ο επισκεψιμότητας του ιστότοπου μετράεται στο Google Analytics — όχι στη βάση Influo.",
    siteTrafficNoteLive: "Δεδομένα GA4 (Europe/Athens) — η πλατφόρμα Influo παραμένει ξεχωριστά παρακάτω.",
    trafficNotConfigured: "Το GA4 δεν είναι ρυθμισμένο στο server (GA4_PROPERTY_ID / GA4_SA_KEY_FILE).",
    trafficLoadError: "Δεν φορτώθηκε το traffic από το GA4.",
    gaUsers: "Χρήστες (active)",
    gaSessions: "Sessions",
    gaNewUsers: "Νέοι χρήστες",
    gaSignUp: "Events sign_up",
    topChannels: "Κορυφαία κανάλια (30ημ.)",
    topLandingPages: "Κορυφαίες landing σελίδες (30ημ.)",
    openGa: "Άνοιγμα Google Analytics",
    funnel: "Funnel (τελευταίες 30 ημέρες / αποθέματα)",
    signups: "Νέες εγγραφές (30ημ.)",
    approved: "Εγκεκριμένοι creators",
    applications: "Αιτήσεις καμπανιών (30ημ.)",
    accepted: "Αποδεκτές/ολοκληρωμένες προτάσεις (30ημ.)",
    completed: "Ολοκληρωμένες (30ημ.)",
    dailySignups: "Εγγραφές ανά ημέρα",
    creators: "Creators",
    brands: "Brands",
    topsCategories: "Κορυφαίες κατηγορίες creators",
    topsLocations: "Τοποθεσίες creators",
    topsIndustries: "Κλάδοι επιχειρήσεων",
    emails: "Email (αποστολές)",
    reviews: "Αξιολογήσεις",
    avgRating: "Μέσος όρος βαθμού",
    profileViews: "Προβολές προφίλ",
    profileClicks: "Κλικ προφίλ Influo",
    socialClicks: "Κλικ έξω → social",
    messages: "Μηνύματα",
    conversations: "Συνομιλίες",
    proposals: "Νέες προτάσεις",
    campaigns: "Νέες καμπάνιες brands",
    empty: "—",
  },
  en: {
    title: "Platform statistics",
    subtitle: "Key KPIs, funnel, daily sign-ups, and in-app Influo activity (not website traffic).",
    refresh: "Refresh",
    loading: "Loading statistics…",
    error: "Could not load statistics.",
    retry: "Retry",
    today: "Today",
    d7: "7 days",
    d30: "30 days",
    vsPrev: "vs prev.",
    total: "Total",
    siteTrafficTitle: "Website traffic",
    siteTrafficNote: "Website visits are measured in Google Analytics — not in the Influo database.",
    siteTrafficNoteLive: "GA4 data (Europe/Athens) — in-app Influo metrics remain below.",
    trafficNotConfigured: "GA4 is not configured on the server (GA4_PROPERTY_ID / GA4_SA_KEY_FILE).",
    trafficLoadError: "Could not load traffic from GA4.",
    gaUsers: "Users (active)",
    gaSessions: "Sessions",
    gaNewUsers: "New users",
    gaSignUp: "sign_up events",
    topChannels: "Top channels (30d)",
    topLandingPages: "Top landing pages (30d)",
    openGa: "Open Google Analytics",
    funnel: "Funnel (last 30 days / stock)",
    signups: "New sign-ups (30d)",
    approved: "Approved creators",
    applications: "Campaign applications (30d)",
    accepted: "Accepted/completed proposals (30d)",
    completed: "Completed (30d)",
    dailySignups: "Sign-ups by day",
    creators: "Creators",
    brands: "Brands",
    topsCategories: "Top creator categories",
    topsLocations: "Creator locations",
    topsIndustries: "Company industries",
    emails: "Email (sends)",
    reviews: "Reviews",
    avgRating: "Average rating",
    profileViews: "Profile views",
    profileClicks: "Influo profile clicks",
    socialClicks: "Outbound social clicks",
    messages: "Messages",
    conversations: "Conversations",
    proposals: "New proposals",
    campaigns: "New brand campaigns",
    empty: "—",
  },
} as const;

async function adminAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

function fmtPct(n: number | null): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}%`;
}

function pctClass(n: number | null): string {
  if (n == null || n === 0) return "text-slate-500";
  return n > 0 ? "text-emerald-700" : "text-rose-700";
}

function KpiCard({
  label,
  kpi,
  lang,
  showTotal,
}: {
  label: string;
  kpi?: PeriodKpi;
  lang: "el" | "en";
  showTotal?: boolean;
}) {
  const txt = tr[lang];
  if (!kpi) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="text-slate-400 text-xl font-bold">{txt.empty}</div>
        <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
      </div>
    );
  }
  const ch7 = changePct(kpi.d7, kpi.prev7);
  const ch30 = changePct(kpi.d30, kpi.prev30);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
      <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">{label}</div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <div className="text-lg font-bold text-slate-900">{kpi.today}</div>
          <div className="text-slate-500">{txt.today}</div>
        </div>
        <div>
          <div className="text-lg font-bold text-slate-900">{kpi.d7}</div>
          <div className="text-slate-500">{txt.d7}</div>
          <div className={`text-[10px] font-medium ${pctClass(ch7)}`}>
            {txt.vsPrev} {fmtPct(ch7)}
          </div>
        </div>
        <div>
          <div className="text-lg font-bold text-slate-900">{kpi.d30}</div>
          <div className="text-slate-500">{txt.d30}</div>
          <div className={`text-[10px] font-medium ${pctClass(ch30)}`}>
            {txt.vsPrev} {fmtPct(ch30)}
          </div>
        </div>
      </div>
      {showTotal && typeof kpi.total === "number" ? (
        <div className="text-[11px] text-slate-600 border-t border-slate-100 pt-2">
          {txt.total}: <strong className="text-slate-900">{kpi.total.toLocaleString()}</strong>
        </div>
      ) : null}
    </div>
  );
}

function FunnelBar({ label, value, base }: { label: string; value: number; base: number }) {
  const width = base > 0 ? Math.min(100, Math.round((value / base) * 1000) / 10) : 0;
  return (
    <li>
      <div className="flex justify-between text-xs text-slate-600 mb-0.5">
        <span>{label}</span>
        <span className="font-medium text-slate-900">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${width}%` }} />
      </div>
    </li>
  );
}

function ChannelBars({
  items,
  lang,
}: {
  items: { channel: string; sessions: number }[];
  lang: "el" | "en";
}) {
  const txt = tr[lang];
  if (!items.length) return <p className="text-sm text-slate-500">{txt.empty}</p>;
  const max = Math.max(...items.map((i) => i.sessions), 1);
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.channel}>
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-slate-700 truncate pr-2">{item.channel}</span>
            <span className="font-medium text-slate-900 shrink-0">{item.sessions.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${(item.sessions / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function TopBars({ items, lang }: { items: { label: string; count: number }[]; lang: "el" | "en" }) {
  const txt = tr[lang];
  if (!items.length) return <p className="text-sm text-slate-500">{txt.empty}</p>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-slate-700 truncate pr-2">{item.label}</span>
            <span className="font-medium text-slate-900 shrink-0">{item.count}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function DailySignupsChart({
  data,
  lang,
}: {
  data: { date: string; creators: number; brands: number }[];
  lang: "el" | "en";
}) {
  const txt = tr[lang];
  const W = 820;
  const H = 220;
  const PAD_L = 44;
  const PAD_R = 16;
  const PAD_T = 12;
  const PAD_B = 28;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const n = data.length;
  const maxY = Math.max(1, ...data.map((d) => d.creators + d.brands));
  const xAt = (i: number) => (n <= 1 ? PAD_L + innerW / 2 : PAD_L + (i / (n - 1)) * innerW);
  const yAt = (v: number) => PAD_T + innerH - (v / maxY) * innerH;

  const creatorsPts = data.map((d, i) => `${xAt(i).toFixed(1)},${yAt(d.creators).toFixed(1)}`).join(" ");
  const brandsPts = data.map((d, i) => `${xAt(i).toFixed(1)},${yAt(d.brands).toFixed(1)}`).join(" ");

  const xLabels =
    n > 0
      ? [
          { i: 0, date: data[0].date },
          { i: Math.floor((n - 1) / 2), date: data[Math.floor((n - 1) / 2)].date },
          { i: n - 1, date: data[n - 1].date },
        ]
      : [];

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[320px] max-h-[240px]" role="img" aria-label={txt.dailySignups}>
        <line x1={PAD_L} y1={PAD_T + innerH} x2={W - PAD_R} y2={PAD_T + innerH} stroke="#e2e8f0" />
        {n > 1 ? (
          <>
            <polyline fill="none" stroke="#3b82f6" strokeWidth={2} points={creatorsPts} />
            <polyline fill="none" stroke="#10b981" strokeWidth={2} points={brandsPts} />
          </>
        ) : null}
        {xLabels.map(({ i, date }) => (
          <text key={date} x={xAt(i)} y={H - 6} textAnchor="middle" className="fill-slate-500 text-[10px]">
            {formatDisplayDate(date)}
          </text>
        ))}
      </svg>
      <div className="flex gap-4 text-[11px] text-slate-600 mt-1">
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-blue-500" />
          {txt.creators}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
          {txt.brands}
        </span>
      </div>
    </div>
  );
}

export default function AdminPlatformStatsTab({ lang }: { lang: "el" | "en" }) {
  const txt = tr[lang];
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [traffic, setTraffic] = useState<TrafficPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    const labels = tr[lang];
    try {
      const headers = await adminAuthHeaders();
      const [overviewRes, trafficRes] = await Promise.all([
        fetch("/api/admin/stats/overview", { headers, signal }),
        fetch("/api/admin/stats/traffic", { headers, signal }),
      ]);
      if (signal?.aborted) return;
      const json = (await overviewRes.json()) as OverviewPayload;
      if (!overviewRes.ok) {
        setError(json.error || labels.error);
        setData(null);
        setTraffic(null);
        return;
      }
      setData(json);
      const trafficJson = (await trafficRes.json()) as TrafficPayload;
      if (signal?.aborted) return;
      setTraffic(trafficRes.ok ? trafficJson : { configured: false, error: labels.trafficLoadError });
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
      setError(tr[lang].error);
      setData(null);
      setTraffic(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const funnelBase = useMemo(() => Math.max(data?.funnel.signups ?? 0, 1), [data]);

  if (loading && !data) {
    return (
      <div className="p-6 text-sm text-slate-600" role="status">
        {txt.loading}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-rose-700">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white text-sm px-3 py-2"
        >
          <RefreshCw className="w-4 h-4" />
          {txt.retry}
        </button>
      </div>
    );
  }

  if (!data) return null;

  const k = data.kpis;

  return (
    <div className="p-4 sm:p-6 space-y-6 border-t border-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{txt.title}</h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">{txt.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {txt.refresh}
        </button>
      </div>

      <div className="space-y-4">
        <div
          className={`rounded-xl p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 ${
            traffic?.configured
              ? "border border-slate-200 bg-white"
              : "border border-dashed border-slate-300 bg-slate-50/80"
          }`}
        >
          <div>
            <h3 className="text-sm font-bold text-slate-900">{txt.siteTrafficTitle}</h3>
            <p className="text-xs text-slate-600 mt-1 max-w-xl">
              {traffic?.configured ? txt.siteTrafficNoteLive : txt.siteTrafficNote}
            </p>
            {!traffic?.configured ? (
              <p className="text-xs text-slate-500 mt-2">{traffic?.error ?? txt.trafficNotConfigured}</p>
            ) : traffic.error ? (
              <p className="text-xs text-amber-800 mt-2">{traffic.error}</p>
            ) : null}
          </div>
          <a
            href={GA_PROPERTY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 shrink-0"
          >
            {txt.openGa}
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {traffic?.configured && traffic.users && traffic.sessions && traffic.newUsers ? (
          <>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <KpiCard label={txt.gaUsers} kpi={traffic.users} lang={lang} />
              <KpiCard label={txt.gaSessions} kpi={traffic.sessions} lang={lang} />
              <KpiCard label={txt.gaNewUsers} kpi={traffic.newUsers} lang={lang} />
              {traffic.signUp ? <KpiCard label={txt.gaSignUp} kpi={traffic.signUp} lang={lang} /> : null}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <h3 className="text-sm font-bold text-slate-900 mb-3">{txt.topChannels}</h3>
                <ChannelBars items={traffic.topChannels ?? []} lang={lang} />
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <h3 className="text-sm font-bold text-slate-900 mb-3">{txt.topLandingPages}</h3>
                <TopBars
                  items={(traffic.topLandingPages ?? []).map((p) => ({ label: p.path, count: p.sessions }))}
                  lang={lang}
                />
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <KpiCard label={txt.creators} kpi={k.influencer_signups} lang={lang} />
        <KpiCard label={txt.brands} kpi={k.brand_signups} lang={lang} />
        <KpiCard label={txt.profileViews} kpi={k.profile_views} lang={lang} />
        <KpiCard label={txt.profileClicks} kpi={k.profile_clicks_influo} lang={lang} />
        <KpiCard label={txt.socialClicks} kpi={k.profile_clicks_social} lang={lang} />
        <KpiCard label={txt.messages} kpi={k.messages} lang={lang} />
        <KpiCard label={txt.conversations} kpi={k.conversations} lang={lang} showTotal />
        <KpiCard label={txt.proposals} kpi={k.proposals_created} lang={lang} />
        <KpiCard label={txt.campaigns} kpi={k.campaigns_created} lang={lang} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-3">{txt.funnel}</h3>
          <ul className="space-y-3">
            <FunnelBar label={txt.signups} value={data.funnel.signups} base={funnelBase} />
            <FunnelBar label={txt.approved} value={data.funnel.approved} base={funnelBase} />
            <FunnelBar label={txt.applications} value={data.funnel.applications} base={funnelBase} />
            <FunnelBar label={txt.accepted} value={data.funnel.acceptedProposals} base={funnelBase} />
            <FunnelBar label={txt.completed} value={data.funnel.completed} base={funnelBase} />
          </ul>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
          <h3 className="text-sm font-bold text-slate-900">{txt.reviews}</h3>
          <p className="text-slate-600">
            {txt.avgRating} ({txt.today}):{" "}
            <strong>{data.reviews.avgRatingToday ?? txt.empty}</strong>
          </p>
          <p className="text-slate-600">
            {txt.d7}: <strong>{data.reviews.avgRating7d ?? txt.empty}</strong>
          </p>
          <p className="text-slate-600">
            {txt.d30}: <strong>{data.reviews.avgRating30d ?? txt.empty}</strong>
          </p>
          <KpiCard label={txt.reviews} kpi={k.influencer_reviews} lang={lang} />
        </div>
      </div>

      {data.dailySignups.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-3">{txt.dailySignups}</h3>
          <DailySignupsChart data={data.dailySignups} lang={lang} />
        </div>
      ) : null}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-3">{txt.topsCategories}</h3>
          <TopBars items={data.tops.categories} lang={lang} />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-3">{txt.topsLocations}</h3>
          <TopBars items={data.tops.locations} lang={lang} />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-3">{txt.topsIndustries}</h3>
          <TopBars items={data.tops.industries} lang={lang} />
        </div>
      </div>

      {data.emails ? (
        <div className="bg-white border border-slate-200 rounded-xl p-4 grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-2">
              {txt.emails} — {txt.d7}
            </h3>
            <TopBars
              items={data.emails.topTypes7d.map((e) => ({ label: e.type, count: e.count }))}
              lang={lang}
            />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-2">
              {txt.emails} — {txt.d30}
            </h3>
            <TopBars
              items={data.emails.topTypes30d.map((e) => ({ label: e.type, count: e.count }))}
              lang={lang}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}