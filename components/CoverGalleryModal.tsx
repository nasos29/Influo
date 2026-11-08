"use client";

import { useState } from "react";
import { COVER_KEYS, COVER_KEY_CATEGORY, categoryCovers, coverKeyFor, type CoverKey } from "@/lib/campaignCovers";
import { categoryTranslations } from "@/lib/categories";

/** Pick a fixed category cover (CC0 photos shipped with the site). */
export default function CoverGalleryModal({
  category,
  lang,
  current,
  onPick,
  onClose,
}: {
  category: string | null | undefined;
  lang: "el" | "en";
  current?: string | null;
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const [key, setKey] = useState<CoverKey>(coverKeyFor(category));
  const label = (k: CoverKey) => {
    const cat = COVER_KEY_CATEGORY[k];
    return categoryTranslations[cat]?.[lang] || cat || k;
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full sm:max-w-3xl max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <h3 className="font-semibold text-slate-900">{lang === "el" ? "Επιλογή εικόνας από γκαλερί" : "Choose a gallery image"}</h3>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded-lg text-slate-500 hover:bg-slate-100" aria-label={lang === "el" ? "Κλείσιμο" : "Close"}>✕</button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto border-b border-slate-100 px-4 py-2">
          {COVER_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKey(k)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${k === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            >
              {label(k)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto p-4">
          {categoryCovers(key).map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => onPick(url)}
              className={`relative aspect-video overflow-hidden rounded-lg ring-2 ${current === url ? "ring-blue-600" : "ring-transparent hover:ring-slate-300"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
        <p className="px-4 pb-3 text-[11px] text-slate-400">{lang === "el" ? "Φωτογραφίες ελεύθερης χρήσης (CC0)." : "Free-to-use photos (CC0)."}</p>
      </div>
    </div>
  );
}
