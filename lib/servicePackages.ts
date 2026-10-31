/**
 * Creator service packages (Collabstr-style) stored in influencers.service_packages jsonb.
 * Titles are derived; display-only fallbacks from rate_card never write to the DB.
 */

import { isListedPrice, listedPriceMin, parseListedPrice } from "@/lib/parsePrice";

function isConcretePrice(value: unknown): boolean {
  return isListedPrice(value);
}

/** Lower bound of a listed price. 0 when the value is ignored. */
function parsePackagePrice(price: unknown): number {
  return listedPriceMin(price) ?? 0;
}

/** Positive listed amount (range lower bound), or null. */
export function listedPriceAmount(price: unknown): number | null {
  return listedPriceMin(price);
}

/** Shown when a creator or admin enters a range or anything other than one positive integer. */
export const FIXED_PRICE_MESSAGE = {
  el: "Βάλε μία σταθερή τιμή, όχι εύρος",
  en: "Enter one fixed price, not a range.",
} as const;

const RANGE_MARK = /[-–—]/;

/**
 * Editor and API input. Empty is allowed. A filled price must be one positive
 * integer in euros (1, 2, 150). Ranges, decimals, and other text are rejected.
 */
export function isPositivePriceInput(price: string): boolean {
  const trimmed = price.trim();
  if (!trimmed) return true;
  if (RANGE_MARK.test(trimmed)) return false;
  if (!/^[1-9]\d*$/.test(trimmed)) return false;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) && n >= 1;
}

function fixedIntegerText(price: unknown): string | null {
  const text = typeof price === "number" && Number.isInteger(price) ? String(price) : typeof price === "string" ? price.trim() : "";
  if (!text || !isPositivePriceInput(text)) return null;
  return text;
}

function isBlankOrZero(price: unknown): boolean {
  if (price == null || price === "") return true;
  if (typeof price === "number") return price === 0;
  if (typeof price === "string") return price.trim() === "" || price.trim() === "0";
  return false;
}

/** True when a package or rate-card value is filled but not one positive integer. */
export function hasUnfixedCreatorPrice(servicePackages: unknown, rateCard: unknown): boolean {
  const bad = (price: unknown) => !isBlankOrZero(price) && !fixedIntegerText(price);
  if (Array.isArray(servicePackages)) {
    for (const pkg of servicePackages) {
      if (!pkg || typeof pkg !== "object") continue;
      if (bad((pkg as { price?: unknown }).price)) return true;
    }
  }
  if (rateCard && typeof rateCard === "object" && !Array.isArray(rateCard)) {
    const src = rateCard as Record<string, unknown>;
    for (const key of [...RATE_CARD_PRICE_KEYS, ...RATE_CARD_EXTRA_KEYS, ...LEGACY_RATE_CARD_KEYS]) {
      if (bad(src[key])) return true;
    }
  }
  return false;
}

export function packagesHaveInvalidPrice(packages: Array<{ price?: string | null }>): boolean {
  return packages.some((p) => !isPositivePriceInput(String(p.price ?? "")));
}

export const PACKAGE_PLATFORMS = ["instagram", "tiktok", "youtube", "facebook", "ugc", "other"] as const;
export type PackagePlatform = (typeof PACKAGE_PLATFORMS)[number];

export const PACKAGE_TYPES = [
  "reel",
  "story",
  "post",
  "video",
  "short",
  "carousel",
  "live",
  "collab",
  "story_link",
  "spark",
  "integration",
  "ugc_video",
  "ugc_photo",
  "event",
  "bio",
  "giveaway",
] as const;
export type PackageType = (typeof PACKAGE_TYPES)[number];

/** Social posts vs UGC. Add-ons and the «Άλλα» tab are not social package types. */
export const SOCIAL_PACKAGE_TYPES = [
  "reel",
  "story",
  "post",
  "carousel",
  "video",
  "short",
  "live",
  "collab",
  "story_link",
  "spark",
  "integration",
] as const;
export const UGC_PACKAGE_TYPES = ["ugc_video", "ugc_photo"] as const;

export function isUgcPackageType(type: PackageType): boolean {
  return type === "ugc_video" || type === "ugc_photo";
}

/** UGC is not tied to a network. Some types belong to one platform. */
export function platformForPackageType(
  type: PackageType,
  platform: PackagePlatform | null
): PackagePlatform | null {
  if (isUgcPackageType(type)) return "ugc";
  if (type === "carousel" || type === "collab" || type === "story_link") return "instagram";
  if (type === "spark") return "tiktok";
  if (type === "integration") return "youtube";
  if (type === "event" || type === "bio" || type === "giveaway") return "other";
  return platform;
}

export type ServiceGroup = "instagram" | "tiktok" | "youtube" | "ugc" | "other" | "addon";

/**
 * One list for signup, profile edit, public tabs, «Από», min_rate, compare, and popups.
 * `basic` rows stay visible. The rest sit under «Περισσότερες υπηρεσίες».
 * Add-ons are fixed euro amounts and never count toward «Από» / min_rate.
 */
export const SERVICE_CATALOG = [
  {
    key: "story",
    kind: "service",
    group: "instagram",
    requires: "instagram",
    basic: true,
    platform: "instagram",
    type: "story",
    title: { el: "Instagram Story", en: "Instagram Story" },
    description: { el: "Story στο Instagram, για 24 ώρες.", en: "An Instagram story, up for 24 hours." },
  },
  {
    key: "post",
    kind: "service",
    group: "instagram",
    requires: "instagram",
    basic: true,
    platform: "instagram",
    type: "post",
    title: { el: "Instagram Post", en: "Instagram Post" },
    description: { el: "Ανάρτηση στη ροή του Instagram.", en: "A post on the Instagram feed." },
  },
  {
    key: "reel",
    kind: "service",
    group: "instagram",
    requires: "instagram",
    basic: true,
    platform: "instagram",
    type: "reel",
    title: { el: "Instagram Reel", en: "Instagram Reel" },
    description: { el: "Σύντομο βίντεο στο Instagram.", en: "A short video on Instagram." },
  },
  {
    key: "carousel",
    kind: "service",
    group: "instagram",
    requires: "instagram",
    basic: false,
    platform: "instagram",
    type: "carousel",
    title: { el: "Carousel", en: "Carousel" },
    description: { el: "Ανάρτηση με πολλές εικόνες.", en: "A post with several images." },
  },
  {
    key: "ig_live",
    kind: "service",
    group: "instagram",
    requires: "instagram",
    basic: false,
    platform: "instagram",
    type: "live",
    title: { el: "Live", en: "Live" },
    description: { el: "Ζωντανή μετάδοση στο Instagram.", en: "A live stream on Instagram." },
  },
  {
    key: "collab_post",
    kind: "service",
    group: "instagram",
    requires: "instagram",
    basic: false,
    platform: "instagram",
    type: "collab",
    title: { el: "Collab post", en: "Collab post" },
    description: { el: "Κοινή ανάρτηση με το brand.", en: "A post published together with the brand." },
  },
  {
    key: "story_link",
    kind: "service",
    group: "instagram",
    requires: "instagram",
    basic: false,
    platform: "instagram",
    type: "story_link",
    title: { el: "Story με link", en: "Story with link" },
    description: { el: "Story με σύνδεσμο προς το brand.", en: "A story that includes a link to the brand." },
  },
  {
    key: "tiktok",
    kind: "service",
    group: "tiktok",
    requires: "tiktok",
    basic: true,
    platform: "tiktok",
    type: "video",
    title: { el: "TikTok Video", en: "TikTok Video" },
    description: { el: "Βίντεο που ανεβαίνει στο TikTok.", en: "A video posted on TikTok." },
  },
  {
    key: "tiktok_story",
    kind: "service",
    group: "tiktok",
    requires: "tiktok",
    basic: false,
    platform: "tiktok",
    type: "story",
    title: { el: "TikTok Story", en: "TikTok Story" },
    description: { el: "Story στο TikTok.", en: "A story on TikTok." },
  },
  {
    key: "tiktok_live",
    kind: "service",
    group: "tiktok",
    requires: "tiktok",
    basic: false,
    platform: "tiktok",
    type: "live",
    title: { el: "Live", en: "Live" },
    description: { el: "Ζωντανή μετάδοση στο TikTok.", en: "A live stream on TikTok." },
  },
  {
    key: "spark_ads",
    kind: "service",
    group: "tiktok",
    requires: "tiktok",
    basic: false,
    platform: "tiktok",
    type: "spark",
    title: { el: "Spark Ads", en: "Spark Ads" },
    description: { el: "Το brand προωθεί το βίντεο ως διαφήμιση.", en: "The brand boosts the video as an ad." },
  },
  {
    key: "youtube",
    kind: "service",
    group: "youtube",
    requires: "youtube",
    basic: true,
    platform: "youtube",
    type: "video",
    title: { el: "YouTube Video", en: "YouTube Video" },
    description: { el: "Βίντεο που ανεβαίνει στο YouTube.", en: "A video posted on YouTube." },
  },
  {
    key: "youtube_short",
    kind: "service",
    group: "youtube",
    requires: "youtube",
    basic: false,
    platform: "youtube",
    type: "short",
    title: { el: "YouTube Short", en: "YouTube Short" },
    description: { el: "Σύντομο βίντεο στο YouTube.", en: "A short video on YouTube." },
  },
  {
    key: "yt_integration",
    kind: "service",
    group: "youtube",
    requires: "youtube",
    basic: false,
    platform: "youtube",
    type: "integration",
    title: { el: "Integration", en: "Integration" },
    description: { el: "Αναφορά του brand μέσα σε βίντεο.", en: "A brand mention inside a video." },
  },
  {
    key: "ugc_video",
    kind: "service",
    group: "ugc",
    requires: null,
    basic: true,
    platform: "ugc",
    type: "ugc_video",
    title: { el: "UGC Video", en: "UGC Video" },
    description: { el: "Βίντεο που το χρησιμοποιεί το brand.", en: "A video the brand can publish." },
  },
  {
    key: "ugc_photo",
    kind: "service",
    group: "ugc",
    requires: null,
    basic: false,
    platform: "ugc",
    type: "ugc_photo",
    title: { el: "UGC φωτογραφίες", en: "UGC photos" },
    description: { el: "Φωτογραφίες που τις χρησιμοποιεί το brand.", en: "Photos the brand can publish." },
  },
  {
    key: "event_visit",
    kind: "service",
    group: "other",
    requires: null,
    basic: false,
    platform: "other",
    type: "event",
    title: { el: "Παρουσία σε event", en: "Event appearance" },
    description: { el: "Παρουσία σε event ή επίσκεψη.", en: "An appearance at an event or a visit." },
  },
  {
    key: "link_in_bio",
    kind: "service",
    group: "other",
    requires: null,
    basic: false,
    platform: "other",
    type: "bio",
    title: { el: "Link in bio", en: "Link in bio" },
    description: { el: "Ο σύνδεσμος του brand μένει στο bio.", en: "The brand link stays in the bio." },
  },
  {
    key: "giveaway",
    kind: "service",
    group: "other",
    requires: null,
    basic: false,
    platform: "other",
    type: "giveaway",
    title: { el: "Giveaway", en: "Giveaway" },
    description: { el: "Κλήρωση για το κοινό.", en: "A giveaway for the audience." },
  },
  {
    key: "usage_rights_ads",
    kind: "addon",
    group: "addon",
    requires: null,
    basic: false,
    platform: null,
    type: null,
    title: { el: "Δικαιώματα χρήσης (30 ημέρες)", en: "Usage rights (30 days)" },
    description: {
      el: "Το brand χρησιμοποιεί το περιεχόμενο για 30 ημέρες.",
      en: "The brand can use the content for 30 days.",
    },
  },
  {
    key: "exclusivity",
    kind: "addon",
    group: "addon",
    requires: null,
    basic: false,
    platform: null,
    type: null,
    title: { el: "Αποκλειστικότητα", en: "Exclusivity" },
    description: {
      el: "Χωρίς ανταγωνιστικό brand για τη συνεργασία.",
      en: "No competing brand for this collaboration.",
    },
  },
  {
    key: "raw_footage",
    kind: "addon",
    group: "addon",
    requires: null,
    basic: false,
    platform: null,
    type: null,
    title: { el: "Raw footage", en: "Raw footage" },
    description: { el: "Το υλικό χωρίς μοντάζ.", en: "The footage without editing." },
  },
  {
    key: "rush_delivery",
    kind: "addon",
    group: "addon",
    requires: null,
    basic: false,
    platform: null,
    type: null,
    title: { el: "Γρήγορη παράδοση", en: "Fast delivery" },
    description: { el: "Παράδοση νωρίτερα από το συνηθισμένο.", en: "Delivery sooner than usual." },
  },
] as const;

export type ServiceCatalogItem = (typeof SERVICE_CATALOG)[number];
export type ServiceCatalogKey = ServiceCatalogItem["key"];
type CatalogKind = ServiceCatalogItem["kind"];
type KeysOfKind<K extends CatalogKind> = Extract<ServiceCatalogItem, { kind: K }>["key"];

/** Priced services. These feed rate_card and the automatic min_rate. Add-ons are not in this list. */
export const RATE_CARD_PRICE_KEYS = SERVICE_CATALOG.flatMap((item) =>
  item.kind === "service" ? [item.key] : []
) as KeysOfKind<"service">[];

export type RateCardPriceKey = KeysOfKind<"service">;

/** Optional add-ons stored on rate_card. Never part of «Από» or min_rate. */
export const RATE_CARD_EXTRA_KEYS = SERVICE_CATALOG.flatMap((item) =>
  item.kind === "addon" ? [item.key] : []
) as KeysOfKind<"addon">[];

export type RateCardExtraKey = KeysOfKind<"addon">;

/** Stored prices we do not offer as a service. Kept on save, hidden everywhere else. */
export const LEGACY_RATE_CARD_KEYS = ["facebook"] as const;

export type ServiceExtras = Partial<Record<RateCardExtraKey, string>>;

export type CreatorServicePrices = Record<ServiceCatalogKey, string>;

const CATALOG_BY_KEY = new Map(SERVICE_CATALOG.map((item) => [item.key, item]));

export function catalogItemByKey(key: string): ServiceCatalogItem | undefined {
  return CATALOG_BY_KEY.get(key as ServiceCatalogKey);
}

export function catalogItemForPackage(
  platform: PackagePlatform,
  type: PackageType
): ServiceCatalogItem | undefined {
  return SERVICE_CATALOG.find((item) => item.platform === platform && item.type === type);
}

export function catalogItemVisible(item: ServiceCatalogItem, accounts: unknown): boolean {
  if (item.requires == null) return true;
  return creatorNetworksFromAccounts(accounts)[item.requires];
}

/** Keys the creator price form is editing. Hidden platform prices stay on the card. */
export function managedCreatorPriceKeys(accounts: unknown): ServiceCatalogKey[] {
  return SERVICE_CATALOG.filter((item) => item.kind === "addon" || catalogItemVisible(item, accounts)).map(
    (item) => item.key
  );
}

/**
 * Smallest positive package or priced-service rate-card amount, or null when none exist.
 * Zeros, blanks, non-numeric text, add-ons, and legacy Facebook prices are ignored.
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
  /** Ceiling tier string from priceTierFromMinRate (e.g. "100"). Budget filters only. */
  price_tier: string;
  /** Exact amount for the guest «Από X €» label. Lower bound when the price is a range. */
  from_price: number | null;
  /** Upper bound when the stored price is a range. The service card renders «30–100 €». */
  price_max?: number | null;
  /** Exact service price, including a stored range. Public on the creator profile. */
  price?: string;
};

export type PublicExtraView = {
  key: RateCardExtraKey;
  has_price: boolean;
  /** Ceiling tier. Budget filters only — guests read `from_price`. */
  price_tier: string;
  /** Exact amount for the guest «Από X €» label. Lower bound when the price is a range. */
  from_price: number | null;
  /** Upper bound when the stored price is a range. */
  price_max?: number | null;
  /** Exact add-on price, including a stored range. Public on the creator profile. */
  price?: string;
};

const PLATFORM_LABEL: Record<PackagePlatform, { el: string; en: string }> = {
  instagram: { el: "Instagram", en: "Instagram" },
  tiktok: { el: "TikTok", en: "TikTok" },
  youtube: { el: "YouTube", en: "YouTube" },
  facebook: { el: "Facebook", en: "Facebook" },
  ugc: { el: "UGC", en: "UGC" },
  other: { el: "Άλλα", en: "Other" },
};

const TYPE_LABEL: Record<PackageType, { el: { one: string; many: string }; en: { one: string; many: string } }> = {
  reel: { el: { one: "Reel", many: "Reels" }, en: { one: "Reel", many: "Reels" } },
  story: { el: { one: "Story", many: "Stories" }, en: { one: "Story", many: "Stories" } },
  post: { el: { one: "Post", many: "Posts" }, en: { one: "Post", many: "Posts" } },
  video: { el: { one: "Video", many: "Videos" }, en: { one: "Video", many: "Videos" } },
  short: { el: { one: "Short", many: "Shorts" }, en: { one: "Short", many: "Shorts" } },
  carousel: { el: { one: "Carousel", many: "Carousels" }, en: { one: "Carousel", many: "Carousels" } },
  live: { el: { one: "Live", many: "Lives" }, en: { one: "Live", many: "Lives" } },
  collab: { el: { one: "Collab post", many: "Collab posts" }, en: { one: "Collab post", many: "Collab posts" } },
  story_link: {
    el: { one: "Story με link", many: "Stories με link" },
    en: { one: "Story with link", many: "Stories with link" },
  },
  spark: { el: { one: "Spark Ads", many: "Spark Ads" }, en: { one: "Spark Ads", many: "Spark Ads" } },
  integration: { el: { one: "Integration", many: "Integrations" }, en: { one: "Integration", many: "Integrations" } },
  ugc_video: { el: { one: "UGC βίντεο", many: "UGC βίντεο" }, en: { one: "UGC video", many: "UGC videos" } },
  ugc_photo: {
    el: { one: "UGC φωτογραφία", many: "UGC φωτογραφίες" },
    en: { one: "UGC photo", many: "UGC photos" },
  },
  event: {
    el: { one: "Παρουσία σε event", many: "Παρουσίες σε event" },
    en: { one: "Event appearance", many: "Event appearances" },
  },
  bio: { el: { one: "Link in bio", many: "Link in bio" }, en: { one: "Link in bio", many: "Link in bio" } },
  giveaway: { el: { one: "Giveaway", many: "Giveaways" }, en: { one: "Giveaway", many: "Giveaways" } },
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

function addonCopy(field: "title" | "description"): Record<RateCardExtraKey, { el: string; en: string }> {
  const out = {} as Record<RateCardExtraKey, { el: string; en: string }>;
  for (const item of SERVICE_CATALOG) {
    if (item.kind !== "addon") continue;
    out[item.key] = item[field];
  }
  return out;
}

export const EXTRA_LABEL: Record<RateCardExtraKey, { el: string; en: string }> = addonCopy("title");

export const EXTRA_HINT: Record<RateCardExtraKey, { el: string; en: string }> = addonCopy("description");

/** Suffix after the formatted amount, e.g. "50 € / μήνα". */
export function packagePriceSuffix(type: PackageType, lang: "el" | "en"): string | null {
  if (type === "ugc_photo") return lang === "el" ? "/ φωτογραφία" : "/ photo";
  return null;
}

export function extraPriceSuffix(key: RateCardExtraKey, lang: "el" | "en"): string | null {
  void key;
  void lang;
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
  const catalogItem = catalogItemForPackage(platform, type);
  if (catalogItem?.group === "other") {
    const name = catalogItem.title[lang];
    return qty === 1 ? name : `${qty} ${name}`;
  }
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
  if (catalogItemForPackage(platform, type)?.group === "other") {
    return packageTitle(platform, type, qty, lang);
  }
  if (qty === 1) {
    const typeWord = TYPE_LABEL[type][lang].one;
    if (platform === "ugc" || isUgcPackageType(type)) return typeWord;
    return `${PLATFORM_LABEL[platform][lang]} ${typeWord}`;
  }
  return packageTitle(platform, type, qty, lang);
}

/** Enough for every catalog service on one creator. */
export const MAX_SERVICE_PACKAGES = 24;

/** Parse DB / form packages; drops invalid rows. */
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
    if (out.length >= MAX_SERVICE_PACKAGES) break;
  }
  return out;
}

/** Display-only packages from rate_card when service_packages is empty. Never persist. */
export function packagesFromRateCard(rateCard: unknown): ServicePackage[] {
  if (!rateCard || typeof rateCard !== "object" || Array.isArray(rateCard)) return [];
  const src = rateCard as Record<string, unknown>;
  const out: ServicePackage[] = [];
  for (const item of SERVICE_CATALOG) {
    if (item.kind !== "service" || !item.platform || !item.type) continue;
    if (!isConcretePrice(src[item.key])) continue;
    const raw = src[item.key];
    const price = typeof raw === "number" ? String(raw) : String(raw).trim();
    out.push({
      id: `rate_${item.key}`,
      platform: item.platform,
      type: item.type,
      quantity: 1,
      price,
      delivery_days: null,
      usage_rights: null,
      description: "",
    });
  }
  return out;
}

export function resolvePackagesForDisplay(
  servicePackages: unknown,
  rateCard: unknown
): ServicePackage[] {
  const fromDb = normalizeServicePackages(servicePackages).filter((p) => isConcretePrice(p.price));
  const fromCard = packagesFromRateCard(rateCard);
  if (!fromDb.length) return fromCard;
  const covered = new Set(fromDb.map((pkg) => `${pkg.platform}:${pkg.type}`));
  return [...fromDb, ...fromCard.filter((pkg) => !covered.has(`${pkg.platform}:${pkg.type}`))];
}

export type CreatorNetworks = {
  instagram: boolean;
  tiktok: boolean;
  youtube: boolean;
  facebook: boolean;
};

/** Platforms named on the creator's accounts. Display only — nothing is written back. */
export function creatorNetworksFromAccounts(accounts: unknown): CreatorNetworks {
  const out: CreatorNetworks = { instagram: false, tiktok: false, youtube: false, facebook: false };
  if (!Array.isArray(accounts)) return out;
  for (const item of accounts) {
    const platform = String(
      item && typeof item === "object" ? (item as { platform?: unknown }).platform ?? "" : ""
    )
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    if (platform === "instagram" || platform === "ig") out.instagram = true;
    else if (platform === "tiktok" || platform === "tt") out.tiktok = true;
    else if (platform === "youtube" || platform === "yt") out.youtube = true;
    else if (platform === "facebook" || platform === "fb") out.facebook = true;
  }
  return out;
}

function isUgcService(pkg: ServicePackage): boolean {
  return pkg.platform === "ugc" || isUgcPackageType(pkg.type);
}

/**
 * Show each priced service on a platform the creator actually has.
 * Instagram keeps Post/Reel/Story. TikTok-only creators get one «TikTok Video»
 * from the reel price, or the post price when reel is missing. YouTube and
 * Facebook stay hidden without that account. No recognized account: unchanged.
 */
export function alignPackagesToAccounts(packages: ServicePackage[], accounts: unknown): ServicePackage[] {
  const networks = creatorNetworksFromAccounts(accounts);
  if (!networks.instagram && !networks.tiktok && !networks.youtube && !networks.facebook) {
    return packages;
  }

  const out: ServicePackage[] = [];
  const seen = new Set<string>();
  const push = (pkg: ServicePackage) => {
    const key = `${pkg.id}:${pkg.platform}:${pkg.type}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(pkg);
  };

  for (const pkg of packages) {
    if (isUgcService(pkg) || pkg.platform === "other") push(pkg);
  }

  if (networks.instagram) {
    for (const pkg of packages) {
      if (!isUgcService(pkg) && pkg.platform === "instagram") push(pkg);
    }
  } else if (networks.tiktok) {
    const explicit = packages.filter((pkg) => pkg.platform === "tiktok");
    if (explicit.length) {
      explicit.forEach(push);
    } else {
      const reel = packages.find((pkg) => !isUgcService(pkg) && (pkg.type === "reel" || pkg.type === "short"));
      const post = packages.find(
        (pkg) => !isUgcService(pkg) && pkg.type === "post" && pkg.platform !== "facebook"
      );
      const source = reel || post;
      if (source) push({ ...source, platform: "tiktok", type: "video" });
    }
  }

  if (networks.tiktok) {
    for (const pkg of packages) {
      if (pkg.platform === "tiktok") push(pkg);
    }
  }
  if (networks.youtube) {
    for (const pkg of packages) {
      if (pkg.platform === "youtube") push(pkg);
    }
  }

  return out;
}

export function packagesForViewer(
  servicePackages: unknown,
  rateCard: unknown,
  accounts: unknown
): ServicePackage[] {
  return alignPackagesToAccounts(resolvePackagesForDisplay(servicePackages, rateCard), accounts).filter(
    (pkg) => pkg.platform !== "facebook"
  );
}

/** One-line card copy when the creator left the package description empty. */
export function packageBlurb(
  platform: PackagePlatform,
  type: PackageType,
  lang: "el" | "en" = "en"
): string {
  const item = catalogItemForPackage(platform, type);
  if (item) return item.description[lang];
  if (type === "post" && platform === "facebook") {
    return lang === "el" ? "Ανάρτηση στη σελίδα Facebook." : "A post on the Facebook page.";
  }
  return lang === "el" ? "Υπηρεσία για συνεργασία." : "A service for a collaboration.";
}

export function emptyCreatorServicePrices(): CreatorServicePrices {
  const prices = {} as CreatorServicePrices;
  for (const item of SERVICE_CATALOG) prices[item.key] = "";
  return prices;
}

function cardText(rateCard: unknown, key: string): string {
  if (!rateCard || typeof rateCard !== "object" || Array.isArray(rateCard)) return "";
  const value = (rateCard as Record<string, unknown>)[key];
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return value.trim();
  return "";
}

function packagePrice(packages: ServicePackage[], platform: PackagePlatform, type: PackageType): string {
  const found = packages.find((pkg) => pkg.platform === platform && pkg.type === type);
  return found ? String(found.price || "").trim() : "";
}

/** Prefill the price form. A TikTok-only creator's old reel/post fills TikTok Video. */
export function creatorServicePricesFromStored(
  servicePackages: unknown,
  rateCard: unknown,
  accounts: unknown
): CreatorServicePrices {
  const prices = emptyCreatorServicePrices();
  const networks = creatorNetworksFromAccounts(accounts);
  const packages = normalizeServicePackages(servicePackages);
  for (const item of SERVICE_CATALOG) {
    if (item.kind === "service" && item.platform && item.type) {
      prices[item.key] = packagePrice(packages, item.platform, item.type) || cardText(rateCard, item.key);
    } else {
      prices[item.key] = cardText(rateCard, item.key);
    }
  }
  if (!prices.tiktok && networks.tiktok && !networks.instagram) {
    prices.tiktok =
      cardText(rateCard, "reel") ||
      packagePrice(packages, "instagram", "reel") ||
      cardText(rateCard, "post") ||
      packagePrice(packages, "instagram", "post");
  }
  return prices;
}

/** Packages for the services the form is allowed to edit. Add-ons stay on the rate card. */
export function packagesFromCreatorPrices(
  prices: CreatorServicePrices,
  accounts: unknown
): ServicePackage[] {
  const out: ServicePackage[] = [];
  for (const item of SERVICE_CATALOG) {
    if (item.kind !== "service" || !item.platform || !item.type) continue;
    if (!catalogItemVisible(item, accounts)) continue;
    const text = String(prices[item.key] ?? "").trim();
    if (!text) continue;
    out.push({
      id: `price_${item.key}`,
      platform: item.platform,
      type: item.type,
      quantity: 1,
      price: text,
      delivery_days: null,
      usage_rights: "none",
      description: "",
    });
  }
  return out;
}

export function creatorPricesHaveInvalid(prices: CreatorServicePrices, accounts: unknown): boolean {
  return SERVICE_CATALOG.some((item) => {
    if (!catalogItemVisible(item, accounts)) return false;
    return !isPositivePriceInput(String(prices[item.key] ?? ""));
  });
}

export function extrasFromCreatorPrices(prices: CreatorServicePrices): ServiceExtras {
  const out: ServiceExtras = {};
  for (const key of RATE_CARD_EXTRA_KEYS) out[key] = String(prices[key] ?? "");
  return out;
}

/**
 * Keep prices the form is not editing (another platform, or legacy Facebook).
 * `managedKeys` are cleared when absent from `next`.
 */
export function rateCardKeepingUnmanaged(
  next: Record<string, string>,
  previous: unknown,
  managedKeys: readonly string[]
): Record<string, string> {
  const out = { ...next };
  if (!previous || typeof previous !== "object" || Array.isArray(previous)) return out;
  const managed = new Set(managedKeys);
  const src = previous as Record<string, unknown>;
  for (const key of [...RATE_CARD_PRICE_KEYS, ...RATE_CARD_EXTRA_KEYS, ...LEGACY_RATE_CARD_KEYS]) {
    if (managed.has(key) || out[key]) continue;
    const text = fixedIntegerText(src[key]);
    if (text) out[key] = text;
  }
  return out;
}

/** `tierFromPrice` supplied by caller (usually priceTierFromMinRate) to avoid import cycles. */
export function toPublicPackageView(
  pkg: ServicePackage,
  lang: "el" | "en" = "en",
  tierFromPrice: (price: unknown) => string = () => "0"
): PublicPackageView {
  const parsed = parseListedPrice(pkg.price);
  const view: PublicPackageView = {
    id: pkg.id,
    platform: pkg.platform,
    type: pkg.type,
    quantity: pkg.quantity,
    title: packageTitle(pkg.platform, pkg.type, pkg.quantity, lang),
    description: pkg.description || "",
    delivery_days: pkg.delivery_days ?? null,
    usage_rights: pkg.usage_rights ?? null,
    has_price: parsed != null,
    price_tier: tierFromPrice(parsed?.min ?? pkg.price),
    from_price: parsed?.min ?? null,
    price_max: parsed?.max ?? null,
  };
  if (parsed) {
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
    const text = fixedIntegerText(p.price);
    if (!text) continue;
    const n = Number(text);
    let key: string | null = null;
    if (p.platform === "facebook") key = "facebook";
    else {
      const item = catalogItemForPackage(p.platform, p.type);
      if (item && item.kind === "service") key = item.key;
      else if (p.type === "video") key = "reel";
      else if (p.type === "reel" || p.type === "short") key = "reel";
      else if (p.type === "story") key = "story";
      else if (p.type === "post") key = "post";
    }
    if (!key) continue;
    if (buckets[key] == null || n < buckets[key]!) buckets[key] = n;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(buckets)) out[k] = String(v);
  return out;
}

export function emptyExtras(): ServiceExtras {
  const out: ServiceExtras = {};
  for (const key of RATE_CARD_EXTRA_KEYS) out[key] = "";
  return out;
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

/** Priced extras only. Blank and anything other than one positive integer are dropped. */
export function extrasForSave(extras: ServiceExtras): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of RATE_CARD_EXTRA_KEYS) {
    const text = fixedIntegerText(extras[key]);
    if (text) out[key] = text;
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
  const parsed = parseListedPrice(price);
  return {
    key,
    has_price: parsed != null,
    price_tier: parsed ? tierFromPrice(parsed.min) : "0",
    from_price: parsed?.min ?? null,
    price_max: parsed?.max ?? null,
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

/** Priced extras with the exact amount and `from_price`. Omits keys without a price. */
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

/** Persist shape for jsonb. Only positive integers. Ranges are not saved. */
export function packagesForSave(packages: ServicePackage[]): ServicePackage[] {
  return normalizeServicePackages(packages)
    .filter((p) => fixedIntegerText(p.price) != null)
    .slice(0, MAX_SERVICE_PACKAGES)
    .map((p) => ({
      id: p.id,
      platform: p.platform,
      type: p.type,
      quantity: p.quantity,
      price: fixedIntegerText(p.price) || "",
      delivery_days: p.delivery_days ?? null,
      usage_rights: p.usage_rights ?? null,
      description: p.description || "",
    }));
}
