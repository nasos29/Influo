"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import MediaKitView from "@/components/MediaKitView";
import type { MediaKitProfile } from "@/lib/mediaKit";

export default function DashboardMediaKitPage() {
  const router = useRouter();
  const [kit, setKit] = useState<MediaKitProfile | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.replace("/login?redirect=/dashboard/media-kit");
          return;
        }
        const { data: row, error: rowErr } = await supabase
          .from("influencers")
          .select("display_name, bio, location, category, min_rate, avatar_url, accounts, approved, audience_male_percent, audience_female_percent, audience_top_age")
          .eq("contact_email", session.user.email)
          .maybeSingle();
        if (rowErr) throw new Error(rowErr.message);
        if (!row) throw new Error("Δεν βρέθηκε προφίλ.");
        if (!row.approved) throw new Error("Το media kit ενεργοποιείται μετά την έγκριση του προφίλ.");

        const linkRes = await fetch("/api/influencer/profile-link", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const link = await linkRes.json();
        if (!linkRes.ok) throw new Error(link.error || "Δεν φορτώθηκε το Influo link");

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
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Σφάλμα");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-8 sm:py-10 print:bg-white print:p-0">
      <style>{`@page { size: A4; margin: 10mm; }`}</style>
      {loading ? (
        <p className="text-center text-slate-600">Φόρτωση media kit…</p>
      ) : error ? (
        <div className="max-w-lg mx-auto bg-white border border-slate-200 rounded-xl p-6 text-center">
          <p className="text-slate-800">{error}</p>
          <Link href="/dashboard?tab=tools" className="inline-block mt-4 text-blue-600 font-medium">
            Πίσω στα Εργαλεία
          </Link>
        </div>
      ) : kit ? (
        <MediaKitView profile={kit} />
      ) : null}
    </div>
  );
}
