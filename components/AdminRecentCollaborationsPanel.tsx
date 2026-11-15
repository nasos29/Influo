"use client";

import { useCallback, useEffect, useState } from "react";
import { sessionFetch } from "@/lib/sessionFetch";

type Lang = "el" | "en";
type Source = "proposal" | "campaign";

type Item = {
  id: string;
  source: Source;
  brandName: string;
  influencerId: string;
  postUrl: string | null;
  completedAt: string | null;
  hidden: boolean;
  pinned: boolean;
};

const COPY = {
  el: {
    title: "Πρόσφατες συνεργασίες (public)",
    empty: "Δεν υπάρχουν συνεργασίες με διπλή συναίνεση ακόμα.",
    pin: "Καρφίτσωμα",
    unpin: "Ξεκαρφίτσωμα",
    hide: "Απόκρυψη",
    show: "Εμφάνιση",
    loadError: "Αποτυχία φόρτωσης.",
    publicNote: "Δημόσια εμφανίζονται μόνο όσες έχουν συναίνεση και από τις δύο πλευρές και δεν είναι κρυφές.",
  },
  en: {
    title: "Recent collaborations (public)",
    empty: "No dual-consent collaborations yet.",
    pin: "Pin",
    unpin: "Unpin",
    hide: "Hide",
    show: "Show",
    loadError: "Failed to load.",
    publicNote: "Public listing requires both consents and not being hidden by admin.",
  },
} as const;

export default function AdminRecentCollaborationsPanel({ lang }: { lang: Lang }) {
  const txt = COPY[lang];
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await sessionFetch("/api/admin/collaborations/showcase?includeHidden=1");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : txt.loadError);
        setItems([]);
        return;
      }
      setItems(Array.isArray(body.items) ? body.items : []);
    } catch {
      setError(txt.loadError);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [txt.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (item: Item, patchBody: { hidden?: boolean; pinned?: boolean }) => {
    const key = `${item.source}:${item.id}`;
    setBusyId(key);
    try {
      const res = await sessionFetch("/api/admin/collaborations/showcase", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: item.source, id: item.id, ...patchBody }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : txt.loadError);
        return;
      }
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id && row.source === item.source
            ? {
                ...row,
                hidden: typeof patchBody.hidden === "boolean" ? patchBody.hidden : row.hidden,
                pinned: typeof patchBody.pinned === "boolean" ? patchBody.pinned : row.pinned,
              }
            : row
        )
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{txt.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{txt.publicNote}</p>
      </div>
      {loading ? <p className="text-sm text-slate-500">…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loading && items.length === 0 ? (
        <p className="text-sm text-slate-500">{txt.empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {items.map((item) => {
            const key = `${item.source}:${item.id}`;
            const busy = busyId === key;
            return (
              <li key={key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {item.brandName}{" "}
                    <span className="text-xs font-normal text-slate-500">
                      · {item.source}
                      {item.pinned ? " · pinned" : ""}
                      {item.hidden ? " · hidden" : ""}
                    </span>
                  </p>
                  {item.postUrl ? (
                    <a
                      href={item.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block truncate text-xs text-blue-700 hover:underline"
                    >
                      {item.postUrl}
                    </a>
                  ) : (
                    <p className="mt-0.5 text-xs text-slate-400">—</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void patch(item, { pinned: !item.pinned })}
                    className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {item.pinned ? txt.unpin : txt.pin}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void patch(item, { hidden: !item.hidden })}
                    className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {item.hidden ? txt.show : txt.hide}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
