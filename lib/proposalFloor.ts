/**
 * Minimum budget for a collaboration proposal.
 * A selected package (plus checked extras) wins. With no package, the floor is
 * the creator's min_rate. Campaign invites stay unlimited. Counter-offers are
 * not covered here.
 */

import { formatEuro } from "@/lib/formatEuro";
import { listedPriceMin } from "@/lib/parsePrice";
import {
  EXTRA_LABEL,
  PACKAGE_PLATFORMS,
  PACKAGE_TYPES,
  RATE_CARD_EXTRA_KEYS,
  packageTitle,
  type PackagePlatform,
  type PackageType,
  type RateCardExtraKey,
} from "@/lib/servicePackages";

export function integerEuro(value: unknown): number | null {
  const amount = listedPriceMin(value);
  if (amount == null || !(amount > 0)) return null;
  const rounded = Math.round(amount);
  return rounded >= 1 ? rounded : null;
}

type PackageLike = {
  id?: unknown;
  platform?: unknown;
  type?: unknown;
  quantity?: unknown;
  price?: unknown;
  title?: unknown;
};

function isPlatform(value: unknown): value is PackagePlatform {
  return typeof value === "string" && (PACKAGE_PLATFORMS as readonly string[]).includes(value);
}

function isType(value: unknown): value is PackageType {
  return typeof value === "string" && (PACKAGE_TYPES as readonly string[]).includes(value);
}

function isExtraKey(value: unknown): value is RateCardExtraKey {
  return typeof value === "string" && (RATE_CARD_EXTRA_KEYS as readonly string[]).includes(value);
}

export function packageTitles(pkg: PackageLike): string[] {
  const titles: string[] = [];
  if (typeof pkg.title === "string" && pkg.title.trim()) titles.push(pkg.title.trim());
  if (isPlatform(pkg.platform) && isType(pkg.type)) {
    const quantity = typeof pkg.quantity === "number" && pkg.quantity > 0 ? pkg.quantity : 1;
    titles.push(packageTitle(pkg.platform, pkg.type, quantity, "el"));
    titles.push(packageTitle(pkg.platform, pkg.type, quantity, "en"));
  }
  return titles;
}

function asPackages(value: unknown): PackageLike[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PackageLike => !!item && typeof item === "object");
}

function rateCardRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export type StoredProposalExtra = { key: RateCardExtraKey; price: number };

export type CollaborationFloor =
  | { ok: true; floor: number; packagePrice: number; extraTotal: number; extras: StoredProposalExtra[] }
  | { ok: false; reason: "unknown_package" | "unknown_extra" };

/** «Καμπάνια: …» / «Campaign: …» invites are not priced from a package or min_rate. */
export function isCampaignInviteService(service: string): boolean {
  return /^(?:Καμπάνια|Campaign)\s*:/.test(service.trim());
}

/**
 * Titles a proposal might name. Negotiate sends "2 × 1 Instagram Reel";
 * the package title is the part after the quantity.
 */
function serviceLookupTitles(service: string): string[] {
  const trimmed = service.trim();
  if (!trimmed) return [];
  const titles = [trimmed];
  const negotiate = /^\d+\s*[×x]\s+(.+)$/i.exec(trimmed);
  const named = negotiate?.[1]?.trim();
  if (named) titles.push(named);
  return titles;
}

/**
 * UI floor once the package is already known.
 * Package price plus extras, or min_rate when no package is selected.
 */
export function collaborationMinimum(input: {
  hasPackage?: boolean;
  packagePrice?: unknown;
  extraTotal?: number;
  minRate?: unknown;
}): number {
  const extraRaw = input.extraTotal;
  const extras = typeof extraRaw === "number" && Number.isFinite(extraRaw) && extraRaw > 0
    ? Math.round(extraRaw)
    : 0;
  const listed = input.hasPackage ? integerEuro(input.packagePrice) ?? 0 : 0;
  if (listed > 0) return listed + extras;
  const unbound = integerEuro(input.minRate) ?? 0;
  if (unbound <= 0 && extras <= 0) return 0;
  return unbound + extras;
}

export function budgetFloorMessage(floor: number, lang: "el" | "en"): string {
  const amount = formatEuro(floor, lang);
  return lang === "el"
    ? `Το budget δεν μπορεί να είναι μικρότερο από ${amount}.`
    : `Budget cannot be lower than ${amount}.`;
}

/**
 * Floor for a new proposal. `null` when this request is not tied to a package,
 * a priced extra, or a creator minimum (campaign invites stay unlimited).
 */
export function collaborationFloor(input: {
  packages: unknown;
  rateCard: unknown;
  serviceType: string;
  packageId?: string | null;
  extraKeys?: unknown;
  minRate?: unknown;
}): CollaborationFloor | null {
  const packages = asPackages(input.packages);
  const card = rateCardRecord(input.rateCard);
  const keys = Array.isArray(input.extraKeys)
    ? [...new Set(input.extraKeys.filter(isExtraKey))]
    : [];
  const rawKeys = Array.isArray(input.extraKeys) ? input.extraKeys.filter((key) => typeof key === "string") : [];
  if (rawKeys.length !== keys.length) return { ok: false, reason: "unknown_extra" };

  const extras: StoredProposalExtra[] = [];
  let extraTotal = 0;
  for (const key of keys) {
    const price = integerEuro(card[key]);
    if (price == null) return { ok: false, reason: "unknown_extra" };
    extras.push({ key, price });
    extraTotal += price;
  }

  const wantedId = typeof input.packageId === "string" ? input.packageId.trim() : "";
  const service = input.serviceType.trim();
  let matched: PackageLike | null = null;
  if (wantedId) {
    matched = packages.find((pkg) => String(pkg.id ?? "") === wantedId) ?? null;
    if (!matched) return { ok: false, reason: "unknown_package" };
  } else if (service && !isCampaignInviteService(service)) {
    const wanted = serviceLookupTitles(service);
    matched = packages.find((pkg) => packageTitles(pkg).some((title) => wanted.includes(title))) ?? null;
  }

  const listed = matched ? integerEuro(matched.price) ?? 0 : 0;
  const packagePrice = listed > 0 ? listed : 0;
  const unbound = packagePrice > 0 || isCampaignInviteService(service) ? 0 : integerEuro(input.minRate) ?? 0;
  if (packagePrice <= 0 && keys.length === 0 && unbound <= 0) return null;
  return {
    ok: true,
    floor: (packagePrice > 0 ? packagePrice : unbound) + extraTotal,
    packagePrice,
    extraTotal,
    extras,
  };
}

export type SavedProposalExtra = { key: string; price: number };

/** Rows already stored on a proposal. Empty or invalid values show nothing. */
export function parseSavedProposalExtras(value: unknown): SavedProposalExtra[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  const out: SavedProposalExtra[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const key = (item as { key?: unknown }).key;
    const price = (item as { price?: unknown }).price;
    const amount = typeof price === "number" ? price : Number(price);
    if (typeof key !== "string" || !key.trim()) continue;
    if (!Number.isInteger(amount) || amount < 1) continue;
    out.push({ key: key.trim(), price: amount });
  }
  return out;
}

/** «Extras: Γρήγορη παράδοση (20 €)». Null when the proposal has no extras. */
export function formatProposalExtrasLine(value: unknown, lang: "el" | "en"): string | null {
  const rows = parseSavedProposalExtras(value);
  if (!rows.length) return null;
  const parts = rows.map((row) => {
    const label = isExtraKey(row.key) ? EXTRA_LABEL[row.key][lang] : row.key;
    return `${label} (${formatEuro(row.price, lang)})`;
  });
  return `Extras: ${parts.join(", ")}`;
}

/** Stored chat line uses catalog keys so the viewer’s language can swap the names. */
export function proposalExtrasChatLine(extras: SavedProposalExtra[]): string {
  const priced = extras.filter((row): row is StoredProposalExtra => isExtraKey(row.key));
  if (!priced.length) return "";
  return `\nExtras: ${priced.map((row) => `${row.key} (${formatEuro(row.price, "el")})`).join(", ")}`;
}
