"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabaseClient";
import { getStoredLanguage, setStoredLanguage } from "@/lib/language";
import { getCachedImageUrl } from "@/lib/imageProxy";

const ADMIN_EMAIL_FALLBACK = "nd.6@hotmail.com";

type UserKind = "none" | "brand" | "influencer" | "admin";

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
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    setLang(pathname?.startsWith("/en") ? "en" : getStoredLanguage() === "en" ? "en" : "el");
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    const path = pathname || "/campaigns";
    (async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(s);
      setAuthReady(true);
      if (!s) {
        router.replace(`/login?redirect=${encodeURIComponent(path)}`);
      }
    })();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname || "/campaigns")}`);
      }
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  useEffect(() => {
    const user = session?.user;
    if (!user) {
      setUserKind("none");
      return;
    }
    const resolveUser = async () => {
      const em = user.email?.toLowerCase().trim();
      if (em === ADMIN_EMAIL_FALLBACK.toLowerCase()) {
        setUserKind("admin");
        return;
      }
      const { data: brand } = await supabase.from("brands").select("id").eq("id", user.id).maybeSingle();
      if (brand) {
        setUserKind("brand");
        return;
      }
      const { data: inf } = await supabase.from("influencers").select("id").eq("id", user.id).maybeSingle();
      setUserKind(inf ? "influencer" : "none");
    };
    resolveUser();
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
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
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

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
      : userKind === "influencer"
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
          : t.login;

  if (!authReady) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-500">…</p>
        </div>
      </div>
    );
  }
  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <Link href={lang === "en" ? "/en" : "/"} className="flex items-center gap-2">
            <Image src="/logo.svg" alt="Influo" width={120} height={40} className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href={dashboardPath} className="text-blue-600 font-medium hover:underline">
              {dashboardLabel}
            </Link>
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
          <Link href={dashboardPath} className="text-blue-600 font-medium hover:underline">
            {userKind === "none" ? t.login : t.myDashboard}
          </Link>
          {userKind === "none" && (
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
          <p className="mt-10 text-slate-500">…</p>
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
                    <h2 className="text-lg font-semibold text-slate-900">{c.title}</h2>
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
