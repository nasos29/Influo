"use client";

import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabaseClient";
import { loadOwnProfiles } from "@/lib/ownProfile";
import { lookupAuthUser } from "@/lib/authSession";
import { accountAvatarFromProfiles } from "@/lib/accountAvatar";
import {
  clearHeaderAvatarCache,
  getHeaderAvatarServerSnapshot,
  getHeaderAvatarSnapshot,
  subscribeHeaderAvatar,
  writeHeaderAvatarCache,
} from "@/lib/headerAvatarCache";

const ADMIN_EMAIL_FALLBACK = "nd.6@hotmail.com";

export type PublicUserKind = "none" | "brand" | "influencer" | "admin" | "signed-in";

export type PublicAccountNav = {
  userKind: PublicUserKind;
  identityReady: boolean;
  dashboardPath: string;
  dashboardLabel: string;
  /** Profile photo or brand logo. Empty when the account has none. */
  avatarUrl: string;
  /** Name, brand, or email used only for the initials fallback. */
  avatarName: string;
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
  const snapshot = useSyncExternalStore(
    subscribeHeaderAvatar,
    getHeaderAvatarSnapshot,
    getHeaderAvatarServerSnapshot
  );

  useEffect(() => {
    void refreshHeaderAvatar();
  }, []);

  return {
    userKind: snapshot.userKind,
    identityReady: snapshot.ready,
    dashboardPath: dashboardPathFor(snapshot.userKind),
    dashboardLabel: snapshot.accountName || dashboardLabelFor(snapshot.userKind, lang),
    avatarUrl: snapshot.avatarUrl,
    avatarName: snapshot.avatarName,
  };
}

let refreshInflight: Promise<void> | null = null;

/** Re-check the session without hiding an avatar that is already on screen. */
export function refreshHeaderAvatar(): Promise<void> {
  if (refreshInflight) return refreshInflight;
  refreshInflight = verifyHeaderAvatar().finally(() => {
    refreshInflight = null;
  });
  return refreshInflight;
}

async function verifyHeaderAvatar(): Promise<void> {
  const hadCache = getHeaderAvatarSnapshot().userKind !== "none";
  let finished = false;
  const hardStop = setTimeout(() => {
    if (finished || hadCache) return;
    clearHeaderAvatarCache();
  }, 8000);

  try {
    const auth = await lookupAuthUser(3000);
    const email = auth.user?.email?.trim() || "";
    if (!auth.user) {
      clearHeaderAvatarCache();
      return;
    }
    if (email.toLowerCase() === ADMIN_EMAIL_FALLBACK.toLowerCase()) {
      const profiles = await withTimeout(loadOwnProfiles(supabase), 3500);
      if (!profiles?.ok) {
        if (!hadCache) remember("admin", email, "", email);
        return;
      }
      const avatar = accountAvatarFromProfiles({
        email,
        influencer: profiles.influencer,
        brand: profiles.brand,
      });
      remember("admin", email, avatar.avatarUrl, avatar.avatarName);
      return;
    }
    const profiles = await withTimeout(loadOwnProfiles(supabase), 3500);
    if (!profiles?.ok) {
      if (!hadCache) remember("signed-in", email, "", email);
      return;
    }
    if (profiles?.ok && profiles.brand && !profiles.influencer) {
      const avatar = accountAvatarFromProfiles({ email, brand: profiles.brand });
      remember("brand", avatar.avatarName || email, avatar.avatarUrl, avatar.avatarName);
      return;
    }
    if (profiles?.ok && profiles.influencer) {
      const avatar = accountAvatarFromProfiles({
        email,
        influencer: profiles.influencer,
        brand: profiles.brand,
      });
      remember("influencer", avatar.avatarName || email, avatar.avatarUrl, avatar.avatarName);
      return;
    }
    if (profiles?.ok) {
      clearHeaderAvatarCache();
      return;
    }
    if (!hadCache) remember("signed-in", email, "", email);
  } catch {
    if (!hadCache) remember("signed-in", "", "", "");
  } finally {
    finished = true;
    clearTimeout(hardStop);
  }
}

function remember(
  kind: Exclude<PublicUserKind, "none">,
  accountName: string,
  avatarUrl: string,
  avatarName: string
): void {
  writeHeaderAvatarCache({
    userKind: kind,
    accountName: accountName.trim(),
    avatarUrl: avatarUrl.trim(),
    avatarName: avatarName.trim(),
  });
}
