/**
 * Creator service packages (Collabstr-style) stored in influencers.service_packages jsonb.
 * Titles are derived; display-only fallbacks from rate_card never write to the DB.
 */

/** Local copies so this module stays free of cycles with publicInfluencer. */
function isConcretePrice(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^(ask|ρώτησε|ρωτησε)$/i.test(trimmed)) return false;
  return true;
}

function parsePackagePrice(price: unknown): number {
  if (typeof price === "number") return Number.isFinite(price) && price > 0 ? price : 0;
  if (typeof price !== "string") return 0;
  const raw = price.trim();
  if (!raw || raw.startsWith("-")) return 0;
  const parsed = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return parsed || 0;
}

/** Empty is allowed. A filled price must be a number greater than 0. */
export function isPositivePriceInput(price: string): boolean {
  const trimmed = price.trim();
  if (!trimmed) return true;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return false;
  return parseFloat(trimmed) > 0;
}

export function packagesHaveInvalidPrice(packages: Array<{ price?: string | null }>): boolean {
  return packages.some((p) => !isPositivePriceInput(String(p.price ?? "")));
}

const RATE_CARD_PRICE_KEYS = ["story", "post", "reel", "facebook", "youtube"] as const;

/**
 * Smallest positive package or rate-card amount, or null when none exist.
 * Zeros, blanks, and non-numeric text are ignored.
 */
export function deriveMinRate(servicePackages: unknown, rateCard: unknown): string | null {
  let min = Infinity;
  const consider = (value: unknown) => {
    const n = parsePackagePrice(value);
    if (n > 0 && n < min) min = n;
  };
  for (const pkg of normalizeServicePackages(servicePackages)) consider(pkg.price);
  if (rateCard && typeof rateCard === "object" && !Array.isArray(rateCard)) {
    const src = rateCard as Record<string, unknown>;
    for (const key of RATE_CARD_PRICE_KEYS) consider(src[key]);
  }
  if (!Number.isFinite(min) || min === Infinity) return null;
  return String(min);
}

export const PACKAGE_PLATFORMS = ["instagram", "tiktok", "youtube", "facebook"] as const;
export type PackagePlatform = (typeof PACKAGE_PLATFORMS)[number];

export const PACKAGE_TYPES = ["reel", "story", "post", "video", "short"] as const;
export type PackageType = (typeof PACKAGE_TYPES)[number];

export const USAGE_RIGHTS = ["none", "30d", "90d", "perpetual"] as const;
export type UsageRights = (typeof USAGE_RIGHTS)[number];

export type ServicePackage = {
  id: string;
  platform: PackagePlatform;
  type: PackageType;
  quantity: number;
  price: string;
  delivery_days?: number | null;
  usage_rights?: UsageRights | null;
  description?: string | null;
};

export type PublicPackageView = {
  id: string;
  platform: PackagePlatform;
  type: PackageType;
  quantity: number;
  title: string;
  description: string;
  delivery_days: number | null;
  usage_rights: UsageRights | null;
  has_price: boolean;
  /** Ceiling tier string from priceTierFromMinRate (e.g. "100"). */
  price_tier: string;
  /** Exact price — only present in commercial/brand payloads. */
  price?: string;
};

const PLATFORM_LABEL: Record<PackagePlatform, { el: string; en: string }> = {
  instagram: { el: "Instagram", en: "Instagram" },
  tiktok: { el: "TikTok", en: "TikTok" },
  youtube: { el: "YouTube", en: "YouTube" },
  facebook: { el: "Facebook", en: "Facebook" },
};

const TYPE_LABEL: Record<PackageType, { el: { one: string; many: string }; en: { one: string; many: string } }> = {
  reel: { el: { one: "Reel", many: "Reels" }, en: { one: "Reel", many: "Reels" } },
  story: { el: { one: "Story", many: "Stories" }, en: { one: "Story", many: "Stories" } },
  post: { el: { one: "Post", many: "Posts" }, en: { one: "Post", many: "Posts" } },
  video: { el: { one: "Video", many: "Videos" }, en: { one: "Video", many: "Videos" } },
  short: { el: { one: "Short", many: "Shorts" }, en: { one: "Short", many: "Shorts" } },
};

export const USAGE_RIGHTS_LABEL: Record<UsageRights, { el: string; en: string }> = {
  none: { el: "Χωρίς επιπλέον δικαιώματα", en: "No extended usage" },
  "30d": { el: "30 ημέρες", en: "30 days" },
  "90d": { el: "90 ημέρες", en: "90 days" },
  perpetual: { el: "Απεριόριστα", en: "Perpetual" },
};

export function newPackageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultPackages(): ServicePackage[] {
  return [
    {
      id: newPackageId(),
      platform: "instagram",
      type: "reel",
      quantity: 1,
      price: "",
      delivery_days: 7,
      usage_rights: "none",
      description: "",
    },
    {
      id: newPackageId(),
      platform: "instagram",
      type: "story",
      quantity: 1,
      price: "",
      delivery_days: 3,
      usage_rights: "none",
      description: "",
    },
  ];
}

function asPlatform(raw: unknown): PackagePlatform | null {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  return (PACKAGE_PLATFORMS as readonly string[]).includes(v) ? (v as PackagePlatform) : null;
}

function asType(raw: unknown): PackageType | null {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  return (PACKAGE_TYPES as readonly string[]).includes(v) ? (v as PackageType) : null;
}

function asUsage(raw: unknown): UsageRights | null {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (!v) return null;
  return (USAGE_RIGHTS as readonly string[]).includes(v) ? (v as UsageRights) : null;
}

function clampQuantity(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return 1;
  return Math.min(5, Math.max(1, Math.round(n)));
}

export function packageTitle(
  platform: PackagePlatform,
  type: PackageType,
  quantity: number,
  lang: "el" | "en" = "en"
): string {
  const qty = clampQuantity(quantity);
  const plat = PLATFORM_LABEL[platform][lang];
  const typeLabels = TYPE_LABEL[type][lang];
  const typeWord = qty === 1 ? typeLabels.one : typeLabels.many;
  return `${qty} ${plat} ${typeWord}`;
}

/** Parse DB / form packages; drops invalid rows. Caps at 6. */
export function normalizeServicePackages(raw: unknown): ServicePackage[] {
  if (!Array.isArray(raw)) return [];
  const out: ServicePackage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const src = item as Record<string, unknown>;
    const platform = asPlatform(src.platform);
    const type = asType(src.type);
    if (!platform || !type) continue;
    const priceRaw =
      typeof src.price === "number" && Number.isFinite(src.price)
        ? String(src.price)
        : typeof src.price === "string"
          ? src.price.trim()
          : "";
    const daysRaw = src.delivery_days;
    let delivery_days: number | null = null;
    if (daysRaw != null && daysRaw !== "") {
      const d = typeof daysRaw === "number" ? daysRaw : parseInt(String(daysRaw), 10);
      if (Number.isFinite(d) && d >= 0) delivery_days = Math.min(365, Math.round(d));
    }
    out.push({
      id: typeof src.id === "string" && src.id.trim() ? src.id.trim() : newPackageId(),
      platform,
      type,
      quantity: clampQuantity(src.quantity),
      price: priceRaw,
      delivery_days,
      usage_rights: asUsage(src.usage_rights),
      description: typeof src.description === "string" ? src.description.trim() : "",
    });
    if (out.length >= 6) break;
  }
  return out;
}

/** Display-only packages from rate_card when service_packages is empty. Never persist. */
export function packagesFromRateCard(rateCard: unknown): ServicePackage[] {
  if (!rateCard || typeof rateCard !== "object" || Array.isArray(rateCard)) return [];
  const src = rateCard as Record<string, unknown>;
  const mapping: Array<{ key: string; platform: PackagePlatform; type: PackageType }> = [
    { key: "story", platform: "instagram", type: "story" },
    { key: "post", platform: "instagram", type: "post" },
    { key: "reel", platform: "instagram", type: "reel" },
    { key: "youtube", platform: "youtube", type: "video" },
    { key: "facebook", platform: "facebook", type: "post" },
  ];
  const out: ServicePackage[] = [];
  for (const m of mapping) {
    if (!isConcretePrice(src[m.key])) continue;
    const price =
      typeof src[m.key] === "number" ? String(src[m.key]) : String(src[m.key]).trim();
    out.push({
      id: `rate_${m.key}`,
      platform: m.platform,
      type: m.type,
      quantity: 1,
      price,
      delivery_days: null,
      usage_rights: null,
      description: "",
    });
    if (out.length >= 6) break;
  }
  return out;
}

export function resolvePackagesForDisplay(
  servicePackages: unknown,
  rateCard: unknown
): ServicePackage[] {
  const fromDb = normalizeServicePackages(servicePackages).filter((p) => isConcretePrice(p.price));
  if (fromDb.length) return fromDb;
  return packagesFromRateCard(rateCard);
}

/** `tierFromPrice` supplied by caller (usually priceTierFromMinRate) to avoid import cycles. */
export function toPublicPackageView(
  pkg: ServicePackage,
  lang: "el" | "en" = "en",
  tierFromPrice: (price: unknown) => string = () => "0"
): PublicPackageView {
  return {
    id: pkg.id,
    platform: pkg.platform,
    type: pkg.type,
    quantity: pkg.quantity,
    title: packageTitle(pkg.platform, pkg.type, pkg.quantity, lang),
    description: pkg.description || "",
    delivery_days: pkg.delivery_days ?? null,
    usage_rights: pkg.usage_rights ?? null,
    has_price: isConcretePrice(pkg.price),
    price_tier: tierFromPrice(pkg.price),
  };
}

export function toCommercialPackageView(
  pkg: ServicePackage,
  lang: "el" | "en" = "en",
  tierFromPrice: (price: unknown) => string = () => "0"
): PublicPackageView {
  const view = toPublicPackageView(pkg, lang, tierFromPrice);
  if (isConcretePrice(pkg.price)) {
    view.price =
      typeof pkg.price === "string" ? pkg.price.trim() : String(pkg.price);
  }
  return view;
}

/** Cheapest priced package → min_rate string, or null. */
export function minRateFromPackages(packages: ServicePackage[]): string | null {
  let min = Infinity;
  for (const p of packages) {
    const n = parsePackagePrice(p.price);
    if (n > 0 && n < min) min = n;
  }
  if (!Number.isFinite(min) || min === Infinity) return null;
  return String(min);
}

/**
 * Build rate_card from packages: cheapest price per content type key
 * (story/post/reel/youtube/facebook) for recommendations / top score compat.
 */
export function rateCardFromPackages(packages: ServicePackage[]): Record<string, string> {
  const buckets: Record<string, number> = {};
  for (const p of packages) {
    const n = parsePackagePrice(p.price);
    if (!(n > 0)) continue;
    let key: string | null = null;
    if (p.type === "story") key = "story";
    else if (p.type === "post") key = p.platform === "facebook" ? "facebook" : "post";
    else if (p.type === "reel" || p.type === "short") key = "reel";
    else if (p.type === "video") key = p.platform === "youtube" ? "youtube" : "reel";
    if (!key) continue;
    if (buckets[key] == null || n < buckets[key]!) buckets[key] = n;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(buckets)) out[k] = String(v);
  return out;
}

/** Persist shape for jsonb (max 6). */
export function packagesForSave(packages: ServicePackage[]): ServicePackage[] {
  return normalizeServicePackages(packages)
    .filter((p) => parsePackagePrice(p.price) > 0)
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      platform: p.platform,
      type: p.type,
      quantity: p.quantity,
      price: String(parsePackagePrice(p.price)),
      delivery_days: p.delivery_days ?? null,
      usage_rights: p.usage_rights ?? null,
      description: p.description || "",
    }));
}
