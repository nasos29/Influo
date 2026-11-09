"use client";

import { useCallback, useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  SITE_SETTING_KEYS,
  SITE_SETTING_META,
  type SiteSettingKey,
  type SiteSettingMeta,
  type SiteSettings,
} from "@/lib/siteSettings";
import { getStoredLanguage, setStoredLanguage } from "@/lib/language";

type Lang = "el" | "en";

const copy = {
  el: {
    title: "Ρυθμίσεις ιστοτόπου",
    sub: "Τιμές εμφάνισης και κύκλου ζωής — με ασφαλή προεπιλογές.",
    back: "Πίσω στο admin",
    save: "Αποθήκευση",
    reset: "Επαναφορά",
    saving: "Αποθήκευση…",
    saved: "Αποθηκεύτηκε.",
    range: (min: number, max: number, def: number) =>
      `Εύρος ${min}–${max}. Προεπιλογή ${def}.`,
    loadError: "Αποτυχία φόρτωσης ρυθμίσεων.",
    saveError: "Αποτυχία αποθήκευσης.",
  },
  en: {
    title: "Site settings",
    sub: "Display and lifecycle knobs — safe defaults until you change them.",
    back: "Back to admin",
    save: "Save",
    reset: "Reset",
    saving: "Saving…",
    saved: "Saved.",
    range: (min: number, max: number, def: number) =>
      `Range ${min}–${max}. Default ${def}.`,
    loadError: "Failed to load settings.",
    saveError: "Failed to save.",
  },
} as const;

async function adminAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AdminSettingsPage() {
  const [lang, setLang] = useState<Lang>("el");
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [draft, setDraft] = useState<Partial<Record<SiteSettingKey, string>>>({});
  const [meta] = useState<SiteSettingMeta[]>(
    SITE_SETTING_KEYS.map((key) => SITE_SETTING_META[key])
  );
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = copy[lang];

  useEffect(() => {
    setLang(getStoredLanguage());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", { headers: await adminAuthHeaders() });
      if (!res.ok) throw new Error(t.loadError);
      const data = (await res.json()) as { settings: SiteSettings };
      setSettings(data.settings);
      const next: Partial<Record<SiteSettingKey, string>> = {};
      for (const key of SITE_SETTING_KEYS) next[key] = String(data.settings[key]);
      setDraft(next);
    } catch {
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveKey(key: SiteSettingKey, reset = false) {
    if (!settings) return;
    setBusyKey(key);
    setMessage(null);
    setError(null);
    try {
      const body = reset
        ? { key, reset: true }
        : { key, value: Number(draft[key]) };
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
      const next = data.settings as SiteSettings;
      setSettings(next);
      setDraft((prev) => ({ ...prev, [key]: String(next[key]) }));
      setMessage(t.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveError);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-700" aria-hidden />
              {t.title}
            </h1>
            <p className="text-sm text-slate-500">{t.sub}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const next = lang === "el" ? "en" : "el";
                setLang(next);
                setStoredLanguage(next);
              }}
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              {lang === "el" ? "English" : "Ελληνικά"}
            </button>
            <a
              href="/admin"
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t.back}
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        {message ? (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">
            {error}
          </p>
        ) : null}

        {loading || !settings ? (
          <p className="text-slate-500">{lang === "el" ? "Φόρτωση…" : "Loading…"}</p>
        ) : (
          <ul className="space-y-4">
            {meta.map((item) => {
              const key = item.key;
              const dirty = String(settings[key]) !== String(draft[key] ?? "");
              const busy = busyKey === key;
              return (
                <li
                  key={key}
                  className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm"
                >
                  <label className="block text-sm font-semibold text-slate-900" htmlFor={`setting-${key}`}>
                    {item.label[lang]}
                  </label>
                  <p className="mt-1 text-sm text-slate-600">{item.help[lang]}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {t.range(item.min, item.max, item.default)}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      id={`setting-${key}`}
                      type="number"
                      min={item.min}
                      max={item.max}
                      step={1}
                      value={draft[key] ?? String(settings[key])}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:ring-2 focus:ring-slate-900/10"
                    />
                    <button
                      type="button"
                      disabled={busy || !dirty}
                      onClick={() => void saveKey(key)}
                      className="inline-flex min-h-10 items-center rounded-lg bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
                    >
                      {busy ? t.saving : t.save}
                    </button>
                    <button
                      type="button"
                      disabled={busy || settings[key] === item.default}
                      onClick={() => void saveKey(key, true)}
                      className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      {t.reset}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
