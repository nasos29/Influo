"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Minus, Plus, RotateCcw, Settings } from "lucide-react";
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

type SettingGroupId = "layout" | "homepage" | "campaigns" | "admin";

const SETTING_GROUPS: Array<{
  id: SettingGroupId;
  keys: SiteSettingKey[];
  label: { el: string; en: string };
}> = [
  {
    id: "layout",
    keys: [
      "creator_cards_per_row_wide",
      "campaign_cards_per_row_wide",
      "blog_posts_per_row_wide",
      "filter_ui_variant",
      "campaign_card_style",
    ],
    label: { el: "Διάταξη", en: "Layout" },
  },
  {
    id: "homepage",
    keys: [
      "homepage_creators_count",
      "homepage_campaigns_count",
      "homepage_newly_approved_count",
      "homepage_top_influencers_count",
      "new_badge_max_days",
    ],
    label: { el: "Αρχική", en: "Homepage" },
  },
  {
    id: "campaigns",
    keys: [
      "campaign_default_days",
      "campaign_reminder_days_before",
      "campaign_detail_image_max_height_px",
    ],
    label: { el: "Καμπάνιες", en: "Campaigns" },
  },
  {
    id: "admin",
    keys: ["admin_notice_read_retention_days"],
    label: { el: "Admin", en: "Admin" },
  },
];

/** Compact tile titles — full labels stay in title/help. */
const SHORT_LABEL: Record<SiteSettingKey, { el: string; en: string }> = {
  creator_cards_per_row_wide: { el: "Creators / σειρά", en: "Creators / row" },
  campaign_cards_per_row_wide: { el: "Καμπάνιες / σειρά", en: "Campaigns / row" },
  blog_posts_per_row_wide: { el: "Blog / σειρά", en: "Blog / row" },
  filter_ui_variant: { el: "Φίλτρα καταλόγου", en: "Directory filters" },
  campaign_card_style: { el: "Στυλ κάρτας", en: "Card style" },
  homepage_creators_count: { el: "Creators αρχικής", en: "Home creators" },
  homepage_campaigns_count: { el: "Καμπάνιες αρχικής", en: "Home campaigns" },
  homepage_newly_approved_count: { el: "Νεοεγκεκριμένοι", en: "Newly approved" },
  homepage_top_influencers_count: { el: "Top influencers", en: "Top influencers" },
  new_badge_max_days: { el: "Badge «Νέος»", en: "“New” badge days" },
  campaign_default_days: { el: "Διάρκεια καμπάνιας", en: "Campaign duration" },
  campaign_reminder_days_before: { el: "Υπενθύμιση κλεισίματος", en: "Close reminder" },
  campaign_detail_image_max_height_px: { el: "Ύψος cover λεπτομερειών", en: "Detail cover height" },
  admin_notice_read_retention_days: { el: "Διαβασμένα notices", en: "Read notices keep" },
};

/** Compact select labels — full labels live on SITE_SETTING_META.options. */
const SHORT_OPTION: Partial<
  Record<SiteSettingKey, Array<{ value: number; el: string; en: string }>>
> = {
  filter_ui_variant: [
    { value: 1, el: "1 = Chips", en: "1 = Chips" },
    { value: 2, el: "2 = Sidebar", en: "2 = Sidebar" },
    { value: 3, el: "3 = Dropdown", en: "3 = Dropdown" },
  ],
  campaign_card_style: [
    { value: 1, el: "1 = Premium", en: "1 = Premium" },
    { value: 2, el: "2 = Classic", en: "2 = Classic" },
  ],
};

const copy = {
  el: {
    title: "Ρυθμίσεις ιστοτόπου",
    sub: "Συμπαγής πίνακας — προεπιλογές με ασφάλεια.",
    back: "Πίσω",
    save: "Αποθήκευση",
    reset: "Επαναφορά",
    saving: "…",
    saved: "OK",
    dirty: "Αλλαγές",
    range: (min: number, max: number, def: number) => `${min}–${max} · def ${def}`,
    loadError: "Αποτυχία φόρτωσης ρυθμίσεων.",
    saveError: "Αποτυχία αποθήκευσης.",
  },
  en: {
    title: "Site settings",
    sub: "Dense control board — safe defaults.",
    back: "Back",
    save: "Save",
    reset: "Reset",
    saving: "…",
    saved: "OK",
    dirty: "Edited",
    range: (min: number, max: number, def: number) => `${min}–${max} · def ${def}`,
    loadError: "Failed to load settings.",
    saveError: "Failed to save.",
  },
} as const;

async function adminAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function parseDraftValue(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

export default function AdminSettingsPage() {
  const [lang, setLang] = useState<Lang>("el");
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [draft, setDraft] = useState<Partial<Record<SiteSettingKey, string>>>({});
  const [metaByKey] = useState<Record<SiteSettingKey, SiteSettingMeta>>(() => {
    const map = {} as Record<SiteSettingKey, SiteSettingMeta>;
    for (const key of SITE_SETTING_KEYS) map[key] = SITE_SETTING_META[key];
    return map;
  });
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = copy[lang];

  const dirtyCount = useMemo(() => {
    if (!settings) return 0;
    let n = 0;
    for (const key of SITE_SETTING_KEYS) {
      if (String(settings[key]) !== String(draft[key] ?? "")) n += 1;
    }
    return n;
  }, [settings, draft]);

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

  useEffect(() => {
    if (!savedKey) return;
    const id = window.setTimeout(() => setSavedKey(null), 1600);
    return () => window.clearTimeout(id);
  }, [savedKey]);

  async function saveKey(key: SiteSettingKey, reset = false, valueOverride?: number) {
    if (!settings) return;
    setBusyKey(key);
    setMessage(null);
    setError(null);
    try {
      const body = reset
        ? { key, reset: true }
        : { key, value: valueOverride ?? Number(draft[key]) };
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
      setSavedKey(key);
      setMessage(t.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveError);
    } finally {
      setBusyKey(null);
    }
  }

  function setDraftValue(key: SiteSettingKey, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function commitNumber(key: SiteSettingKey, nextRaw: string) {
    if (!settings) return;
    const meta = metaByKey[key];
    let n = parseDraftValue(nextRaw, settings[key]);
    if (n < meta.min) n = meta.min;
    if (n > meta.max) n = meta.max;
    setDraftValue(key, String(n));
    if (n === settings[key]) return;
    await saveKey(key, false, n);
  }

  async function stepNumber(key: SiteSettingKey, delta: number) {
    if (!settings) return;
    const meta = metaByKey[key];
    const current = parseDraftValue(draft[key], settings[key]);
    const next = Math.min(meta.max, Math.max(meta.min, current + delta));
    setDraftValue(key, String(next));
    if (next === settings[key]) return;
    await saveKey(key, false, next);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4 lg:px-5">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-base font-semibold text-slate-900 sm:text-lg">
              <Settings className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
              <span className="truncate">{t.title}</span>
            </h1>
            <p className="truncate text-xs text-slate-500">{t.sub}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {dirtyCount > 0 ? (
              <span className="hidden sm:inline rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
                {dirtyCount} {t.dirty}
              </span>
            ) : null}
            {message && !error ? (
              <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700" role="status">
                {message}
              </span>
            ) : null}
            {error ? (
              <span className="max-w-[12rem] truncate rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700" role="alert">
                {error}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => {
                const next = lang === "el" ? "en" : "el";
                setLang(next);
                setStoredLanguage(next);
              }}
              className="inline-flex h-9 items-center rounded-md px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
            >
              {lang === "el" ? "EN" : "EL"}
            </button>
            <a
              href="/admin"
              className="inline-flex h-9 items-center rounded-md border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {t.back}
            </a>
          </div>
        </div>
      </div>

      <div className="px-3 py-4 sm:px-4 lg:px-5 sm:py-5">
        {loading || !settings ? (
          <p className="text-sm text-slate-500">{lang === "el" ? "Φόρτωση…" : "Loading…"}</p>
        ) : (
          <div className="space-y-5">
            {SETTING_GROUPS.map((group) => (
              <section key={group.id} aria-labelledby={`settings-group-${group.id}`}>
                <h2
                  id={`settings-group-${group.id}`}
                  className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                >
                  {group.label[lang]}
                </h2>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 min-[1800px]:grid-cols-8">
                  {group.keys.map((key) => {
                    const item = metaByKey[key];
                    const valueStr = draft[key] ?? String(settings[key]);
                    const dirty = String(settings[key]) !== String(valueStr);
                    const busy = busyKey === key;
                    const justSaved = savedKey === key;
                    const shortOpts = SHORT_OPTION[key];
                    const hint = item.options
                      ? `def ${item.default}`
                      : t.range(item.min, item.max, item.default);

                    return (
                      <li
                        key={key}
                        className={[
                          "relative flex min-h-[8.25rem] flex-col rounded-lg border bg-white p-2.5 shadow-sm transition-colors",
                          dirty
                            ? "border-amber-300 ring-1 ring-amber-200/70"
                            : justSaved
                              ? "border-emerald-300 ring-1 ring-emerald-200/70"
                              : "border-slate-200",
                        ].join(" ")}
                      >
                        <div className="mb-1 flex items-start justify-between gap-1">
                          <label
                            className="line-clamp-2 text-[12px] font-semibold leading-snug text-slate-900"
                            htmlFor={`setting-${key}`}
                            title={item.label[lang]}
                          >
                            {SHORT_LABEL[key][lang]}
                          </label>
                          <span
                            className={[
                              "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]",
                              busy
                                ? "bg-slate-100 text-slate-500"
                                : justSaved
                                  ? "bg-emerald-100 text-emerald-700"
                                  : dirty
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-transparent text-transparent",
                            ].join(" ")}
                            aria-hidden={!busy && !justSaved && !dirty}
                          >
                            {busy ? (
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                            ) : justSaved ? (
                              <Check className="h-3 w-3" />
                            ) : dirty ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            ) : null}
                          </span>
                        </div>
                        <p
                          className="mb-1.5 line-clamp-2 text-[10px] leading-tight text-slate-500"
                          title={item.description[lang]}
                        >
                          {item.description[lang]}
                        </p>

                        <div className="mt-auto space-y-1.5">
                          {item.options ? (
                            <select
                              id={`setting-${key}`}
                              value={valueStr}
                              disabled={busy}
                              onChange={(e) => {
                                const next = e.target.value;
                                setDraftValue(key, next);
                                void saveKey(key, false, Number(next));
                              }}
                              className="w-full rounded-md border border-slate-300 bg-white px-1.5 py-1.5 text-[12px] text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:opacity-50"
                            >
                              {(shortOpts || item.options.map((o) => ({
                                value: o.value,
                                el: o.label.el,
                                en: o.label.en,
                              }))).map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {lang === "el" ? opt.el : opt.en}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                aria-label="−"
                                disabled={busy || parseDraftValue(valueStr, settings[key]) <= item.min}
                                onClick={() => void stepNumber(key, -1)}
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-35"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <input
                                id={`setting-${key}`}
                                type="number"
                                min={item.min}
                                max={item.max}
                                step={1}
                                value={valueStr}
                                disabled={busy}
                                onChange={(e) => setDraftValue(key, e.target.value)}
                                onBlur={(e) => void commitNumber(key, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.currentTarget.blur();
                                  }
                                }}
                                className="min-w-0 flex-1 rounded-md border border-slate-300 px-1 py-1.5 text-center text-sm font-medium tabular-nums text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:opacity-50"
                              />
                              <button
                                type="button"
                                aria-label="+"
                                disabled={busy || parseDraftValue(valueStr, settings[key]) >= item.max}
                                onClick={() => void stepNumber(key, 1)}
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-35"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-1">
                            <p className="truncate text-[10px] leading-tight text-slate-400">{hint}</p>
                            <button
                              type="button"
                              title={t.reset}
                              aria-label={t.reset}
                              disabled={busy || settings[key] === item.default}
                              onClick={() => void saveKey(key, true)}
                              className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
