"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import MediaKitView from "@/components/MediaKitView";
import type { MediaKitProfile } from "@/lib/mediaKit";
import { loadOwnInfluencer } from "@/lib/ownProfile";
import { getStoredLanguage } from "@/lib/language";
import { isTimeoutError, withTimeout } from "@/lib/withTimeout";

export default function DashboardMediaKitPage() {
  const router = useRouter();
  const [kit, setKit] = useState<MediaKitProfile | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [lang, setLang] = useState<"el" | "en">("el");

  useEffect(() => {
    setLang(getStoredLanguage());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const uiLang = getStoredLanguage();
    (async () => {
      setLoading(true);
      setError("");
      try {
        await withTimeout((async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.replace("/login?redirect=/dashboard/media-kit");
          return;
        }
        const loaded = await loadOwnInfluencer(supabase);
        if (!loaded.ok) {
          throw new Error(
            loaded.reason === "missing"
              ? uiLang === "en"
                ? "Profile was not found."
                : "Δεν βρέθηκε προφίλ."
              : loaded.message
          );
        }
        const row = loaded.profile as {
          display_name?: string | null;
          bio?: string | null;
          location?: string | null;
          category?: string | null;
          min_rate?: string | null;
          avatar_url?: string | null;
          accounts?: MediaKitProfile["accounts"];
          approved?: boolean | null;
          audience_male_percent?: number | null;
          audience_female_percent?: number | null;
          audience_top_age?: string | null;
        } | null;
        if (!row) throw new Error(uiLang === "en" ? "Profile was not found." : "Δεν βρέθηκε προφίλ.");
        if (!row.approved) {
          throw new Error(
            uiLang === "en"
              ? "The presentation PDF turns on after your profile is approved."
              : "Το PDF παρουσίασης ενεργοποιείται μετά την έγκριση του προφίλ."
          );
        }

        const linkRes = await fetch("/api/influencer/profile-link", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const link = await linkRes.json();
        if (!linkRes.ok) {
          throw new Error(link.error || (uiLang === "en" ? "The Influo link did not load." : "Δεν φορτώθηκε το link του Influo."));
        }

        if (cancelled) return;
        setKit({
          displayName: row.display_name || link.displayName || "Creator",
          bio: row.bio,
          location: row.location,
          category: row.category || link.category,
          minRate: row.min_rate,
          avatarUrl: row.avatar_url,
          accounts: row.accounts,
          profileUrl: link.url,
          audienceMale: row.audience_male_percent,
          audienceFemale: row.audience_female_percent,
          audienceTopAge: row.audience_top_age,
        });
        })(), 20000);
      } catch (e: unknown) {
        if (!cancelled) {
          setKit(null);
          setError(
            isTimeoutError(e)
              ? uiLang === "en"
                ? "This took too long. Try again."
                : "Η φόρτωση άργησε. Δοκίμασε ξανά."
              : e instanceof Error
                ? e.message
                : uiLang === "en"
                  ? "Something went wrong."
                  : "Κάτι πήγε στραβά."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, attempt]);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-8 sm:py-10 print:bg-white print:p-0">
      <style>{`@page { size: A4; margin: 10mm; }`}</style>
      {loading ? (
        <div className="max-w-3xl mx-auto space-y-4" aria-busy="true">
          <div className="h-10 w-40 rounded bg-slate-200 animate-pulse" />
          <div className="h-[70vh] rounded-xl bg-white border border-slate-200 animate-pulse" />
        </div>
      ) : error ? (
        <div className="max-w-lg mx-auto bg-white border border-slate-200 rounded-xl p-6 text-center">
          <p className="text-slate-800">{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-4 inline-flex min-h-11 items-center justify-center px-5 rounded-xl bg-slate-900 text-white text-sm font-medium"
          >
            {lang === "en" ? "Try again" : "Δοκίμασε ξανά"}
          </button>
          <Link href="/dashboard?tab=tools" className="inline-flex min-h-11 items-center mt-3 text-blue-600 font-medium">
            {lang === "en" ? "Back to tools" : "Πίσω στα εργαλεία"}
          </Link>
        </div>
      ) : kit ? (
        <MediaKitView profile={kit} lang={lang} />
      ) : null}
    </div>
  );
}
