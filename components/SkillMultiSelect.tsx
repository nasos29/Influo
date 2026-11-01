"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SKILLS, skillLabel } from "@/lib/skills";

export default function SkillMultiSelect({
  lang,
  selected,
  onChange,
  placeholder,
  ariaLabel,
}: {
  lang: "el" | "en";
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const labels = SKILLS.map((key) => ({ key, label: skillLabel(key, lang) || key }));
  const chosen = labels.filter((item) => selected.includes(item.key));
  const summary = chosen.length === 0
    ? placeholder
    : chosen.length === 1
      ? chosen[0].label
      : `${chosen[0].label} +${chosen.length - 1}`;

  const toggle = (key: string) => {
    const next = selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key];
    onChange(SKILLS.filter((item) => next.includes(item)));
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center rounded-lg border border-slate-200 bg-white px-3 text-left text-sm text-slate-800 outline-none transition-colors hover:border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
      >
        <span className={`min-w-0 flex-1 truncate ${chosen.length ? "" : "text-slate-400"}`}>{summary}</span>
        <span className="ml-2 shrink-0 text-xs text-slate-400" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div
          id={panelId}
          role="group"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
        >
          {labels.map((item) => (
            <label
              key={item.key}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-800 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(item.key)}
                onChange={() => toggle(item.key)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="min-w-0">{item.label}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
