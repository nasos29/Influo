"use client";

import { useEffect, useState } from "react";
import { sessionFetch } from "@/lib/sessionFetch";
import { formatEuro } from "@/lib/formatEuro";
import { formatDate } from "@/lib/formatDateTime";
import type { BrandMonthStat } from "@/lib/brandStatistics";

type Collaboration = {
  id: string;
  creator: string;
  amount: number | null;
  status: string;
  date: string | null;
  deadline: string | null;
};

type Payload = {
  sent: number;
  accepted: number;
  acceptanceRate: number | null;
  completedAgreements: number;
  spent: number;
  average: number | null;
  activeCampaigns: number;
  totalCampaigns: number;
  uniqueCreators: number;
  months: BrandMonthStat[];
  collaborations: Collaboration[];
};

const COPY = {
  el: {
    title: "Στατιστικά",
    lead: "Από τις προτάσεις και τις καμπάνιες σου.",
    sent: "Προτάσεις που στάλθηκαν",
    accepted: "Αποδεκτές",
    rate: "Ποσοστό αποδοχής",
    completed: "Συμφωνίες που ολοκληρώθηκαν",
    spent: "Συνολικό ποσό",
    average: "Μέσο κόστος ανά συνεργασία",
    campaigns: "Ενεργές καμπάνιες",
    creators: "Μοναδικοί creators",
    chart: "Τελευταίοι 6 μήνες",
    chartProposals: "Προτάσεις",
    chartAmounts: "Ποσά",
    table: "Τελευταίες συνεργασίες",
    creator: "Creator",
    amount: "Ποσό",
    status: "Κατάσταση",
    date: "Ημερομηνία",
    deadline: "Προθεσμία δημοσίευσης",
    deadlineOpen: "κατόπιν συνεννόησης",
    emptyTable: "Δεν υπάρχουν αποδεκτές συνεργασίες ακόμα.",
    emptyTitle: "Δεν υπάρχουν στατιστικά ακόμα",
    emptyBody: "Όταν στείλεις την πρώτη πρόταση ή δημοσιεύσεις καμπάνια, τα σύνολα θα εμφανιστούν εδώ.",
    browse: "Αναζήτηση creators",
    loading: "Φόρτωση...",
    error: "Τα στατιστικά δεν φορτώθηκαν.",
    retry: "Δοκίμασε ξανά",
    of: "από",
    statuses: {
      pending: "Εκκρεμεί",
      accepted: "Αποδεκτή",
      completed: "Ολοκληρώθηκε",
      rejected: "Απορρίφθηκε",
    } as Record<string, string>,
  },
  en: {
    title: "Statistics",
    lead: "From your proposals and campaigns.",
    sent: "Proposals sent",
    accepted: "Accepted",
    rate: "Acceptance rate",
    completed: "Completed agreements",
    spent: "Total spent",
    average: "Average cost per collaboration",
    campaigns: "Active campaigns",
    creators: "Unique creators",
    chart: "Last 6 months",
    chartProposals: "Proposals",
    chartAmounts: "Amounts",
    table: "Recent collaborations",
    creator: "Creator",
    amount: "Amount",
    status: "Status",
    date: "Date",
    deadline: "Publication deadline",
    deadlineOpen: "to be agreed",
    emptyTable: "No accepted collaborations yet.",
    emptyTitle: "No statistics yet",
    emptyBody: "Once you send a proposal or publish a campaign, the totals will show up here.",
    browse: "Find creators",
    loading: "Loading...",
    error: "Statistics could not be loaded.",
    retry: "Try again",
    of: "of",
    statuses: {
      pending: "Pending",
      accepted: "Accepted",
      completed: "Completed",
      rejected: "Rejected",
    } as Record<string, string>,
  },
} as const;

function euros(amount: number | null, lang: "el" | "en"): string {
  if (amount == null) return "—";
  return formatEuro(amount, lang, 0);
}

function monthLabel(key: string, lang: "el" | "en"): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString(lang === "el" ? "el-GR" : "en-GB", {
    month: "short",
    timeZone: "UTC",
  });
}

function Bars({ months, lang }: { months: BrandMonthStat[]; lang: "el" | "en" }) {
  const copy = COPY[lang];
  const maxProposals = Math.max(1, ...months.map((month) => month.proposals));
  const maxAmount = Math.max(1, ...months.map((month) => month.amount));
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{copy.chart}</h2>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-slate-900" />
            {copy.chartProposals}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
            {copy.chartAmounts}
          </span>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-6 gap-2 sm:gap-4">
        {months.map((month) => (
          <div key={month.key} className="flex min-w-0 flex-col items-center">
            <div className="flex h-36 w-full items-end justify-center gap-1">
              <div
                className="w-3 rounded-t bg-slate-900 sm:w-4"
                style={{ height: `${Math.max(4, (month.proposals / maxProposals) * 100)}%` }}
                title={`${copy.chartProposals}: ${month.proposals}`}
              />
              <div
                className="w-3 rounded-t bg-blue-500 sm:w-4"
                style={{ height: `${Math.max(4, (month.amount / maxAmount) * 100)}%` }}
                title={`${copy.chartAmounts}: ${euros(month.amount, lang)}`}
              />
            </div>
            <p className="mt-2 text-xs font-medium text-slate-700">{month.proposals}</p>
            <p className="max-w-full truncate text-[11px] text-slate-500">{euros(month.amount, lang)}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{monthLabel(month.key, lang)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function BrandStatisticsPanel({
  lang,
  onBrowse,
}: {
  lang: "el" | "en";
  onBrowse: () => void;
}) {
  const copy = COPY[lang];
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const response = await sessionFetch("/api/brand/statistics", { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "failed");
        if (!cancelled) setData(body as Payload);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (loading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" aria-busy="true" />;
  }
  if (error || !data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">{copy.error}</p>
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-5 text-sm font-medium text-white"
        >
          {copy.retry}
        </button>
      </div>
    );
  }

  if (data.sent === 0 && data.totalCampaigns === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
        <h2 className="text-xl font-semibold text-slate-900">{copy.emptyTitle}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">{copy.emptyBody}</p>
        <button
          type="button"
          onClick={onBrowse}
          className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {copy.browse}
        </button>
      </div>
    );
  }

  const cards = [
    { label: copy.sent, value: String(data.sent) },
    { label: copy.accepted, value: String(data.accepted) },
    { label: copy.rate, value: data.acceptanceRate == null ? "—" : `${data.acceptanceRate}%` },
    { label: copy.completed, value: String(data.completedAgreements) },
    { label: copy.spent, value: euros(data.spent, lang) },
    { label: copy.average, value: euros(data.average, lang) },
    { label: copy.campaigns, value: `${data.activeCampaigns} ${copy.of} ${data.totalCampaigns}` },
    { label: copy.creators, value: String(data.uniqueCreators) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">{copy.title}</h2>
        <p className="mt-1 text-sm text-slate-500">{copy.lead}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>
      <Bars months={data.months} lang={lang} />
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-5 py-4 text-lg font-semibold text-slate-900">{copy.table}</h2>
        {data.collaborations.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-600">{copy.emptyTable}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">{copy.creator}</th>
                  <th className="px-5 py-3 font-medium">{copy.amount}</th>
                  <th className="px-5 py-3 font-medium">{copy.status}</th>
                  <th className="px-5 py-3 font-medium">{copy.date}</th>
                  <th className="px-5 py-3 font-medium">{copy.deadline}</th>
                </tr>
              </thead>
              <tbody>
                {data.collaborations.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-medium text-slate-900">{row.creator || "—"}</td>
                    <td className="px-5 py-3 tabular-nums text-slate-700">{euros(row.amount, lang)}</td>
                    <td className="px-5 py-3 text-slate-700">{copy.statuses[row.status] || row.status}</td>
                    <td className="px-5 py-3 text-slate-600">{row.date ? formatDate(row.date, lang) : "—"}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {row.deadline ? formatDate(row.deadline, lang) : copy.deadlineOpen}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
