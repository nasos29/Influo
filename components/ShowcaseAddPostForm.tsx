"use client";

import { useState } from "react";
import { SHOWCASE_HELPER_CREATOR_EL, SHOWCASE_HELPER_CREATOR_EN } from "@/lib/showcaseCopy";

type Lang = "el" | "en";

const COPY = {
  el: {
    title: "Πρόσθεσε το link της ανάρτησης",
    body: "Επικόλλησε το δημόσιο link (Instagram reel/post, TikTok ή YouTube). Το brand θα μπορέσει να το εγκρίνει από το dashboard.",
    placeholder: "https://instagram.com/reel/… ή TikTok",
    submit: "Αποθήκευση",
    saving: "Αποθήκευση…",
    ok: "Αποθηκεύτηκε. Το brand θα το δει για έγκριση.",
    bad: "Μη έγκυρος σύνδεσμος.",
    err: "Κάτι πήγε στραβά. Δοκίμασε ξανά.",
  },
  en: {
    title: "Add the post link",
    body: "Paste the public link (Instagram reel/post, TikTok, or YouTube). The brand can approve it from their dashboard.",
    placeholder: "https://instagram.com/reel/… or TikTok",
    submit: "Save",
    saving: "Saving…",
    ok: "Saved. The brand will see it for approval.",
    bad: "Invalid link.",
    err: "Something went wrong. Try again.",
  },
} as const;

export default function ShowcaseAddPostForm({
  token,
  lang,
  valid,
}: {
  token: string;
  lang: Lang;
  valid: boolean;
}) {
  const txt = COPY[lang];
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!valid) {
    return <p className="mt-4 text-[15px] text-slate-600">{txt.bad}</p>;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/showcase/add-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, url }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : txt.err);
        return;
      }
      setDone(true);
    } catch {
      setError(txt.err);
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return <p className="mt-4 text-[15px] leading-relaxed text-emerald-700">{txt.ok}</p>;
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-3">
      <p className="text-[15px] leading-relaxed text-slate-600">{txt.body}</p>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={txt.placeholder}
        required
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900"
      />
      <p className="text-[11px] leading-relaxed text-slate-400">
        {lang === "en" ? SHOWCASE_HELPER_CREATOR_EN : SHOWCASE_HELPER_CREATOR_EL}
      </p>
      <button
        type="submit"
        disabled={saving || !url.trim()}
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {saving ? txt.saving : txt.submit}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
