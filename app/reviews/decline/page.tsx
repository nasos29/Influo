"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { REVIEW_DECLINE_HINT_EL, REVIEW_DECLINE_HINT_EN } from "@/lib/reviewCopy";

function ReviewDeclineInner() {
  const searchParams = useSearchParams();
  const lang = searchParams?.get("lang") === "en" ? "en" : "el";
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = searchParams?.get("t") || "";
      if (!t) {
        setStatus("error");
        setError(lang === "en" ? "Invalid link." : "Μη έγκυρος σύνδεσμος.");
        return;
      }
      const res = await fetch("/api/reviews/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t }),
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok || !data?.ok) {
        setStatus("error");
        setError(
          typeof data?.error === "string"
            ? data.error
            : lang === "en"
              ? "Could not save your choice."
              : "Δεν ήταν δυνατή η αποθήκευση."
        );
        return;
      }
      setStatus("ok");
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, lang]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
        {status === "loading" ? (
          <p className="text-slate-600 text-sm">{lang === "en" ? "Saving…" : "Αποθήκευση…"}</p>
        ) : null}
        {status === "ok" ? (
          <>
            <h1 className="text-lg font-semibold text-slate-900 mb-2">
              {lang === "en" ? "Got it" : "Εντάξει"}
            </h1>
            <p className="text-sm text-slate-600 mb-4">
              {lang === "en" ? REVIEW_DECLINE_HINT_EN : REVIEW_DECLINE_HINT_EL}
            </p>
            <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
              {lang === "en" ? "Back to Influo" : "Επιστροφή στο Influo"}
            </Link>
          </>
        ) : null}
        {status === "error" ? (
          <>
            <h1 className="text-lg font-semibold text-slate-900 mb-2">
              {lang === "en" ? "Something went wrong" : "Κάτι πήγε στραβά"}
            </h1>
            <p className="text-sm text-slate-600 mb-4">{error}</p>
            <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
              {lang === "en" ? "Back to Influo" : "Επιστροφή στο Influo"}
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function ReviewDeclinePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <p className="text-slate-500 text-sm">…</p>
        </div>
      }
    >
      <ReviewDeclineInner />
    </Suspense>
  );
}
