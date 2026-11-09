"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { Check, Eye, EyeOff, GripVertical, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  HOMEPAGE_SECTION_ORDER_KEY,
  HOMEPAGE_SECTION_REGISTRY,
  defaultHomepageSectionOrder,
  mergeHomepageSectionOrder,
  type HomepageSectionDef,
  type HomepageSectionId,
} from "@/lib/homepageSections";

type Lang = "el" | "en";

const copy = {
  el: {
    title: "Σειρά sections αρχικής",
    desc: "Σύρετε ή χρησιμοποιήστε ↑↓ για να αλλάξετε τη σειρά των sections στην αρχική. Νέα sections από τον κώδικα εμφανίζονται αυτόματα.",
    save: "Αποθήκευση σειράς",
    saving: "Αποθήκευση…",
    saved: "Αποθηκεύτηκε",
    reset: "Επαναφορά προεπιλογής",
    moveUp: "Πάνω",
    moveDown: "Κάτω",
    show: "Εμφάνιση",
    hide: "Απόκρυψη",
    hidden: "Κρυφό",
    loadError: "Αποτυχία φόρτωσης σειράς sections.",
    saveError: "Αποτυχία αποθήκευσης σειράς.",
  },
  en: {
    title: "Homepage section order",
    desc: "Drag or use ↑↓ to reorder homepage sections. New code sections appear here automatically.",
    save: "Save order",
    saving: "Saving…",
    saved: "Saved",
    reset: "Reset to default",
    moveUp: "Move up",
    moveDown: "Move down",
    show: "Show",
    hide: "Hide",
    hidden: "Hidden",
    loadError: "Failed to load section order.",
    saveError: "Failed to save section order.",
  },
} as const;

async function adminAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function sameIdList(a: HomepageSectionId[], b: HomepageSectionId[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

export default function AdminHomepageSectionOrderPanel({ lang }: { lang: Lang }) {
  const t = copy[lang];
  const [order, setOrder] = useState<HomepageSectionId[]>(() => defaultHomepageSectionOrder());
  const [hidden, setHidden] = useState<HomepageSectionId[]>([]);
  const [savedOrder, setSavedOrder] = useState<HomepageSectionId[]>(() => defaultHomepageSectionOrder());
  const [savedHidden, setSavedHidden] = useState<HomepageSectionId[]>([]);
  const [registry] = useState<readonly HomepageSectionDef[]>(() => HOMEPAGE_SECTION_REGISTRY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<HomepageSectionId | null>(null);

  const defById = useMemo(() => {
    const map = new Map<HomepageSectionId, HomepageSectionDef>();
    for (const def of registry) map.set(def.id, def);
    return map;
  }, [registry]);

  const dirty =
    !sameIdList(order, savedOrder) || !sameIdList([...hidden].sort(), [...savedHidden].sort());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", { headers: await adminAuthHeaders() });
      if (!res.ok) throw new Error(t.loadError);
      const data = (await res.json()) as {
        homepage_section_order?: HomepageSectionId[];
        homepage_section_hidden?: HomepageSectionId[];
      };
      const nextOrder = mergeHomepageSectionOrder(data.homepage_section_order);
      const nextHidden = (data.homepage_section_hidden || []).filter((id) =>
        nextOrder.includes(id)
      ) as HomepageSectionId[];
      setOrder(nextOrder);
      setHidden(nextHidden);
      setSavedOrder(nextOrder);
      setSavedHidden(nextHidden);
    } catch {
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!justSaved) return;
    const id = window.setTimeout(() => setJustSaved(false), 1600);
    return () => window.clearTimeout(id);
  }, [justSaved]);

  function move(id: HomepageSectionId, dir: -1 | 1) {
    setOrder((prev) => {
      const i = prev.indexOf(id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[i]!;
      next[i] = next[j]!;
      next[j] = tmp;
      return next;
    });
  }

  function toggleHidden(id: HomepageSectionId) {
    setHidden((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function onDragStart(id: HomepageSectionId) {
    setDragId(id);
  }

  function onDragOver(e: DragEvent, overId: HomepageSectionId) {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    setOrder((prev) => {
      const from = prev.indexOf(dragId);
      const to = prev.indexOf(overId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      next.splice(from, 1);
      next.splice(to, 0, dragId);
      return next;
    });
  }

  function onDragEnd() {
    setDragId(null);
  }

  async function save(reset = false) {
    setBusy(true);
    setError(null);
    try {
      const body = reset
        ? { key: HOMEPAGE_SECTION_ORDER_KEY, reset: true }
        : {
            key: HOMEPAGE_SECTION_ORDER_KEY,
            value: order,
            hidden,
          };
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await adminAuthHeaders()),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t.saveError);
      const nextOrder = mergeHomepageSectionOrder(data.homepage_section_order);
      const nextHidden = (data.homepage_section_hidden || []) as HomepageSectionId[];
      setOrder(nextOrder);
      setHidden(nextHidden);
      setSavedOrder(nextOrder);
      setSavedHidden(nextHidden);
      setJustSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="homepage-section-order-heading"
      className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2
            id="homepage-section-order-heading"
            className="text-[11px] font-semibold uppercase tracking-wider text-slate-500"
          >
            {t.title}
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">{t.desc}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {justSaved ? (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700"
              role="status"
            >
              <Check className="h-3 w-3" aria-hidden />
              {t.saved}
            </span>
          ) : null}
          {error ? (
            <span className="rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700" role="alert">
              {error}
            </span>
          ) : null}
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void save(true)}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            title={t.reset}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {t.reset}
          </button>
          <button
            type="button"
            disabled={busy || loading || !dirty}
            onClick={() => void save(false)}
            className="inline-flex h-9 cursor-pointer items-center rounded-md bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? t.saving : t.save}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">{lang === "el" ? "Φόρτωση…" : "Loading…"}</p>
      ) : (
        <ol className="space-y-1.5">
          {order.map((id, index) => {
            const def = defById.get(id);
            if (!def) return null;
            const isHidden = hidden.includes(id);
            return (
              <li
                key={id}
                draggable
                onDragStart={() => onDragStart(id)}
                onDragOver={(e) => onDragOver(e, id)}
                onDragEnd={onDragEnd}
                className={[
                  "flex items-stretch gap-1 rounded-md border bg-slate-50/80 transition-colors",
                  dragId === id ? "border-blue-300 bg-blue-50/60 opacity-90" : "border-slate-200",
                  isHidden ? "opacity-60" : "",
                ].join(" ")}
              >
                <button
                  type="button"
                  className="inline-flex cursor-grab items-center px-2 text-slate-400 active:cursor-grabbing"
                  aria-label="Drag"
                  tabIndex={-1}
                >
                  <GripVertical className="h-4 w-4" aria-hidden />
                </button>
                <div className="min-w-0 flex-1 py-2 pr-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium tabular-nums text-slate-400">
                      {index + 1}.
                    </span>
                    <span className="text-sm font-semibold text-slate-900">{def.title[lang]}</span>
                    {isHidden ? (
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        {t.hidden}
                      </span>
                    ) : null}
                    {def.optional ? (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                        optional
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{def.description[lang]}</p>
                </div>
                <div className="flex items-center gap-1 pr-2">
                  <button
                    type="button"
                    aria-label={isHidden ? t.show : t.hide}
                    title={isHidden ? t.show : t.hide}
                    disabled={busy}
                    onClick={() => toggleHidden(id)}
                    className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    aria-label={t.moveUp}
                    disabled={busy || index === 0}
                    onClick={() => move(id, -1)}
                    className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-slate-200 text-sm font-bold text-slate-800 hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={t.moveDown}
                    disabled={busy || index >= order.length - 1}
                    onClick={() => move(id, 1)}
                    className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-slate-200 text-sm font-bold text-slate-800 hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    ↓
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
