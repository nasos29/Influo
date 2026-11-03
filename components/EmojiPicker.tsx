"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { EMOJI_CATEGORIES, emojiOf, pushRecent, RECENT_KEY, searchEmojis } from "@/lib/emojiData";

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 24) : [];
  } catch {
    return [];
  }
}

export default function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const [recent, setRecent] = useState<string[]>(readRecent);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>(() => (readRecent().length ? "recent" : "smileys"));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current && !ref.current.contains(t) && !t.closest("[data-emoji-toggle]")) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const list = useMemo(() => {
    if (query.trim()) return searchEmojis(query);
    if (cat === "recent") return recent;
    return (EMOJI_CATEGORIES.find((c) => c.id === cat)?.items || []).map(emojiOf);
  }, [query, cat, recent]);

  const pick = (e: string) => {
    const next = pushRecent(readRecent(), e);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
    setRecent(next);
    onPick(e);
  };

  const tabs = [...(recent.length ? [{ id: "recent", label: "Πρόσφατα", icon: "🕘" }] : []), ...EMOJI_CATEGORIES];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 sm:hidden" aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-label="Emoji"
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-slate-200 bg-white shadow-2xl pb-[env(safe-area-inset-bottom)] sm:absolute sm:inset-x-auto sm:bottom-full sm:left-0 sm:mb-2 sm:w-[22rem] sm:rounded-2xl sm:pb-0"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300 sm:hidden" aria-hidden />
        <div className="p-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Αναζήτηση emoji"
            aria-label="Αναζήτηση emoji"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
          />
        </div>
        <div className="h-64 overflow-y-auto overscroll-contain px-2 sm:h-56">
          {list.length ? (
            <div className="grid grid-cols-8 gap-0.5">
              {list.map((e) => (
                <button key={e} type="button" onClick={() => pick(e)} className="flex h-10 items-center justify-center rounded-lg text-2xl leading-none hover:bg-slate-100 active:scale-90 transition-transform" aria-label={e}>
                  {e}
                </button>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">Δεν βρέθηκαν emoji</p>
          )}
        </div>
        {!query.trim() && (
          <div className="flex justify-between border-t border-slate-100 px-1 py-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.label}
                aria-label={t.label}
                onClick={() => setCat(t.id)}
                className={`flex h-9 flex-1 items-center justify-center rounded-lg text-lg ${cat === t.id ? "bg-slate-100" : "opacity-60 hover:opacity-100"}`}
              >
                {t.icon}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
