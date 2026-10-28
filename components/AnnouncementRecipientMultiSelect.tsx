"use client";

import { useMemo, useState } from "react";
import { MAX_ANNOUNCEMENT_SPECIFIC_RECIPIENTS } from "@/lib/announcementTargets";

export type AnnouncementRecipientOption = {
  id: string;
  label: string;
  /** Lowercased haystack for search (name/slug/email). */
  searchText: string;
  disabled?: boolean;
  disabledReason?: string;
};

type Lang = "el" | "en";

const copy = {
  el: {
    search: "Αναζήτηση ονόματος, slug ή email…",
    selected: "Επιλεγμένοι",
    clear: "Καθαρισμός",
    empty: "Κανένα αποτέλεσμα",
    max: `Μέχρι ${MAX_ANNOUNCEMENT_SPECIFIC_RECIPIENTS} παραλήπτες`,
    add: "Προσθήκη",
  },
  en: {
    search: "Search name, slug or email…",
    selected: "Selected",
    clear: "Clear",
    empty: "No results",
    max: `Up to ${MAX_ANNOUNCEMENT_SPECIFIC_RECIPIENTS} recipients`,
    add: "Add",
  },
};

export default function AnnouncementRecipientMultiSelect({
  lang,
  options,
  selectedIds,
  onChange,
  searchPlaceholder,
}: {
  lang: Lang;
  options: AnnouncementRecipientOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  searchPlaceholder?: string;
}) {
  const t = copy[lang];
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const byId = useMemo(() => {
    const map = new Map<string, AnnouncementRecipientOption>();
    for (const opt of options) map.set(opt.id, opt);
    return map;
  }, [options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = options.filter((o) => o.id && !selectedSet.has(o.id));
    if (!q) return list.slice(0, 40);
    return list
      .filter((o) => o.searchText.includes(q) || o.label.toLowerCase().includes(q))
      .slice(0, 40);
  }, [options, query, selectedSet]);

  const atLimit = selectedIds.length >= MAX_ANNOUNCEMENT_SPECIFIC_RECIPIENTS;

  const addId = (id: string) => {
    if (!id || selectedSet.has(id) || atLimit) return;
    const opt = byId.get(id);
    if (opt?.disabled) return;
    onChange([...selectedIds, id]);
  };

  const removeId = (id: string) => {
    onChange(selectedIds.filter((x) => x !== id));
  };

  return (
    <div className="flex flex-col gap-2 max-w-xl">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
        <span className="font-medium">
          {t.selected}: {selectedIds.length}
        </span>
        <span className="text-slate-500">({t.max})</span>
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            {t.clear}
          </button>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const opt = byId.get(id);
            const label = opt?.label || id;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 max-w-full rounded-full bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs text-slate-800"
              >
                <span className="truncate">{label}</span>
                <button
                  type="button"
                  aria-label={lang === "el" ? "Αφαίρεση" : "Remove"}
                  onClick={() => removeId(id)}
                  className="shrink-0 text-slate-500 hover:text-slate-900 font-bold leading-none"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder || t.search}
        disabled={atLimit}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white disabled:opacity-60"
      />

      <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-sm text-slate-500">{t.empty}</div>
        ) : (
          filtered.map((opt) => {
            const disabled = !!opt.disabled || atLimit;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() => addId(opt.id)}
                className="w-full text-left px-3 py-2 text-sm text-slate-900 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="font-medium">{opt.label}</span>
                {opt.disabledReason ? (
                  <span className="ml-2 text-xs text-slate-500">{opt.disabledReason}</span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
