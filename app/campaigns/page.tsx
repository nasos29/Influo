"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabaseClient";
import { loadOwnProfiles } from "@/lib/ownProfile";
import { lookupAuthUser } from "@/lib/authSession";
import { getStoredLanguage, setStoredLanguage } from "@/lib/language";
import { getCachedImageUrl } from "@/lib/imageProxy";

const ADMIN_EMAIL_FALLBACK = "nd.6@hotmail.com";

type UserKind = "none" | "brand" | "influencer" | "admin" | "signed-in";

type Row = {
  id: string;
  title: string;
  description: string;
  budget: number;
  category: string | null;
  deliverables: string | null;
  deadline: string | null;
  created_at: string;
  brands: { brand_name: string; logo_url: string | null } | null;
};

export default function PublicCampaignsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [lang, setLang] = useState<"el" | "en">("el");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [userKind, setUserKind] = useState<UserKind>("none");
  const [authReady, setAuthReady] = useState(false);
  const [identityReady, setIdentityReady] = useState(false);
  const [influencerId, setInfluencerId] = useState<string | null>(null);
  const [approvedInfluencer, setApprovedInfluencer] = useState(false);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLang(pathname?.startsWith("/en") ? "en" : getStoredLanguage() === "en" ? "en" : "el");
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    const applyInfluencer = (id: string, approved: boolean) => {
      setUserKind("influencer");
      setInfluencerId(id);
      setApprovedInfluencer(approved);
    };
    (async () => {
      const auth = await lookupAuthUser(8000);
      if (cancelled) return;
      if (!auth.user) {
        setUserKind("none");
        setInfluencerId(null);
        setApprovedInfluencer(false);
        setAuthReady(true);
        setIdentityReady(true);
        return;
      }
      const email = auth.user.email?.toLowerCase().trim();
      if (email === ADMIN_EMAIL_FALLBACK.toLowerCase()) {
        setUserKind("admin");
        setAuthReady(true);
        setIdentityReady(true);
        return;
      }
      let profiles = await loadOwnProfiles(supabase);
      if (!profiles.ok) profiles = await loadOwnProfiles(supabase);
      if (cancelled) return;
      if (profiles.ok && profiles.brand && !profiles.influencer) {
        setUserKind("brand");
      } else if (profiles.ok && profiles.influencer) {
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
        } else if (profiles.ok) {
          setUserKind("none");
        } else {
          setUserKind("signed-in");
        }
      }
      setAuthReady(true);
      setIdentityReady(true);
    })().catch(() => {
      if (cancelled) return;
      setUserKind("none");
      setAuthReady(true);
      setIdentityReady(true);
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

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    let finished = false;
    const loadRows = async () => {
      setLoading(true);
      setErr(false);
      const { data, error } = await supabase
        .from("brand_campaigns")
        .select(
          `
          id,
          title,
          description,
          budget,
          category,
          deliverables,
          deadline,
          created_at,
          brands ( brand_name, logo_url )
        `
        )
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error(error);
        setErr(true);
        setRows([]);
      } else {
        setRows((data as unknown as Row[]) || []);
      }
      finished = true;
      setLoading(false);
    };
    loadRows().catch(() => {
      if (cancelled) return;
      finished = true;
      setErr(true);
      setLoading(false);
    });
    const timer = window.setTimeout(() => {
      if (!cancelled && !finished) {
        setLoading(false);
        setErr(true);
      }
    }, 12000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [authReady]);

  const t = {
    el: {
      title: "Ανοιχτές καμπάνιες",
      subtitle: "Brands δημοσιεύουν καμπάνιες με budget και περιγραφή — οι creators κάνουν αίτηση από το dashboard τους.",
      empty: "Δεν υπάρχουν ανοιχτές καμπάνιες αυτή τη στιγμή.",
      budget: "Budget",
      deliverables: "Παράδοση",
      login: "Σύνδεση για αίτηση",
      myDashboard: "Το dashboard μου",
      brandDashboard: "Dashboard επιχείρησης",
      infDashboard: "Dashboard influencer",
      adminDash: "Admin",
      signupInf: "Εγγραφή influencer",
      signupBrand: "Εγγραφή brand",
      loadErr: "Η λίστα δεν είναι διαθέσιμη. Αν μόλις ενεργοποιήσατε τη λειτουργία, εκτελέστε το SQL στο Supabase (docs/BRAND_CAMPAIGNS_SCHEMA.sql).",
      home: "Αρχική",
    },
    en: {
      title: "Open campaigns",
      subtitle: "Brands publish campaigns with budget and description — creators apply from their dashboard.",
      empty: "No open campaigns right now.",
      budget: "Budget",
      deliverables: "Deliverables",
      login: "Sign in to apply",
      myDashboard: "My dashboard",
      brandDashboard: "Brand dashboard",
      infDashboard: "Influencer dashboard",
      adminDash: "Admin",
      signupInf: "Influencer sign up",
      signupBrand: "Brand sign up",
      loadErr: "List unavailable. If you just enabled this feature, run the SQL migration (docs/BRAND_CAMPAIGNS_SCHEMA.sql).",
      home: "Home",
    },
  }[lang];

  const dashboardPath =
    userKind === "brand"
      ? "/brand/dashboard"
      : userKind === "influencer" || userKind === "signed-in"
        ? "/dashboard"
        : userKind === "admin"
          ? "/admin"
          : "/login";
  const dashboardLabel =
    userKind === "brand"
      ? t.brandDashboard
      : userKind === "influencer"
        ? t.infDashboard
        : userKind === "admin"
          ? t.adminDash
          : userKind === "signed-in"
            ? t.myDashboard
            : t.login;

  if (!authReady) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <div className="flex-1 flex items-center justify-center">
          <div className="h-28 w-full max-w-xl rounded-xl bg-white border border-slate-200 animate-pulse" />
        </div>
      </div>
    );
  }
  const accountLink = identityReady ? (
    <Link href={dashboardPath} className="text-blue-600 font-medium hover:underline">
      {dashboardLabel}
    </Link>
  ) : (
    <span className="inline-block h-4 w-28 rounded bg-slate-200 animate-pulse" aria-hidden />
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <Link href={lang === "en" ? "/en" : "/"} className="flex items-center gap-2">
            <Image src="/logo.svg" alt="Influo" width={120} height={40} className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {accountLink}
            <button
              type="button"
              onClick={() => {
                const next = lang === "el" ? "en" : "el";
                setLang(next);
                setStoredLanguage(next);
                router.push(next === "en" ? "/en/campaigns" : "/campaigns");
              }}
              className="text-slate-600 border border-slate-200 rounded px-2 py-1"
            >
              {lang === "el" ? "EN" : "EL"}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-4 py-10 w-full">
        <h1 className="text-3xl font-bold text-slate-900">{t.title}</h1>
        <p className="text-slate-600 mt-2 max-w-2xl">{t.subtitle}</p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm items-center">
          {accountLink}
          {identityReady && userKind === "none" && (
            <>
              <span className="text-slate-300">|</span>
              <Link
                href={lang === "en" ? "/en/for-influencers" : "/for-influencers"}
                className="text-slate-700 hover:underline"
              >
                {t.signupInf}
              </Link>
              <span className="text-slate-300">|</span>
              <Link href={lang === "en" ? "/en/for-brands" : "/for-brands"} className="text-slate-700 hover:underline">
                {t.signupBrand}
              </Link>
            </>
          )}
        </div>

        {loading ? (
          <div className="mt-10 space-y-3" aria-busy="true">
            <div className="h-28 rounded-xl bg-white border border-slate-200 animate-pulse" />
            <div className="h-28 rounded-xl bg-white border border-slate-200 animate-pulse" />
          </div>
        ) : err ? (
          <p className="mt-10 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">{t.loadErr}</p>
        ) : rows.length === 0 ? (
          <p className="mt-10 text-slate-500">{t.empty}</p>
        ) : (
          <ul className="mt-10 space-y-4">
            {rows.map((c) => (
              <li key={c.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  {c.brands?.logo_url ? (
                    <Image
                      src={getCachedImageUrl(c.brands.logo_url) ?? c.brands.logo_url}
                      alt=""
                      width={48}
                      height={48}
                      className="rounded-lg object-cover w-12 h-12 border border-slate-100"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 text-lg font-semibold">
                      {(c.brands?.brand_name || "B").slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-slate-900">
                      <Link href={`/campaigns/${c.id}`} className="hover:underline">
                        {c.title}
                      </Link>
                    </h2>
                    {approvedInfluencer && appliedIds.has(c.id) && (
                      <p className="text-xs font-medium text-emerald-700 mt-1">
                        {lang === "el" ? "Έχετε ήδη κάνει αίτηση" : "Already applied"}
                      </p>
                    )}
                    {approvedInfluencer && !appliedIds.has(c.id) && (
                      <Link href={`/campaigns/${c.id}`} className="inline-block mt-2 text-sm font-medium text-blue-700 hover:underline">
                        {lang === "el" ? "Αίτηση" : "Apply"}
                      </Link>
                    )}
                    <p className="text-sm text-slate-500">{c.brands?.brand_name}</p>
                    <p className="text-slate-700 mt-3 whitespace-pre-wrap">{c.description}</p>
                    {c.deliverables && (
                      <p className="text-sm text-slate-600 mt-2">
                        <strong>{t.deliverables}:</strong> {c.deliverables}
                      </p>
                    )}
                    <p className="text-sm font-medium text-slate-900 mt-3">
                      {t.budget}: €{Number(c.budget).toLocaleString(lang === "el" ? "el-GR" : "en-GB")}
                      {c.category ? ` · ${c.category}` : ""}
                      {c.deadline
                        ? ` · ${lang === "el" ? "Έως" : "Until"} ${new Date(c.deadline).toLocaleDateString(lang === "el" ? "el-GR" : "en-GB")}`
                        : ""}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Footer lang={lang} />
    </div>
  );
}
