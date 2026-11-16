"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import NotificationPreferencesPanel from "@/components/NotificationPreferencesPanel";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotifCategory,
  type NotificationPreferences,
  isNotifCategory,
} from "@/lib/notificationPreferences";
import { getStoredLanguage } from "@/lib/language";

function PreferencesInner() {
  const search = useSearchParams();
  const token = (search.get("token") || "").trim();
  const [lang, setLang] = useState<"el" | "en">("el");
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [party, setParty] = useState<"brand" | "influencer">("influencer");
  const [applied, setApplied] = useState<NotifCategory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!token);

  useEffect(() => {
    setLang(getStoredLanguage());
  }, []);

  const apiPath = useMemo(
    () =>
      token
        ? `/api/email/notification-preferences?token=${encodeURIComponent(token)}`
        : "",
    [token]
  );

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(apiPath, { method: "GET", cache: "no-store" });
        const json = (await res.json()) as {
          data?: NotificationPreferences;
          party?: string;
          applied?: string | null;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !json.data) {
          setError(
            lang === "el"
              ? "Ο σύνδεσμος δεν είναι έγκυρος ή έχει λήξει."
              : "This link is invalid or has expired."
          );
          return;
        }
        setPrefs({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...json.data });
        setParty(json.party === "brand" ? "brand" : "influencer");
        if (json.applied && isNotifCategory(json.applied)) setApplied(json.applied);
      } catch {
        if (!cancelled) {
          setError(lang === "el" ? "Κάτι πήγε στραβά." : "Something went wrong.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiPath, token, lang]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader lang={lang} onLangChange={setLang} />
      <main className="px-4 py-8 sm:py-12">
        {!token ? (
          <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
            <p>
              {lang === "el"
                ? "Άνοιξε αυτή τη σελίδα από τον σύνδεσμο διαγραφής στο email, ή από το dashboard → Ειδοποιήσεις όσο είσαι συνδεδεμένος/η."
                : "Open this page from the unsubscribe link in your email, or from dashboard → Notifications while signed in."}
            </p>
            <p className="mt-3">
              <a className="text-blue-700 underline" href="/login">
                {lang === "el" ? "Σύνδεση" : "Sign in"}
              </a>
            </p>
          </div>
        ) : loading ? (
          <p className="text-center text-sm text-slate-500">
            {lang === "el" ? "Φόρτωση…" : "Loading…"}
          </p>
        ) : error ? (
          <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-white p-6 text-sm text-red-700">
            {error}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 shadow-sm">
            <NotificationPreferencesPanel
              lang={lang}
              party={party}
              apiPath={apiPath}
              initial={prefs}
              tokenMode
              flashCategory={applied}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default function NotificationPreferencesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">
          …
        </div>
      }
    >
      <PreferencesInner />
    </Suspense>
  );
}
