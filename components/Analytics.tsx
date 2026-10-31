"use client";

import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/formatDateTime';
import { isTimeoutError, withTimeout } from '@/lib/withTimeout';

interface AnalyticsStats {
  profileViews: number;
  profileClicks: number;
  /** Clicks that open Instagram / TikTok / YouTube from the profile sidebar (tracked separately). */
  socialOutboundClicks?: number;
  socialOutboundByPlatform?: Record<string, number>;
  proposalsSent: number;
  messagesSent: number;
  conversationsStarted: number;
  totalEarnings: number;
  totalEvents: number;
  eventsByDate: Record<string, {
    views: number;
    clicks: number;
    socialOutbound: number;
    proposals: number;
    messages: number;
    conversations: number;
  }>;
}

interface AnalyticsProps {
  influencerId: string;
  lang?: 'el' | 'en';
}

const t = {
  el: {
    title: "Στατιστικά",
    period: "Περίοδος",
    last7days: "Τελευταίες 7 ημέρες",
    last30days: "Τελευταίες 30 ημέρες",
    lastQuarter: "Τελευταίο τρίμηνο",
    lastYear: "Τελευταίος χρόνος",
    custom: "Προσαρμοσμένο",
    profileViews: "Προβολές Προφίλ",
    profileClicks: "Κλικ Προφίλ Influo",
    socialOutbound: "Έξοδος (κοινωνικά)",
    proposalsSent: "Προσφορές",
    messagesSent: "Μηνύματα",
    conversationsStarted: "Συνομιλίες",
    totalEarnings: "Κέρδος",
    total: "Σύνολο",
    loading: "Φόρτωση...",
    loadError: "Τα στατιστικά δεν φορτώθηκαν.",
    timeout: "Η φόρτωση άργησε. Δοκίμασε ξανά.",
    retry: "Δοκίμασε ξανά",
    noData: "Δεν υπάρχουν δεδομένα για αυτή την περίοδο",
    from: "Από",
    to: "Έως"
  },
  en: {
    title: "Analytics",
    period: "Period",
    last7days: "Last 7 days",
    last30days: "Last 30 days",
    lastQuarter: "Last quarter",
    lastYear: "Last year",
    custom: "Custom",
    profileViews: "Profile Views",
    profileClicks: "Influo profile clicks",
    socialOutbound: "Outbound (social)",
    proposalsSent: "Proposals",
    messagesSent: "Messages",
    conversationsStarted: "Conversations",
    totalEarnings: "Earnings",
    total: "Total",
    loading: "Loading...",
    loadError: "Analytics could not be loaded.",
    timeout: "This took too long. Try again.",
    retry: "Try again",
    noData: "No data available for this period",
    from: "From",
    to: "To"
  }
};

export default function Analytics({ influencerId, lang = 'el' }: AnalyticsProps) {
  const txt = t[lang];
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<null | 'timeout' | 'error'>(null);
  const [attempt, setAttempt] = useState(0);
  const [period, setPeriod] = useState<'7d' | '30d' | 'quarter' | 'year' | 'custom'>('30d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // NOTE: `lang` is intentionally NOT a dependency here. Language only affects
  // labels; re-running the request on a lang flip could leave the spinner stuck.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    const loadStats = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        let startDate: string | null = null;
        const endDate = new Date().toISOString();

        if (period === '7d') {
          const date = new Date();
          date.setDate(date.getDate() - 7);
          startDate = date.toISOString();
        } else if (period === '30d') {
          const date = new Date();
          date.setDate(date.getDate() - 30);
          startDate = date.toISOString();
        } else if (period === 'quarter') {
          const date = new Date();
          date.setMonth(date.getMonth() - 3);
          startDate = date.toISOString();
        } else if (period === 'year') {
          const date = new Date();
          date.setFullYear(date.getFullYear() - 1);
          startDate = date.toISOString();
        } else if (period === 'custom') {
          startDate = customStartDate ? new Date(customStartDate).toISOString() : null;
        }

        const params = new URLSearchParams({
          influencerId: influencerId,
          ...(startDate && { startDate }),
          ...(period === 'custom' && customEndDate && { endDate: new Date(customEndDate).toISOString() })
        });

        const response = await withTimeout(
          fetch(`/api/analytics/stats?${params.toString()}`, {
            signal: controller.signal,
          }),
          20000
        );
        if (!response.ok) throw new Error('stats');
        const result = await response.json();
        if (!cancelled) setStats(result.stats);
      } catch (error) {
        if (!cancelled) {
          console.error('Error loading analytics:', error);
          setStats(null);
          setLoadError(isTimeoutError(error) || (error instanceof DOMException && error.name === 'AbortError') ? 'timeout' : 'error');
        }
      } finally {
        window.clearTimeout(timeout);
        // A superseded request is replaced by a newer effect run that owns `loading`.
        if (!cancelled) setLoading(false);
      }
    };

    loadStats();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [influencerId, period, customStartDate, customEndDate, attempt]);

  // Chart uses the same eventsByDate window as the KPI cards (selected period).
  const chartData = stats
    ? Object.entries(stats.eventsByDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, data]) => ({
          date: formatDate(date, lang),
          views: data.views,
          clicks: data.clicks,
          socialOutbound: data.socialOutbound ?? 0,
          proposals: data.proposals,
          messages: data.messages,
          conversations: data.conversations,
        }))
    : [];

  // Scale bars against the busiest day in the same window (not the period totals).
  const maxValue = chartData.reduce(
    (max, item) =>
      Math.max(
        max,
        item.views,
        item.clicks,
        item.socialOutbound,
        item.proposals,
        item.messages,
        item.conversations
      ),
    0
  );

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-24 rounded-xl bg-white border border-slate-200 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="h-24 rounded-xl bg-white border border-slate-200 animate-pulse" />
          <div className="h-24 rounded-xl bg-white border border-slate-200 animate-pulse" />
          <div className="h-24 rounded-xl bg-white border border-slate-200 animate-pulse" />
          <div className="h-24 rounded-xl bg-white border border-slate-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <p className="text-slate-600">{loadError === 'timeout' ? txt.timeout : txt.loadError}</p>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="mt-4 inline-flex min-h-11 items-center justify-center px-5 rounded-xl bg-slate-900 text-white text-sm font-medium"
        >
          {txt.retry}
        </button>
      </div>
    );
  }

  if (!stats || stats.totalEvents === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <div className="text-center text-slate-500">{txt.noData}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">{txt.period}</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setPeriod('7d')}
            className={`inline-flex min-h-11 items-center px-4 rounded-lg font-medium transition-colors ${
              period === '7d'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {txt.last7days}
          </button>
          <button
            onClick={() => setPeriod('30d')}
            className={`inline-flex min-h-11 items-center px-4 rounded-lg font-medium transition-colors ${
              period === '30d'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {txt.last30days}
          </button>
          <button
            onClick={() => setPeriod('quarter')}
            className={`inline-flex min-h-11 items-center px-4 rounded-lg font-medium transition-colors ${
              period === 'quarter'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {txt.lastQuarter}
          </button>
          <button
            onClick={() => setPeriod('year')}
            className={`inline-flex min-h-11 items-center px-4 rounded-lg font-medium transition-colors ${
              period === 'year'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {txt.lastYear}
          </button>
          <button
            onClick={() => setPeriod('custom')}
            className={`inline-flex min-h-11 items-center px-4 rounded-lg font-medium transition-colors ${
              period === 'custom'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {txt.custom}
          </button>
        </div>

        {period === 'custom' && (
          <div className="flex gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{txt.from}</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{txt.to}</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="text-2xl font-bold text-slate-900">{stats.profileViews}</div>
          <div className="text-sm text-slate-600 mt-1">{txt.profileViews}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="text-2xl font-bold text-slate-900">{stats.profileClicks}</div>
          <div className="text-sm text-slate-600 mt-1">{txt.profileClicks}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="text-2xl font-bold text-slate-900">{stats.socialOutboundClicks ?? 0}</div>
          <div className="text-sm text-slate-600 mt-1">{txt.socialOutbound}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="text-2xl font-bold text-slate-900">{stats.proposalsSent}</div>
          <div className="text-sm text-slate-600 mt-1">{txt.proposalsSent}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="text-2xl font-bold text-slate-900">{stats.messagesSent}</div>
          <div className="text-sm text-slate-600 mt-1">{txt.messagesSent}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="text-2xl font-bold text-slate-900">{stats.conversationsStarted}</div>
          <div className="text-sm text-slate-600 mt-1">{txt.conversationsStarted}</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 p-6">
          <div className="text-2xl font-bold text-green-700">€{stats.totalEarnings.toFixed(0)}</div>
          <div className="text-sm text-green-600 mt-1 font-medium">{txt.totalEarnings}</div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">{txt.title}</h3>
          <div className="space-y-4">
            {chartData.map((item, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>{item.date}</span>
                  <span className="font-medium text-slate-900">
                    {item.views + item.clicks + item.socialOutbound + item.proposals + item.messages + item.conversations} {txt.total}
                  </span>
                </div>
                <div className="flex gap-2 h-6">
                  {item.views > 0 && (
                    <div
                      className="bg-blue-500 rounded"
                      style={{ width: `${(item.views / maxValue) * 100}%` }}
                      title={`${txt.profileViews}: ${item.views}`}
                    />
                  )}
                  {item.clicks > 0 && (
                    <div
                      className="bg-purple-500 rounded"
                      style={{ width: `${(item.clicks / maxValue) * 100}%` }}
                      title={`${txt.profileClicks}: ${item.clicks}`}
                    />
                  )}
                  {item.socialOutbound > 0 && (
                    <div
                      className="bg-cyan-500 rounded"
                      style={{ width: `${(item.socialOutbound / maxValue) * 100}%` }}
                      title={`${txt.socialOutbound}: ${item.socialOutbound}`}
                    />
                  )}
                  {item.proposals > 0 && (
                    <div
                      className="bg-green-500 rounded"
                      style={{ width: `${(item.proposals / maxValue) * 100}%` }}
                      title={`${txt.proposalsSent}: ${item.proposals}`}
                    />
                  )}
                  {item.messages > 0 && (
                    <div
                      className="bg-yellow-500 rounded"
                      style={{ width: `${(item.messages / maxValue) * 100}%` }}
                      title={`${txt.messagesSent}: ${item.messages}`}
                    />
                  )}
                  {item.conversations > 0 && (
                    <div
                      className="bg-red-500 rounded"
                      style={{ width: `${(item.conversations / maxValue) * 100}%` }}
                      title={`${txt.conversationsStarted}: ${item.conversations}`}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-6 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>{txt.profileViews}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded"></div>
              <span>{txt.profileClicks}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-cyan-500 rounded"></div>
              <span>{txt.socialOutbound}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>{txt.proposalsSent}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
              <span>{txt.messagesSent}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span>{txt.conversationsStarted}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
