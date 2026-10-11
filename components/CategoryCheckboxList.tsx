"use client";

import {
  CATEGORIES,
  GENERAL_CATEGORY,
  categoryTranslations,
  formatCategoryLabels,
  isGeneralCategory,
  parseStoredCategories,
} from "@/lib/categories";

type Lang = "el" | "en";

type Props = {
  lang: Lang;
  selected: string[];
  onChange: (next: string[]) => void;
  label?: string;
  description?: string;
  /** When the last box is cleared, keep this key instead of an empty list. */
  emptyFallback?: string;
  compact?: boolean;
};

export default function CategoryCheckboxList({
  lang,
  selected,
  onChange,
  label,
  description,
  emptyFallback,
  compact = false,
}: Props) {
  const selectedKeys = parseStoredCategories(selected);
  const labelClass = "block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2";

  const apply = (next: string[]) => {
    const keys = parseStoredCategories(next);
    if (keys.length === 0 && emptyFallback) {
      onChange(parseStoredCategories([emptyFallback]));
      return;
    }
    onChange(keys);
  };

  return (
    <div>
      {label ? <label className={labelClass}>{label}</label> : null}
      {description ? <p className="text-xs text-slate-500 mb-3">{description}</p> : null}
      <div
        className={`border-2 border-slate-200 rounded-xl bg-slate-50 overflow-y-auto ${
          compact ? "p-3 max-h-48" : "p-4 max-h-64"
        }`}
      >
        <div className="space-y-2">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedKeys.includes(cat);
            const displayName = categoryTranslations[cat]?.[lang] || cat;
            return (
              <label
                key={cat}
                className={`flex items-center gap-3 rounded-lg cursor-pointer transition-all ${
                  compact ? "p-2" : "p-3"
                } ${
                  isSelected
                    ? "bg-blue-100 border-2 border-blue-500"
                    : "bg-white border-2 border-slate-200 hover:border-blue-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    if (cat === GENERAL_CATEGORY) {
                      apply(e.target.checked ? [GENERAL_CATEGORY] : []);
                      return;
                    }
                    const withoutGeneral = selectedKeys.filter((item) => !isGeneralCategory(item));
                    const next = e.target.checked
                      ? [...withoutGeneral, cat]
                      : withoutGeneral.filter((item) => item !== cat);
                    apply(next);
                  }}
                  className={`${compact ? "w-4 h-4" : "w-5 h-5"} text-blue-600 border-2 border-slate-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer`}
                />
                <span className={`font-medium ${compact ? "text-xs" : ""} ${isSelected ? "text-blue-900" : "text-slate-700"}`}>
                  {displayName}
                </span>
              </label>
            );
          })}
        </div>
      </div>
      {selectedKeys.length > 0 && (
        <p className="text-xs text-slate-600 mt-2">
          {lang === "el" ? "Επιλέχθηκαν" : "Selected"}: {formatCategoryLabels(selectedKeys, lang)}
        </p>
      )}
    </div>
  );
}
