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

/** Priced services. These feed rate_card and the automatic min_rate. Extras are not in this list. */
export const RATE_CARD_PRICE_KEYS = [
  "story",
  "post",
  "reel",
  "facebook",
  "youtube",
  "ugc_video",
  "ugc_photo",
  "carousel",
] as const;

export type RateCardPriceKey = (typeof RATE_CARD_PRICE_KEYS)[number];

/** Optional add-ons stored on rate_card. Never package types and never part of min_rate. */
export const RATE_CARD_EXTRA_KEYS = ["usage_rights_ads", "link_in_bio", "event_visit"] as const;

export type RateCardExtraKey = (typeof RATE_CARD_EXTRA_KEYS)[number];

export type ServiceExtras = Partial<Record<RateCardExtraKey, string>>;

/**
 * Smallest positive package or priced-service rate-card amount, or null when none exist.
 * Zeros, blanks, non-numeric text, and extras (usage rights, link in bio, events) are ignored.
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

export const PACKAGE_PLATFORMS = ["instagram", "tiktok", "youtube", "facebook", "ugc"] as const;
export type PackagePlatform = (typeof PACKAGE_PLATFORMS)[number];

export const PACKAGE_TYPES = [
  "reel",
  "story",
  "post",
  "video",
  "short",
  "carousel",
  "ugc_video",
  "ugc_photo",
] as const;
export type PackageType = (typeof PACKAGE_TYPES)[number];

/** Social posts vs UGC. Extras are not package types. */
export const SOCIAL_PACKAGE_TYPES = ["reel", "story", "post", "carousel", "video", "short"] as const;
export const UGC_PACKAGE_TYPES = ["ugc_video", "ugc_photo"] as const;

export function isUgcPackageType(type: PackageType): boolean {
  return type === "ugc_video" || type === "ugc_photo";
}

/** UGC is not tied to a network. Carousel is an Instagram post. */
export function platformForPackageType(
  type: PackageType,
  platform: PackagePlatform | null
): PackagePlatform | null {
  if (isUgcPackageType(type)) return "ugc";
  if (type === "carousel") return "instagram";
  return platform;
}

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
  /** Exact service price. Public on the creator profile. */
  price?: string;
};

export type PublicExtraView = {
  key: RateCardExtraKey;
  has_price: boolean;
  /** Ceiling tier string from priceTierFromMinRate (e.g. "100"). */
  price_tier: string;
  /** Exact add-on price. Public on the creator profile. */
  price?: string;
};

const PLATFORM_LABEL: Record<PackagePlatform, { el: string; en: string }> = {
  instagram: { el: "Instagram", en: "Instagram" },
  tiktok: { el: "TikTok", en: "TikTok" },
  youtube: { el: "YouTube", en: "YouTube" },
  facebook: { el: "Facebook", en: "Facebook" },
  ugc: { el: "UGC", en: "UGC" },
};

const TYPE_LABEL: Record<PackageType, { el: { one: string; many: string }; en: { one: string; many: string } }> = {
  reel: { el: { one: "Reel", many: "Reels" }, en: { one: "Reel", many: "Reels" } },
  story: { el: { one: "Story", many: "Stories" }, en: { one: "Story", many: "Stories" } },
  post: { el: { one: "Post", many: "Posts" }, en: { one: "Post", many: "Posts" } },
  video: { el: { one: "Video", many: "Videos" }, en: { one: "Video", many: "Videos" } },
  short: { el: { one: "Short", many: "Shorts" }, en: { one: "Short", many: "Shorts" } },
  carousel: { el: { one: "Carousel", many: "Carousels" }, en: { one: "Carousel", many: "Carousels" } },
  ugc_video: { el: { one: "UGC βίντεο", many: "UGC βίντεο" }, en: { one: "UGC video", many: "UGC videos" } },
  ugc_photo: {
    el: { one: "UGC φωτογραφία", many: "UGC φωτογραφίες" },
    en: { one: "UGC photo", many: "UGC photos" },
  },
};

/** Short explanation for services that are new to the rate card. */
export const PACKAGE_TYPE_HINT: Partial<Record<PackageType, { el: string; en: string }>> = {
  carousel: {
    el: "Ανάρτηση Instagram με πολλές εικόνες που σύρει ο χρήστης.",
    en: "An Instagram post with several images the viewer swipes through.",
  },
  ugc_video: {
    el: "Το brand το ανεβάζει όπου θέλει. Ο creator δεν το ποστάρει σε social.",
    en: "The brand publishes it wherever they want. The creator does not post it.",
  },
  ugc_photo: {
    el: "Τιμή ανά φωτογραφία. Βάλε ποσότητα για να το δώσεις ως πακέτο.",
    en: "Price per photo. Set a quantity to offer them as a pack.",
  },
};

export const EXTRA_LABEL: Record<RateCardExtraKey, { el: string; en: string }> = {
  usage_rights_ads: {
    el: "Δικαίωμα χρήσης σε διαφημίσεις",
    en: "Ad usage rights",
  },
  link_in_bio: {
    el: "Link in bio για 30 ημέρες",
    en: "Link in bio for 30 days",
  },
  event_visit: {
    el: "Παρουσία σε event / επίσκεψη σε κατάστημα",
    en: "Event appearance / store visit",
  },
};

export const EXTRA_HINT: Record<RateCardExtraKey, { el: string; en: string }> = {
  usage_rights_ads: {
    el: "Partnership Ads, Spark Ads ή whitelisting. Τιμή ανά μήνα.",
    en: "Partnership Ads, Spark Ads, or whitelisting. Price per month.",
  },
  link_in_bio: {
    el: "Ο σύνδεσμος του brand μένει στο bio για 30 ημέρες.",
    en: "The brand link stays in the bio for 30 days.",
  },
  event_visit: {
    el: "Ο creator παρευρίσκεται σε event ή επισκέπτεται κατάστημα.",
    en: "The creator attends an event or visits a store.",
  },
};

/** Suffix after the formatted amount, e.g. "50 € / μήνα". */
export function packagePriceSuffix(type: PackageType, lang: "el" | "en"): string | null {
  if (type === "ugc_photo") return lang === "el" ? "/ φωτογραφία" : "/ photo";
  return null;
}

export function extraPriceSuffix(key: RateCardExtraKey, lang: "el" | "en"): string | null {
  if (key === "usage_rights_ads") return lang === "el" ? "/ μήνα" : "/ month";
  return null;
}

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
  const typeLabels = TYPE_LABEL[type][lang];
  const typeWord = qty === 1 ? typeLabels.one : typeLabels.many;
  if (platform === "ugc" || isUgcPackageType(type)) return `${qty} ${typeWord}`;
  const plat = PLATFORM_LABEL[platform][lang];
  return `${qty} ${plat} ${typeWord}`;
}

/** List row title. Quantity 1 drops the leading number: "Instagram Reel", "UGC βίντεο". */
export function packageRowTitle(
  platform: PackagePlatform,
  type: PackageType,
  quantity: number,
  lang: "el" | "en" = "en"
): string {
  const qty = clampQuantity(quantity);
  if (qty === 1) {
    const typeWord = TYPE_LABEL[type][lang].one;
    if (platform === "ugc" || isUgcPackageType(type)) return typeWord;
    return `${PLATFORM_LABEL[platform][lang]} ${typeWord}`;
  }
  return packageTitle(platform, type, qty, lang);
}

/** Parse DB / form packages; drops invalid rows. Caps at 6. */
export function normalizeServicePackages(raw: unknown): ServicePackage[] {
  if (!Array.isArray(raw)) return [];
  const out: ServicePackage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const src = item as Record<string, unknown>;
    const type = asType(src.type);
    if (!type) continue;
    const platform = platformForPackageType(type, asPlatform(src.platform));
    if (!platform) continue;
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
    { key: "carousel", platform: "instagram", type: "carousel" },
    { key: "ugc_video", platform: "ugc", type: "ugc_video" },
    { key: "ugc_photo", platform: "ugc", type: "ugc_photo" },
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
    if (out.length >= 8) break;
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
  const view: PublicPackageView = {
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
  if (isConcretePrice(pkg.price)) {
    view.price = typeof pkg.price === "string" ? pkg.price.trim() : String(pkg.price);
  }
  return view;
}

/** Same public package view. Kept so commercial callers stay explicit. */
export function toCommercialPackageView(
  pkg: ServicePackage,
  lang: "el" | "en" = "en",
  tierFromPrice: (price: unknown) => string = () => "0"
): PublicPackageView {
  return toPublicPackageView(pkg, lang, tierFromPrice);
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
    else if (p.type === "carousel") key = "carousel";
    else if (p.type === "ugc_video") key = "ugc_video";
    else if (p.type === "ugc_photo") key = "ugc_photo";
    if (!key) continue;
    if (buckets[key] == null || n < buckets[key]!) buckets[key] = n;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(buckets)) out[k] = String(v);
  return out;
}

export function emptyExtras(): ServiceExtras {
  return { usage_rights_ads: "", link_in_bio: "", event_visit: "" };
}

export function extrasFromRateCard(rateCard: unknown): ServiceExtras {
  const out = emptyExtras();
  if (!rateCard || typeof rateCard !== "object" || Array.isArray(rateCard)) return out;
  const src = rateCard as Record<string, unknown>;
  for (const key of RATE_CARD_EXTRA_KEYS) {
    const value = src[key];
    if (typeof value === "number" && Number.isFinite(value)) out[key] = String(value);
    else if (typeof value === "string") out[key] = value.trim();
  }
  return out;
}

export function extrasHaveInvalidPrice(extras: ServiceExtras): boolean {
  return RATE_CARD_EXTRA_KEYS.some((key) => !isPositivePriceInput(String(extras[key] ?? "")));
}

/** Priced extras only. Blank, zero, and non-numeric text are dropped. */
export function extrasForSave(extras: ServiceExtras): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of RATE_CARD_EXTRA_KEYS) {
    const n = parsePackagePrice(extras[key]);
    if (n > 0) out[key] = String(n);
  }
  return out;
}

/** Package prices plus optional extras. Extras never replace a service key. */
export function mergeRateCard(
  fromPackages: Record<string, string>,
  extras: ServiceExtras
): Record<string, string> {
  return { ...fromPackages, ...extrasForSave(extras) };
}

export function toPublicExtraView(
  key: RateCardExtraKey,
  price: unknown,
  tierFromPrice: (price: unknown) => string = () => "0"
): PublicExtraView {
  const priced = isConcretePrice(price);
  return {
    key,
    has_price: priced,
    price_tier: priced ? tierFromPrice(price) : "0",
  };
}

export function toCommercialExtraView(
  key: RateCardExtraKey,
  price: unknown,
  tierFromPrice: (price: unknown) => string = () => "0"
): PublicExtraView {
  const view = toPublicExtraView(key, price, tierFromPrice);
  if (isConcretePrice(price)) {
    view.price = typeof price === "string" ? price.trim() : String(price);
  }
  return view;
}

function extraSource(rateCard: unknown): Record<string, unknown> {
  if (!rateCard || typeof rateCard !== "object" || Array.isArray(rateCard)) return {};
  return rateCard as Record<string, unknown>;
}

/** Priced extras with the exact amount. Omits keys without a price. */
export function publicExtrasFromRateCard(
  rateCard: unknown,
  tierFromPrice: (price: unknown) => string = () => "0"
): PublicExtraView[] {
  const src = extraSource(rateCard);
  const out: PublicExtraView[] = [];
  for (const key of RATE_CARD_EXTRA_KEYS) {
    if (!isConcretePrice(src[key])) continue;
    out.push(toCommercialExtraView(key, src[key], tierFromPrice));
  }
  return out;
}

export function commercialExtrasFromRateCard(
  rateCard: unknown,
  tierFromPrice: (price: unknown) => string = () => "0"
): PublicExtraView[] {
  const src = extraSource(rateCard);
  const out: PublicExtraView[] = [];
  for (const key of RATE_CARD_EXTRA_KEYS) {
    if (!isConcretePrice(src[key])) continue;
    out.push(toCommercialExtraView(key, src[key], tierFromPrice));
  }
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
