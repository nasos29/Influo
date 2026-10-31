"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";
import SiteHeader from "@/components/SiteHeader";
import CampaignCard, { type CampaignCardData } from "@/components/CampaignCard";
import { supabase } from "@/lib/supabaseClient";
import { loadOwnProfiles } from "@/lib/ownProfile";
import { lookupAuthUser } from "@/lib/authSession";
import { getStoredLanguage } from "@/lib/language";
import { usePublicAccountNav, type PublicUserKind } from "@/lib/publicAccountNav";

const ADMIN_EMAIL_FALLBACK = "nd.6@hotmail.com";

type Row = CampaignCardData & {
  status?: string | null;
};

export default function PublicCampaignsPage({
  initialCampaigns = [],
}: {
  initialCampaigns?: CampaignCardData[];
}) {
  const pathname = usePathname();
  const [lang, setLang] = useState<"el" | "en">(pathname?.startsWith("/en") ? "en" : "el");
  const [rows] = useState<Row[]>(() => (initialCampaigns as Row[]) || []);
  const { userKind, identityReady } = usePublicAccountNav(lang);
  const [influencerId, setInfluencerId] = useState<string | null>(null);
  const [approvedInfluencer, setApprovedInfluencer] = useState(false);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLang(pathname?.startsWith("/en") ? "en" : getStoredLanguage() === "en" ? "en" : "el");
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    const applyInfluencer = (id: string, approved: boolean) => {
      setInfluencerId(id);
      setApprovedInfluencer(approved);
    };
    (async () => {
      const auth = await lookupAuthUser(8000);
      if (cancelled) return;
      if (!auth.user) {
        setInfluencerId(null);
        setApprovedInfluencer(false);
        return;
      }
      const email = auth.user.email?.toLowerCase().trim();
      if (email === ADMIN_EMAIL_FALLBACK.toLowerCase()) {
        return;
      }
      let profiles = await loadOwnProfiles(supabase);
      if (!profiles.ok) profiles = await loadOwnProfiles(supabase);
      if (cancelled) return;
      if (profiles.ok && profiles.influencer) {
        const rawId = profiles.influencer.id;
        const id = typeof rawId === "string" || typeof rawId === "number" ? String(rawId) : auth.user.id;
        applyInfluencer(id, !!profiles.influencer.approved);
      } else {
        const { data } = await supabase
          .from("campaign_applications")
          .select("campaign_id, status")
          .eq("influencer_id", auth.user.id);
        if (cancelled) return;
        const applied = (data || []).filter((row) => row.status !== "withdrawn");
        if (applied.length > 0) {
          applyInfluencer(auth.user.id, true);
          setAppliedIds(new Set(applied.map((row) => String(row.campaign_id))));
        }
      }
    })().catch(() => {
      if (cancelled) return;
      setInfluencerId(null);
      setApprovedInfluencer(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!influencerId || !approvedInfluencer) {
      setAppliedIds(new Set());
      return;
    }
    let cancelled = false;
    const loadApplied = async () => {
      const { data } = await supabase
        .from("campaign_applications")
        .select("campaign_id, status")
        .eq("influencer_id", influencerId);
      if (cancelled) return;
      setAppliedIds(new Set((data || []).filter((row) => row.status !== "withdrawn").map((row) => String(row.campaign_id))));
    };
    loadApplied().catch(() => {
      if (!cancelled) setAppliedIds(new Set());
    });
    return () => {
      cancelled = true;
    };
  }, [influencerId, approvedInfluencer]);

  const t = {
    el: {
      title: "Ανοιχτές καμπάνιες",
      subtitle: "Brands δημοσιεύουν καμπάνιες με budget και περιγραφή — οι creators κάνουν αίτηση από το dashboard τους.",
      empty: "Δεν υπάρχουν ανοιχτές καμπάνιες αυτή τη στιγμή.",
      signupInf: "Εγγραφή influencer",
      signupBrand: "Εγγραφή brand",
    },
    en: {
      title: "Open campaigns",
      subtitle: "Brands publish campaigns with budget and description — creators apply from their dashboard.",
      empty: "No open campaigns right now.",
      signupInf: "Influencer sign up",
      signupBrand: "Brand sign up",
    },
  }[lang];

  const guestKind: PublicUserKind = userKind;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader lang={lang} onLangChange={setLang} />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-10 w-full">
        <h1 className="text-3xl font-bold text-slate-900">{t.title}</h1>
        <p className="text-slate-600 mt-2 max-w-2xl">{t.subtitle}</p>
        {identityReady && guestKind === "none" && (
          <div className="mt-6 flex flex-wrap gap-3 text-sm items-center">
            <Link
              href={lang === "en" ? "/en/for-influencers" : "/for-influencers"}
              className="inline-flex min-h-[44px] items-center text-slate-700 hover:underline"
            >
              {t.signupInf}
            </Link>
            <span className="text-slate-300">|</span>
            <Link
              href={lang === "en" ? "/en/for-brands" : "/for-brands"}
              className="inline-flex min-h-[44px] items-center text-slate-700 hover:underline"
            >
              {t.signupBrand}
            </Link>
          </div>
        )}

        {rows.length === 0 ? (
          <p className="mt-10 text-slate-500">{t.empty}</p>
        ) : (
          <ul className="mt-10 grid gap-4 md:grid-cols-2">
            {rows.map((c) => (
              <li key={c.id}>
                <CampaignCard
                  campaign={{ ...c, status: c.status || "open" }}
                  lang={lang}
                  footer={
                    approvedInfluencer ? (
                      appliedIds.has(c.id) ? (
                        <p className="text-xs font-medium text-emerald-700">
                          {lang === "el" ? "Έχετε ήδη κάνει αίτηση" : "Already applied"}
                        </p>
                      ) : (
                        <Link href={`/campaigns/${c.id}`} className="inline-flex text-sm font-medium text-blue-700 hover:underline">
                          {lang === "el" ? "Αίτηση" : "Apply"}
                        </Link>
                      )
                    ) : null
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer lang={lang} showAppPromo={false} />
    </div>
  );
}
