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
  const [identityReady, setIdentityReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const auth = await lookupAuthUser(8000);
      if (cancelled) return;
      if (!auth.user) {
        setUserKind("none");
        setIdentityReady(true);
        return;
      }
      const email = auth.user.email?.toLowerCase().trim();
      if (email === ADMIN_EMAIL_FALLBACK.toLowerCase()) {
        setUserKind("admin");
        setIdentityReady(true);
        return;
      }
      let profiles = await loadOwnProfiles(supabase);
      if (!profiles.ok) profiles = await loadOwnProfiles(supabase);
      if (cancelled) return;
      if (profiles.ok && profiles.brand && !profiles.influencer) {
        setUserKind("brand");
      } else if (profiles.ok && profiles.influencer) {
        setUserKind("influencer");
      } else if (profiles.ok) {
        setUserKind("none");
      } else {
        setUserKind("signed-in");
      }
      setIdentityReady(true);
    })().catch(() => {
      if (cancelled) return;
      setUserKind("none");
      setIdentityReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    userKind,
    identityReady,
    dashboardPath: dashboardPathFor(userKind),
    dashboardLabel: dashboardLabelFor(userKind, lang),
  };
}
