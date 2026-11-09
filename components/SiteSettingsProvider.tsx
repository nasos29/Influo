"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  SITE_SETTING_DEFAULTS,
  type SiteSettings,
} from "@/lib/siteSettings";

const SiteSettingsContext = createContext<SiteSettings>(SITE_SETTING_DEFAULTS);

export function SiteSettingsProvider({
  settings,
  children,
}: {
  settings?: Partial<SiteSettings> | null;
  children: ReactNode;
}) {
  const value = useMemo<SiteSettings>(
    () => ({ ...SITE_SETTING_DEFAULTS, ...(settings || {}) }),
    [settings]
  );
  return (
    <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>
  );
}

export function useSiteSettings(): SiteSettings {
  return useContext(SiteSettingsContext);
}
