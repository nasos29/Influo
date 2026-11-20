"use client";

import { useState } from "react";
import { sessionFetch } from "@/lib/sessionFetch";
import { showcaseHelperText } from "@/lib/showcaseCopy";

type Lang = "el" | "en";
type Source = "proposal" | "campaign";
type Party = "brand" | "influencer";

const COPY = {
  el: {
    label: "Να φαίνεται δημόσια στις «Πρόσφατες συνεργασίες»",
    saving: "Αποθήκευση…",
    error: "Δεν αποθηκεύτηκε. Δοκίμασε ξανά.",
  },
  en: {
    label: "Show publicly in “Recent collaborations”",
    saving: "Saving…",
    error: "Could not save. Try again.",
  },
} as const;

export default function ShowcaseConsentToggle({
  source,
  id,
  initialConsent,
  lang,
  party,
  className = "",
}: {
  source: Source;
  id: string;
  initialConsent?: boolean | null;
  lang: Lang;
  party: Party;
  className?: string;
}) {
  const txt = COPY[lang];
  const hint = showcaseHelperText(party, lang);
  const [consent, setConsent] = useState(initialConsent !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = async (next: boolean) => {
    setConsent(next);
    setSaving(true);
    setError(null);
    try {
      const res = await sessionFetch("/api/collaborations/showcase", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, id, consent: next }),
      });
      if (!res.ok) {
        setConsent(!next);
        setError(txt.error);
      }
    } catch {
      setConsent(!next);
      setError(txt.error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 ${className}`}>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={consent}
          disabled={saving}
          onChange={(e) => void onChange(e.target.checked)}
          className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-slate-900/10"
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-slate-800">{txt.label}</span>
          <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
          {saving ? <span className="mt-1 block text-xs text-slate-400">{txt.saving}</span> : null}
          {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
        </span>
      </label>
    </div>
  );
}
