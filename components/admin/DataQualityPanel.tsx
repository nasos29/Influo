"use client";

import { useState } from "react";
import { dataQualityEmailTemplate, type DataQualityFlag } from "@/lib/creatorDataQuality";

export type DataQualityMap = Record<string, { name: string; flags: DataQualityFlag[] }>;

export function DataQualityBadge({ flags }: { flags?: DataQualityFlag[] }) {
  if (!flags?.length) return null;
  return (
    <span title={flags.map((f) => f.message).join("\n")} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
      ⚠ {flags.length}
    </span>
  );
}

function EmailModal({
  influencerId,
  name,
  flag,
  headers,
  onClose,
}: {
  influencerId: string;
  name: string;
  flag: DataQualityFlag;
  headers: () => Promise<Record<string, string>>;
  onClose: () => void;
}) {
  const tpl = dataQualityEmailTemplate(flag.code, name, flag);
  const [subject, setSubject] = useState(tpl.subject);
  const [text, setText] = useState(tpl.body);
  const [state, setState] = useState<"idle" | "sending" | "sent" | string>("idle");
  const send = async () => {
    if (!window.confirm("Αποστολή του email στον δημιουργό;")) return;
    setState("sending");
    const res = await fetch("/api/admin/influencers/data-quality/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await headers()) },
      body: JSON.stringify({ influencerId, subject, text }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setState(res.ok ? "sent" : body.error || "Σφάλμα αποστολής");
  };
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-slate-900">Email προς {name}</h3>
        <p className="text-xs text-slate-500">Ελέγξτε και διορθώστε το κείμενο. Τίποτα δεν στέλνεται αυτόματα.</p>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={14} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono" />
        <div className="flex items-center gap-2">
          <button type="button" disabled={state === "sending" || state === "sent"} onClick={() => void send()} className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-50">
            {state === "sending" ? "Αποστολή…" : state === "sent" ? "Στάλθηκε ✓" : "Αποστολή"}
          </button>
          <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm">Κλείσιμο</button>
          {state !== "idle" && state !== "sending" && state !== "sent" && <span className="text-sm text-red-600">{state}</span>}
        </div>
      </div>
    </div>
  );
}

/** Warning notes for one creator, each with a manual "send email" draft. */
export function DataQualityNotes({
  influencerId,
  name,
  flags,
  headers,
}: {
  influencerId: string;
  name: string;
  flags: DataQualityFlag[];
  headers: () => Promise<Record<string, string>>;
}) {
  const [open, setOpen] = useState<DataQualityFlag | null>(null);
  if (!flags.length) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
      <p className="text-xs font-semibold uppercase text-amber-800">Προειδοποιήσεις δεδομένων</p>
      {flags.map((f, i) => (
        <div key={i} className="flex flex-wrap items-start justify-between gap-2 text-sm text-amber-900">
          <span className="min-w-0 flex-1">{f.message}</span>
          <button type="button" onClick={() => setOpen(f)} className="shrink-0 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100">
            Αποστολή email
          </button>
        </div>
      ))}
      {open && <EmailModal influencerId={influencerId} name={name} flag={open} headers={headers} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Admin list panel: every creator with warnings (all pages). */
export function DataQualityList({ map, headers }: { map: DataQualityMap; headers: () => Promise<Record<string, string>> }) {
  const entries = Object.entries(map).sort((a, b) => b[1].flags.length - a[1].flags.length);
  if (!entries.length) return <p className="text-sm text-slate-500">Καμία προειδοποίηση.</p>;
  return (
    <div className="space-y-3">
      {entries.map(([id, v]) => (
        <div key={id}>
          <p className="mb-1 text-sm font-semibold text-slate-900">{v.name}</p>
          <DataQualityNotes influencerId={id} name={v.name} flags={v.flags} headers={headers} />
        </div>
      ))}
    </div>
  );
}
