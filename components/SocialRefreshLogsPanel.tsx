"use client";

import { useEffect, useState } from "react";

type Run = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  influencers_total: number;
  influencers_ok: number;
  influencers_unapproved: number;
  message: string | null;
};

type LogRow = {
  id: string;
  created_at: string;
  level: string;
  influencer_name: string | null;
  platform: string | null;
  username: string | null;
  event: string;
  message: string;
};

export default function SocialRefreshLogsPanel({ lang }: { lang: "el" | "en" }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retentionDays, setRetentionDays] = useState(45);

  const load = async (runId?: string) => {
    setLoading(true);
    setError("");
    try {
      const qs = runId ? `?runId=${encodeURIComponent(runId)}` : "";
      const res = await fetch(`/api/admin/social-refresh-logs${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load logs");
      setRuns(data.runs ?? []);
      setLogs(data.logs ?? []);
      setSelectedRunId(data.selectedRunId || runId || data.runs?.[0]?.id || "");
      if (data.retentionDays) setRetentionDays(data.retentionDays);
      if (data.setupRequired) setError(data.error || "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const statusLabel = (status: string) => {
    if (lang === "el") {
      if (status === "running") return "Σε εξέλιξη";
      if (status === "completed") return "Ολοκληρώθηκε";
      if (status === "aborted") return "Σταμάτησε (session)";
      if (status === "failed") return "Αποτυχία";
    }
    return status;
  };

  return (
    <div className="p-4 space-y-4 text-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            {lang === "el" ? "Ανανέωση social stats (Oracle, κάθε 15 μέρες)" : "Social stats refresh (Oracle, every 15 days)"}
          </h3>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            {lang === "el"
              ? "Τρέχει στο Oracle AuditPro, όχι τοπικά. Αν ένα προφίλ βγάλει error, ο influencer αποεγκρίνεται. Αν πεθάνουν τα Instagram/TikTok session, η διαδικασία σταματά. Τα logs διαγράφονται αυτόματα μετά από "
              : "Runs on Oracle AuditPro, not locally. One profile error unapproves that influencer. Dead Instagram/TikTok sessions abort the whole run. Logs auto-delete after "}
            {retentionDays}
            {lang === "el" ? " ημέρες." : " days."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(selectedRunId)}
          className="px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          {lang === "el" ? "Ανανέωση" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</div>
      )}

      {loading && !runs.length ? (
        <p className="text-slate-600">{lang === "el" ? "Φόρτωση..." : "Loading..."}</p>
      ) : runs.length === 0 ? (
        <p className="text-slate-600">
          {lang === "el" ? "Δεν υπάρχει ακόμα κάποιο run." : "No runs yet."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-4">{lang === "el" ? "Έναρξη" : "Started"}</th>
                <th className="py-2 pr-4">{lang === "el" ? "Κατάσταση" : "Status"}</th>
                <th className="py-2 pr-4">OK</th>
                <th className="py-2 pr-4">{lang === "el" ? "Αποεγκρίσεις" : "Unapproved"}</th>
                <th className="py-2 pr-4">{lang === "el" ? "Σύνολο" : "Total"}</th>
                <th className="py-2">{lang === "el" ? "Σχόλιο" : "Note"}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className={`border-b border-slate-100 cursor-pointer ${selectedRunId === run.id ? "bg-slate-50" : "hover:bg-slate-50"}`}
                  onClick={() => load(run.id)}
                >
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {new Date(run.started_at).toLocaleString(lang === "el" ? "el-GR" : "en-GB")}
                  </td>
                  <td className="py-2 pr-4">{statusLabel(run.status)}</td>
                  <td className="py-2 pr-4">{run.influencers_ok}</td>
                  <td className="py-2 pr-4">{run.influencers_unapproved}</td>
                  <td className="py-2 pr-4">{run.influencers_total}</td>
                  <td className="py-2 text-slate-600">{run.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRunId && (
        <div>
          <h4 className="text-sm font-semibold mb-2">
            {lang === "el" ? "Λεπτομέρειες run" : "Run details"}
          </h4>
          <div className="max-h-[480px] overflow-auto rounded-lg border border-slate-200 bg-slate-50">
            {logs.length === 0 ? (
              <p className="p-3 text-sm text-slate-600">{lang === "el" ? "Δεν υπάρχουν γραμμές." : "No log lines."}</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {logs.map((row) => (
                  <li key={row.id} className="px-3 py-2 text-sm">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>{new Date(row.created_at).toLocaleString(lang === "el" ? "el-GR" : "en-GB")}</span>
                      <span className={row.level === "error" ? "text-red-700 font-medium" : row.level === "warn" ? "text-amber-700" : ""}>
                        {row.level} · {row.event}
                      </span>
                      {row.influencer_name && <span>{row.influencer_name}</span>}
                      {row.platform && (
                        <span>
                          {row.platform}
                          {row.username ? ` @${row.username}` : ""}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-slate-800">{row.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
