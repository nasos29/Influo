"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { loadOwnProfiles } from "@/lib/ownProfile";
import { lookupAuthUser } from "@/lib/authSession";

const ADMIN_EMAIL_FALLBACK = "nd.6@hotmail.com";

export type PublicUserKind = "none" | "brand" | "influencer" | "admin" | "signed-in";

export type PublicAccountNav = {
  userKind: PublicUserKind;
  identityReady: boolean;
  dashboardPath: string;
  dashboardLabel: string;
};

function textField(row: Record<string, unknown> | null | undefined, key: string): string {
  const value = row?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      }
    );
  });
}

const labels = {
  el: {
    login: "Σύνδεση",
    myDashboard: "Το dashboard μου",
    brandDashboard: "Dashboard επιχείρησης",
    infDashboard: "Dashboard influencer",
    adminDash: "Admin",
  },
  en: {
    login: "Sign in",
    myDashboard: "My dashboard",
    brandDashboard: "Brand dashboard",
    infDashboard: "Influencer dashboard",
    adminDash: "Admin",
  },
} as const;

export function dashboardPathFor(userKind: PublicUserKind): string {
  if (userKind === "brand") return "/brand/dashboard";
  if (userKind === "influencer" || userKind === "signed-in") return "/dashboard";
  if (userKind === "admin") return "/admin";
  return "/login";
}

export function dashboardLabelFor(userKind: PublicUserKind, lang: "el" | "en"): string {
  const t = labels[lang];
  if (userKind === "brand") return t.brandDashboard;
  if (userKind === "influencer") return t.infDashboard;
  if (userKind === "admin") return t.adminDash;
  if (userKind === "signed-in") return t.myDashboard;
  return t.login;
}

/** Paths that have a dedicated `/en/...` counterpart. */
const BILINGUAL_ROOTS = new Set([
  "",
  "about",
  "blog",
  "brands",
  "campaigns",
  "contact",
  "cookies",
  "directory",
  "docs",
  "faq",
  "for-brands",
  "for-influencers",
  "privacy",
  "terms",
]);

/**
 * Map a pathname to the equivalent URL in `targetLang`.
 * Profile routes (`/in`, `/influencer`) stay on the same path (no `/en` mirror).
 */
export function alternateLocalePath(pathname: string, targetLang: "el" | "en"): string {
  const raw = (pathname || "/").split("?")[0] || "/";
  const isEn = raw === "/en" || raw.startsWith("/en/");
  const withoutEn = isEn ? (raw === "/en" ? "/" : raw.slice(3) || "/") : raw;
  const segments = withoutEn.replace(/^\//, "").split("/").filter(Boolean);
  const root = segments[0] || "";
  const hasEnMirror = root === "" || BILINGUAL_ROOTS.has(root);

  if (targetLang === "en") {
    if (!hasEnMirror) return withoutEn;
    if (withoutEn === "/") return "/en";
    return `/en${withoutEn}`;
  }
  return withoutEn;
}

export function usePublicAccountNav(lang: "el" | "en"): PublicAccountNav {
  const [userKind, setUserKind] = useState<PublicUserKind>("none");
  const [accountName, setAccountName] = useState("");
  const [identityReady, setIdentityReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const finish = (kind: PublicUserKind, name: string) => {
      if (cancelled) return;
      setUserKind(kind);
      setAccountName(name.trim());
      setIdentityReady(true);
    };
    // Profile reads can hang on the auth lock or a failing influencers select.
    // The skeleton must clear even when that happens.
    const hardStop = setTimeout(() => {
      if (!cancelled) setIdentityReady(true);
    }, 8000);

    (async () => {
      const auth = await lookupAuthUser(3000);
      if (cancelled) return;
      const email = auth.user?.email?.trim() || "";
      if (!auth.user) {
        finish("none", "");
        return;
      }
      if (email.toLowerCase() === ADMIN_EMAIL_FALLBACK.toLowerCase()) {
        finish("admin", email);
        return;
      }
      const profiles = await withTimeout(loadOwnProfiles(supabase), 3500);
      if (cancelled) return;
      if (profiles?.ok && profiles.brand && !profiles.influencer) {
        finish("brand", textField(profiles.brand, "brand_name") || email);
        return;
      }
      if (profiles?.ok && profiles.influencer) {
        finish("influencer", textField(profiles.influencer, "display_name") || email);
        return;
      }
      finish(profiles?.ok ? "none" : "signed-in", email);
    })().catch(() => {
      finish("signed-in", "");
    }).finally(() => {
      clearTimeout(hardStop);
    });
    return () => {
      cancelled = true;
      clearTimeout(hardStop);
    };
  }, []);

  return {
    userKind,
    identityReady,
    dashboardPath: dashboardPathFor(userKind),
    dashboardLabel: accountName || dashboardLabelFor(userKind, lang),
  };
}
