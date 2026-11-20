"use client";

import { useMemo, useState } from "react";
import { parsePublishDeadline } from "@/lib/publishDeadline";

function addDaysUtc(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Lang = "el" | "en";

const COPY = {
  el: {
    label: "Προθεσμία δημοσίευσης",
    required: "Επιλέξτε προθεσμία δημοσίευσης πριν την αποδοχή.",
    pick7: "+7 ημέρες",
    pick14: "+14 ημέρες",
    pick30: "+30 ημέρες",
    custom: "Συγκεκριμένη ημερομηνία",
  },
  en: {
    label: "Publication deadline",
    required: "Choose a publication deadline before accepting.",
    pick7: "+7 days",
    pick14: "+14 days",
    pick30: "+30 days",
    custom: "Specific date",
  },
} as const;

export default function PublishDeadlinePicker({
  lang,
  value,
  onChange,
  required = false,
}: {
  lang: Lang;
  value: string;
  onChange: (isoDate: string) => void;
  required?: boolean;
}) {
  const copy = COPY[lang];
  const [mode, setMode] = useState<"quick" | "custom">("quick");
  const valid = useMemo(() => parsePublishDeadline(value), [value]);

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-medium text-slate-800">
        {copy.label}
        {required ? <span className="text-red-600"> *</span> : null}
      </p>
      <div className="flex flex-wrap gap-2">
        {[7, 14, 30].map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => {
              setMode("quick");
              onChange(addDaysUtc(days));
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
          >
            {days === 7 ? copy.pick7 : days === 14 ? copy.pick14 : copy.pick30}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMode("custom")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
            mode === "custom" ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-300 bg-white text-slate-800"
          }`}
        >
          {copy.custom}
        </button>
      </div>
      {mode === "custom" ? (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      ) : value ? (
        <p className="text-xs text-slate-600 tabular-nums">{value}</p>
      ) : required ? (
        <p className="text-xs text-amber-700">{copy.required}</p>
      ) : null}
      {value && !valid.ok ? (
        <p className="text-xs text-red-600">{lang === "el" ? "Μη έγκυρη ημερομηνία." : "Invalid date."}</p>
      ) : null}
    </div>
  );
}
