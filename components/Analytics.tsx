"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface AnalyticsStats {
  profileViews: number;
  profileClicks: number;
  proposalsSent: number;
  messagesSent: number;
  conversationsStarted: number;
  totalEarnings: number;
  totalEvents: number;
  eventsByDate: Record<string, {
    views: number;
    clicks: number;
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
    profileClicks: "Κλικ Προφίλ",
    proposalsSent: "Προσφορές",
    messagesSent: "Μηνύματα",
    conversationsStarted: "Συνομιλίες",
    totalEarnings: "Κέρδος",
    total: "Σύνολο",
    loading: "Φόρτωση...",
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
    profileClicks: "Profile Clicks",
    proposalsSent: "Proposals",
    messagesSent: "Messages",
    conversationsStarted: "Conversations",
    totalEarnings: "Earnings",
    total: "Total",
    loading: "Loading...",
    noData: "No data available for this period",
    from: "From",
    to: "To"
  }
};

export default function Analytics({ influencerId, lang = 'el' }: AnalyticsProps) {
  const txt = t[lang];
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | 'quarter' | 'year' | 'custom'>('30d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
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

        const response = await fetch(`/api/analytics/stats?${params.toString()}`);
        if (response.ok) {
          const result = await response.json();
          setStats(result.stats);
        }
      } catch (error) {
        console.error('Error loading analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [influencerId, period, customStartDate, customEndDate]);

  // Calculate max value for chart scaling
  const maxValue = stats ? Math.max(
    stats.profileViews,
    stats.profileClicks,
    stats.proposalsSent,
    stats.messagesSent,
    stats.conversationsStarted
  ) : 0;

  // Prepare chart data (last 30 days)
  const chartData = stats ? Object.entries(stats.eventsByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, data]) => ({
      date: new Date(date).toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-US', { month: 'short', day: 'numeric' }),
      views: data.views,
      clicks: data.clicks,
      proposals: data.proposals,
      messages: data.messages,
      conversations: data.conversations
    })) : [];

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <div className="text-center text-slate-500">{txt.loading}</div>
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
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              period === '7d'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {txt.last7days}
          </button>
          <button
            onClick={() => setPeriod('30d')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              period === '30d'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {txt.last30days}
          </button>
          <button
            onClick={() => setPeriod('quarter')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              period === 'quarter'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {txt.lastQuarter}
          </button>
          <button
            onClick={() => setPeriod('year')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              period === 'year'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {txt.lastYear}
          </button>
          <button
            onClick={() => setPeriod('custom')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
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
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="text-2xl font-bold text-slate-900">{stats.profileViews}</div>
          <div className="text-sm text-slate-600 mt-1">{txt.profileViews}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="text-2xl font-bold text-slate-900">{stats.profileClicks}</div>
          <div className="text-sm text-slate-600 mt-1">{txt.profileClicks}</div>
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
                    {item.views + item.clicks + item.proposals + item.messages + item.conversations} {txt.total}
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
