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
import {
  HOMEPAGE_SECTION_ORDER_KEY,
  defaultHomepageSectionOrder,
  parseHomepageSectionOrderSetting,
  serializeHomepageSectionOrderSetting,
  type HomepageSectionId,
} from "@/lib/homepageSections";

export const SITE_SETTINGS_CACHE_TAG = "site-settings";

type SettingsRow = { key: string; value: unknown };

/** Disk fallback until `public.site_settings` exists (additive SQL in docs/SITE_SETTINGS.sql). */
function settingsFilePath(): string {
  return path.join(process.cwd(), "data", "site_settings.json");
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = `${error.code || ""} ${error.message || ""}`;
  return /PGRST205|site_settings|schema cache|does not exist|42P01/i.test(msg);
}

async function readSettingsFileRaw(): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(settingsFilePath(), "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function readSettingsFile(): Promise<SiteSettings | null> {
  const parsed = await readSettingsFileRaw();
  return parsed ? mergeSiteSettings(parsed) : null;
}

async function writeSettingsFile(data: Record<string, unknown>): Promise<void> {
  const dir = path.dirname(settingsFilePath());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(settingsFilePath(), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function loadSettingsRows(): Promise<SettingsRow[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const file = await readSettingsFileRaw();
    if (!file) return [];
    return Object.entries(file).map(([key, value]) => ({ key, value }));
  }
  try {
    const { data, error } = await supabaseService()
      .from("site_settings")
      .select("key, value");
    if (error) {
      if (isMissingTableError(error)) {
        const file = await readSettingsFileRaw();
        if (!file) return [];
        return Object.entries(file).map(([key, value]) => ({ key, value }));
      }
      console.warn("[siteSettings]", error.code || "", error.message);
      const file = await readSettingsFileRaw();
      if (!file) return [];
      return Object.entries(file).map(([key, value]) => ({ key, value }));
    }
    return (data || []).map((row) => ({
      key: String((row as SettingsRow).key || ""),
      value: (row as SettingsRow).value,
    }));
  } catch (err) {
    console.warn("[siteSettings]", err);
    const file = await readSettingsFileRaw();
    if (!file) return [];
    return Object.entries(file).map(([key, value]) => ({ key, value }));
  }
}

async function loadSiteSettingsFromDb(): Promise<SiteSettings> {
  const rows = await loadSettingsRows();
  return rows.length ? mergeSiteSettings(rows) : { ...SITE_SETTING_DEFAULTS };
}

function orderFromRows(rows: SettingsRow[]): {
  order: HomepageSectionId[];
  hidden: HomepageSectionId[];
} {
  const row = rows.find((r) => r.key === HOMEPAGE_SECTION_ORDER_KEY);
  return parseHomepageSectionOrderSetting(row?.value);
}

async function loadHomepageSectionOrderFromDb(): Promise<{
  order: HomepageSectionId[];
  hidden: HomepageSectionId[];
}> {
  return orderFromRows(await loadSettingsRows());
}

/** Cached site settings (defaults when missing). Fast path for pages/API. */
export const getSiteSettings = unstable_cache(
  loadSiteSettingsFromDb,
  ["site-settings-v1"],
  { revalidate: 300, tags: [SITE_SETTINGS_CACHE_TAG] }
);

/** Cached homepage section order (+ optional hidden ids). */
export const getHomepageSectionOrderSetting = unstable_cache(
  loadHomepageSectionOrderFromDb,
  ["homepage-section-order-v1"],
  { revalidate: 300, tags: [SITE_SETTINGS_CACHE_TAG] }
);

export async function getHomepageSectionOrder(): Promise<HomepageSectionId[]> {
  const { order } = await getHomepageSectionOrderSetting();
  return order;
}

export async function getSiteSetting(key: SiteSettingKey): Promise<number> {
  const all = await getSiteSettings();
  return all[key];
}

export type SiteSettingUpdateResult =
  | { ok: true; settings: SiteSettings }
  | { ok: false; error: string; status: number };

export type HomepageSectionOrderUpdateResult =
  | {
      ok: true;
      order: HomepageSectionId[];
      hidden: HomepageSectionId[];
      settings: SiteSettings;
    }
  | { ok: false; error: string; status: number };

function bustSettingsCaches() {
  revalidateTag(SITE_SETTINGS_CACHE_TAG, { expire: 0 });
  for (const tag of ["home-directory", "home-campaigns", "public-campaigns", "directory"]) {
    revalidateTag(tag, { expire: 0 });
  }
  for (const pathName of [
    "/",
    "/en",
    "/directory",
    "/en/directory",
    "/campaigns",
    "/en/campaigns",
    "/blog",
    "/en/blog",
  ]) {
    revalidatePath(pathName);
  }
}

async function upsertSettingValue(
  key: string,
  value: unknown,
  updatedBy: string | null
): Promise<{ ok: true } | { ok: false; error: string; status: number; missingTable?: boolean }> {
  const { error } = await supabaseService().from("site_settings").upsert(
    {
      key,
      value,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    },
    { onConflict: "key" }
  );

  if (!error) return { ok: true };

  if (!isMissingTableError(error)) {
    console.error("[siteSettings] update", error.code, error.message);
    return { ok: false, error: error.message || "Update failed", status: 500 };
  }
  return { ok: false, error: "missing table", status: 500, missingTable: true };
}

async function writeFileFallbackKey(key: string, value: unknown): Promise<boolean> {
  try {
    const current = (await readSettingsFileRaw()) || { ...SITE_SETTING_DEFAULTS };
    current[key] = value;
    await writeSettingsFile(current);
    return true;
  } catch (err) {
    console.error("[siteSettings] file fallback", err);
    return false;
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

  const upsert = await upsertSettingValue(key, rounded, updatedBy);
  if (!upsert.ok) {
    if (!upsert.missingTable) return { ok: false, error: upsert.error, status: upsert.status };
    const current = (await readSettingsFile()) || { ...SITE_SETTING_DEFAULTS };
    current[key] = rounded;
    const wrote = await writeFileFallbackKey(key, rounded);
    if (!wrote) {
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

export async function updateHomepageSectionOrder(
  rawOrder: unknown,
  rawHidden: unknown,
  updatedBy: string | null
): Promise<HomepageSectionOrderUpdateResult> {
  const parsed = parseHomepageSectionOrderSetting({
    order: rawOrder,
    hidden: rawHidden,
  });
  const value = serializeHomepageSectionOrderSetting(parsed.order, parsed.hidden);

  const upsert = await upsertSettingValue(HOMEPAGE_SECTION_ORDER_KEY, value, updatedBy);
  if (!upsert.ok) {
    if (!upsert.missingTable) {
      return { ok: false, error: upsert.error, status: upsert.status };
    }
    const wrote = await writeFileFallbackKey(HOMEPAGE_SECTION_ORDER_KEY, value);
    if (!wrote) {
      return { ok: false, error: "Update failed (no site_settings table yet)", status: 500 };
    }
  }

  bustSettingsCaches();
  const settings = await loadSiteSettingsFromDb();
  const next = parseHomepageSectionOrderSetting(value);
  return { ok: true, order: next.order, hidden: next.hidden, settings };
}

export async function resetHomepageSectionOrder(
  updatedBy: string | null
): Promise<HomepageSectionOrderUpdateResult> {
  return updateHomepageSectionOrder(defaultHomepageSectionOrder(), [], updatedBy);
}
