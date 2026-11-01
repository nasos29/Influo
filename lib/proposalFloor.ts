/**
 * Minimum budget for a collaboration proposal: selected package plus checked extras.
 * Counter-offers are not covered here.
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

/**
 * Floor for a new proposal. `null` when this request is not tied to a package
 * or a priced extra (campaign invites stay unlimited).
 */
export function collaborationFloor(input: {
  packages: unknown;
  rateCard: unknown;
  serviceType: string;
  packageId?: string | null;
  extraKeys?: unknown;
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
  } else if (service) {
    matched = packages.find((pkg) => packageTitles(pkg).includes(service)) ?? null;
  }

  const packagePrice = matched ? integerEuro(matched.price) ?? 0 : 0;
  if (!matched && keys.length === 0) return null;
  return { ok: true, floor: packagePrice + extraTotal, packagePrice, extraTotal, extras };
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
