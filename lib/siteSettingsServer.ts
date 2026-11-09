import { promises as fs } from "fs";
import path from "path";
import { unstable_cache, revalidatePath, revalidateTag } from "next/cache";
import { supabaseService } from "@/lib/apiAuth";
import {
  SITE_SETTING_DEFAULTS,
  SITE_SETTING_META,
  coerceSiteSetting,
  isSiteSettingKey,
  mergeSiteSettings,
  type SiteSettingKey,
  type SiteSettings,
} from "@/lib/siteSettings";

export const SITE_SETTINGS_CACHE_TAG = "site-settings";

/** Disk fallback until `public.site_settings` exists (additive SQL in docs/SITE_SETTINGS.sql). */
function settingsFilePath(): string {
  return path.join(process.cwd(), "data", "site_settings.json");
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = `${error.code || ""} ${error.message || ""}`;
  return /PGRST205|site_settings|schema cache|does not exist|42P01/i.test(msg);
}

async function readSettingsFile(): Promise<SiteSettings | null> {
  try {
    const raw = await fs.readFile(settingsFilePath(), "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return mergeSiteSettings(parsed);
  } catch {
    return null;
  }
}

async function writeSettingsFile(settings: SiteSettings): Promise<void> {
  const dir = path.dirname(settingsFilePath());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(settingsFilePath(), `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

async function loadSiteSettingsFromDb(): Promise<SiteSettings> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (await readSettingsFile()) || { ...SITE_SETTING_DEFAULTS };
  }
  try {
    const { data, error } = await supabaseService()
      .from("site_settings")
      .select("key, value");
    if (error) {
      if (isMissingTableError(error)) {
        return (await readSettingsFile()) || { ...SITE_SETTING_DEFAULTS };
      }
      console.warn("[siteSettings]", error.code || "", error.message);
      return (await readSettingsFile()) || { ...SITE_SETTING_DEFAULTS };
    }
    // Prefer DB when the table exists, even if empty (defaults).
    return mergeSiteSettings(data || []);
  } catch (err) {
    console.warn("[siteSettings]", err);
    return (await readSettingsFile()) || { ...SITE_SETTING_DEFAULTS };
  }
}

/** Cached site settings (defaults when missing). Fast path for pages/API. */
export const getSiteSettings = unstable_cache(
  loadSiteSettingsFromDb,
  ["site-settings-v1"],
  { revalidate: 300, tags: [SITE_SETTINGS_CACHE_TAG] }
);

export async function getSiteSetting(key: SiteSettingKey): Promise<number> {
  const all = await getSiteSettings();
  return all[key];
}

export type SiteSettingUpdateResult =
  | { ok: true; settings: SiteSettings }
  | { ok: false; error: string; status: number };

function bustSettingsCaches() {
  revalidateTag(SITE_SETTINGS_CACHE_TAG, { expire: 0 });
  for (const tag of ["home-directory", "home-campaigns", "public-campaigns", "directory"]) {
    revalidateTag(tag, { expire: 0 });
  }
  for (const pathName of ["/", "/en", "/directory", "/en/directory", "/campaigns", "/en/campaigns"]) {
    revalidatePath(pathName);
  }
}

export async function updateSiteSetting(
  key: string,
  rawValue: unknown,
  updatedBy: string | null
): Promise<SiteSettingUpdateResult> {
  if (!isSiteSettingKey(key)) {
    return { ok: false, error: "Unknown setting key", status: 400 };
  }
  const meta = SITE_SETTING_META[key];
  const n =
    typeof rawValue === "number"
      ? rawValue
      : typeof rawValue === "string"
        ? Number(rawValue)
        : NaN;
  if (!Number.isFinite(n)) {
    return { ok: false, error: "Value must be a number", status: 400 };
  }
  const rounded = Math.round(n);
  if (rounded < meta.min || rounded > meta.max) {
    return {
      ok: false,
      error: `Value must be between ${meta.min} and ${meta.max}`,
      status: 400,
    };
  }

  const { error } = await supabaseService().from("site_settings").upsert(
    {
      key,
      value: rounded,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    },
    { onConflict: "key" }
  );

  if (error) {
    if (!isMissingTableError(error)) {
      console.error("[siteSettings] update", error.code, error.message);
      return { ok: false, error: error.message || "Update failed", status: 500 };
    }
    // Table not migrated yet: persist on disk so admin saves still work.
    const current = (await readSettingsFile()) || { ...SITE_SETTING_DEFAULTS };
    current[key] = rounded;
    try {
      await writeSettingsFile(current);
    } catch (err) {
      console.error("[siteSettings] file fallback", err);
      return { ok: false, error: "Update failed (no site_settings table yet)", status: 500 };
    }
    bustSettingsCaches();
    return { ok: true, settings: current };
  }

  bustSettingsCaches();

  const settings = { ...(await loadSiteSettingsFromDb()) };
  settings[key] = coerceSiteSetting(key, rounded);
  return { ok: true, settings };
}

export async function resetSiteSetting(
  key: string,
  updatedBy: string | null
): Promise<SiteSettingUpdateResult> {
  if (!isSiteSettingKey(key)) {
    return { ok: false, error: "Unknown setting key", status: 400 };
  }
  return updateSiteSetting(key, SITE_SETTING_META[key].default, updatedBy);
}
