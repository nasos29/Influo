"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotifCategory,
  type NotificationPreferences,
} from "@/lib/notificationPreferences";
import { sessionFetch } from "@/lib/sessionFetch";

type Lang = "el" | "en";
type Party = "brand" | "influencer";

const COPY = {
  el: {
    title: "Ειδοποιήσεις",
    subtitle: "Επίλεξε τι θέλεις να λαμβάνεις. Τα απαραίτητα για τις συνεργασίες μένουν πάντα ενεργά.",
    matches: "Νέες καμπάνιες / προτάσεις που ταιριάζουν",
    matchesHint: "Email όταν υπάρχει strong match ή καμπάνια στην κατηγορία σου.",
    reminders: "Υπενθυμίσεις",
    remindersHint: "Reviews, σύνδεσμος deliverable, πρόχειρη καμπάνια, εβδομαδιαίο nudge brand.",
    announcements: "Ενημερώσεις Influo & newsletter",
    announcementsHint: "Ανακοινώσεις και ενημερώσεις μέσω email.",
    inSite: "Ειδοποιήσεις εντός πλατφόρμας (καμπανάκι)",
    inSiteHint:
      "Οι ανακοινώσεις στο καμπανάκι εμφανίζονται πάντα. Αυτό ελέγχει άλλες in-site ειδοποιήσεις.",
    essentialTitle: "Απαραίτητα (πάντα ενεργά)",
    essentialNote: "απαραίτητο για τις συνεργασίες σου",
    essentialItems: [
      "Νέο μήνυμα",
      "Νέα πρόταση συνεργασίας",
      "Αποδοχή / κλείδωμα συμφωνίας",
      "Υποβολή / έγκριση deliverable",
      "Πληρωμή / ασφάλεια",
    ],
    on: "Ενεργό",
    off: "Ανενεργό",
    saving: "Αποθήκευση…",
    saved: "Αποθηκεύτηκε",
    error: "Δεν αποθηκεύτηκε. Δοκίμασε ξανά.",
    oneClickOff: "Απενεργοποιήθηκε: ",
  },
  en: {
    title: "Notifications",
    subtitle: "Choose what you want to receive. Essential collaboration emails stay on.",
    matches: "New matching campaigns / proposals",
    matchesHint: "Email when there is a strong match or a campaign in your category.",
    reminders: "Reminders",
    remindersHint: "Reviews, deliverable link, draft campaign, brand weekly nudge.",
    announcements: "Influo updates & newsletter",
    announcementsHint: "Announcements and updates by email.",
    inSite: "In-site notifications (bell)",
    inSiteHint:
      "Bell announcements always show. This controls other in-site alerts.",
    essentialTitle: "Essential (always on)",
    essentialNote: "required for your collaborations",
    essentialItems: [
      "New message",
      "New collaboration proposal",
      "Agreement accepted / locked",
      "Deliverable submitted / approved",
      "Payment / safety",
    ],
    on: "On",
    off: "Off",
    saving: "Saving…",
    saved: "Saved",
    error: "Could not save. Try again.",
    oneClickOff: "Turned off: ",
  },
} as const;

const TOGGLE_ROWS: Array<{ key: NotifCategory; title: keyof typeof COPY.el; hint: keyof typeof COPY.el }> = [
  { key: "matches_email", title: "matches", hint: "matchesHint" },
  { key: "reminders_email", title: "reminders", hint: "remindersHint" },
  { key: "announcements_email", title: "announcements", hint: "announcementsHint" },
  { key: "in_site", title: "inSite", hint: "inSiteHint" },
];

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  locked,
  lockNote,
  onLabel,
  offLabel,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  locked?: boolean;
  lockNote?: string;
  onLabel: string;
  offLabel: string;
  onChange?: (next: boolean) => void;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-3 ${
        locked ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{hint}</p>
        {locked && lockNote ? (
          <p className="mt-1 text-xs font-medium text-slate-600">🔒 {lockNote}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled || locked}
        onClick={() => onChange?.(!checked)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 ${
          locked
            ? "bg-emerald-500/80 cursor-not-allowed opacity-90"
            : checked
              ? "bg-emerald-600"
              : "bg-slate-300"
        } ${(disabled || locked) && !locked ? "opacity-60" : ""}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
        <span className="sr-only">{checked ? onLabel : offLabel}</span>
      </button>
    </div>
  );
}

export default function NotificationPreferencesPanel({
  lang,
  party,
  apiPath,
  initial,
  tokenMode,
  flashCategory,
}: {
  lang: Lang;
  party: Party;
  /** Authenticated API path, or token API when tokenMode. */
  apiPath: string;
  initial?: NotificationPreferences | null;
  tokenMode?: boolean;
  flashCategory?: NotifCategory | null;
}) {
  const txt = COPY[lang];
  const [prefs, setPrefs] = useState<NotificationPreferences>(
    initial ? { ...DEFAULT_NOTIFICATION_PREFERENCES, ...initial } : { ...DEFAULT_NOTIFICATION_PREFERENCES }
  );
  const [loading, setLoading] = useState(!initial);
  const [savingKey, setSavingKey] = useState<NotifCategory | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = tokenMode
        ? await fetch(apiPath, { method: "GET", cache: "no-store" })
        : await sessionFetch(apiPath, { method: "GET" });
      const json = (await res.json()) as {
        data?: NotificationPreferences;
        error?: string;
      };
      if (!res.ok || !json.data) {
        setError(json.error || txt.error);
        return;
      }
      setPrefs({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...json.data });
    } catch {
      setError(txt.error);
    } finally {
      setLoading(false);
    }
  }, [apiPath, tokenMode, txt.error]);

  useEffect(() => {
    if (!initial) void load();
  }, [initial, load]);

  useEffect(() => {
    if (!flashCategory) return;
    const labels: Record<NotifCategory, string> = {
      matches_email: txt.matches,
      reminders_email: txt.reminders,
      announcements_email: txt.announcements,
      in_site: txt.inSite,
    };
    setStatus(`${txt.oneClickOff}${labels[flashCategory]}`);
  }, [flashCategory, txt]);

  const save = async (key: NotifCategory, next: boolean) => {
    const prev = prefs;
    const updated = { ...prefs, [key]: next };
    setPrefs(updated);
    setSavingKey(key);
    setError(null);
    setStatus(null);
    try {
      const res = tokenMode
        ? await fetch(apiPath, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [key]: next }),
          })
        : await sessionFetch(apiPath, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [key]: next }),
          });
      const json = (await res.json()) as { data?: NotificationPreferences; error?: string };
      if (!res.ok || !json.data) {
        setPrefs(prev);
        setError(json.error || txt.error);
        return;
      }
      setPrefs({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...json.data });
      setStatus(txt.saved);
    } catch {
      setPrefs(prev);
      setError(txt.error);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6" data-notif-prefs-party={party}>
      <div>
        <h2 className="text-xl font-semibold text-slate-900">{txt.title}</h2>
        <p className="mt-1 text-sm text-slate-600 leading-relaxed">{txt.subtitle}</p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">{txt.saving}</p>
      ) : (
        <div className="space-y-3">
          {TOGGLE_ROWS.map((row) => (
            <ToggleRow
              key={row.key}
              label={txt[row.title] as string}
              hint={txt[row.hint] as string}
              checked={prefs[row.key]}
              disabled={savingKey === row.key}
              onLabel={txt.on}
              offLabel={txt.off}
              onChange={(next) => void save(row.key, next)}
            />
          ))}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
        <p className="text-sm font-semibold text-slate-900">{txt.essentialTitle}</p>
        <ul className="space-y-2">
          {txt.essentialItems.map((item) => (
            <li key={item}>
              <ToggleRow
                label={item}
                hint=""
                checked
                locked
                lockNote={txt.essentialNote}
                onLabel={txt.on}
                offLabel={txt.off}
              />
            </li>
          ))}
        </ul>
      </div>

      {status ? <p className="text-sm text-emerald-700">{status}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
