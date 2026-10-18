"use client";

import { useState } from "react";

function splitYmd(ymd: string): { d: string; m: string; y: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return { d: "", m: "", y: "" };
  return { y: match[1], m: match[2], d: match[3] };
}

function composeYmd(d: string, m: string, y: string): string {
  if (d.length !== 2 || m.length !== 2 || y.length !== 4) return "";
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (!day || !month || !year) return "";
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "";
  return `${y}-${m}-${d}`;
}

/**
 * Day, then month, then year. The value stored by the parent is YYYY-MM-DD.
 * Native date inputs follow the browser locale and were showing month/day/year.
 */
export default function DmyDateField({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (ymd: string) => void;
  required?: boolean;
}) {
  const [parts, setParts] = useState(() => splitYmd(value));
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    const current = composeYmd(parts.d, parts.m, parts.y);
    setSynced(value);
    if (value !== current && (value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value))) {
      setParts(splitYmd(value));
    }
  }

  const change = (key: "d" | "m" | "y", raw: string, max: number) => {
    const cleaned = raw.replace(/\D/g, "").slice(0, max);
    const next = { ...parts, [key]: cleaned };
    const composed = composeYmd(next.d, next.m, next.y);
    setParts(next);
    setSynced(composed);
    onChange(composed);
  };

  const inputClass =
    "mt-1 w-full px-2 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white text-center tabular-nums";

  return (
    <div className="grid grid-cols-3 gap-2">
      <label className="block text-xs text-slate-500">
        DD
        <input
          inputMode="numeric"
          autoComplete="bday-day"
          required={required}
          placeholder="15"
          aria-label="Day"
          value={parts.d}
          onChange={(e) => change("d", e.target.value, 2)}
          className={inputClass}
        />
      </label>
      <label className="block text-xs text-slate-500">
        MM
        <input
          inputMode="numeric"
          autoComplete="bday-month"
          required={required}
          placeholder="11"
          aria-label="Month"
          value={parts.m}
          onChange={(e) => change("m", e.target.value, 2)}
          className={inputClass}
        />
      </label>
      <label className="block text-xs text-slate-500">
        YYYY
        <input
          inputMode="numeric"
          autoComplete="bday-year"
          required={required}
          placeholder="2026"
          aria-label="Year"
          value={parts.y}
          onChange={(e) => change("y", e.target.value, 4)}
          className={inputClass}
        />
      </label>
    </div>
  );
}
