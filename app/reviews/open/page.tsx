"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { loadOwnProfiles } from "@/lib/ownProfile";
import { reviewOpenLoginPath } from "@/lib/reviewInvite";

/**
 * Client bridge for signed review star links.
 * Validates the token server-side via /api/reviews/open, then routes to the
 * review modal (after login if needed) with the star preselected.
 */
function ReviewOpenInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Άνοιγμα αξιολόγησης…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = searchParams?.get("t") || "";
      const lang = searchParams?.get("lang") === "en" ? "en" : "el";
      if (!t) {
        setMessage(lang === "en" ? "Invalid link." : "Μη έγκυρος σύνδεσμος.");
        return;
      }

      const res = await fetch(`/api/reviews/open?t=${encodeURIComponent(t)}`);
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok || !data?.ok || !data?.destination) {
        setMessage(
          typeof data?.error === "string"
            ? data.error
            : lang === "en"
              ? "This review link is invalid or expired."
              : "Ο σύνδεσμος αξιολόγησης δεν είναι έγκυρος."
        );
        return;
      }

      const destination = String(data.destination);
      const party = data.party as "brand" | "influencer";
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.access_token) {
        const redirect = `/reviews/open?t=${encodeURIComponent(t)}${lang === "en" ? "&lang=en" : ""}`;
        router.replace(reviewOpenLoginPath(party === "brand" ? "brand" : "influencer", redirect));
        return;
      }

      const profiles = await loadOwnProfiles(supabase);
      if (cancelled) return;
      if (party === "brand" && !profiles.ok) {
        setMessage(profiles.message || "Σφάλμα προφίλ");
        return;
      }
      if (party === "brand" && profiles.ok && !profiles.brand) {
        setMessage(
          lang === "en"
            ? "Sign in with your brand account to leave this review."
            : "Συνδεθείτε με τον λογαριασμό επιχείρησης για να αξιολογήσετε."
        );
        return;
      }
      if (party === "influencer" && profiles.ok && !profiles.influencer) {
        setMessage(
          lang === "en"
            ? "Sign in with your creator account to leave this review."
            : "Συνδεθείτε με τον λογαριασμό δημιουργού για να αξιολογήσετε."
        );
        return;
      }

      router.replace(destination);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <p className="text-slate-600 text-sm text-center max-w-md">{message}</p>
    </div>
  );
}

export default function ReviewOpenPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <p className="text-slate-500 text-sm">…</p>
        </div>
      }
    >
      <ReviewOpenInner />
    </Suspense>
  );
}
