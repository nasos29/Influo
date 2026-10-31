import { NextResponse } from "next/server";
import { isAdminUser, supabaseService, userFromBearer } from "@/lib/apiAuth";
import {
  deriveMinRate,
  FIXED_PRICE_MESSAGE,
  hasUnfixedCreatorPrice,
  packagesForSave,
  RATE_CARD_EXTRA_KEYS,
  RATE_CARD_PRICE_KEYS,
  type ServicePackage,
} from "@/lib/servicePackages";

function integerText(value: unknown): string | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) return String(value);
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!/^[1-9]\d*$/.test(text)) return null;
  return text;
}

function normalizeRateCard(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const src = raw as Record<string, unknown>;
  for (const key of [...RATE_CARD_PRICE_KEYS, ...RATE_CARD_EXTRA_KEYS]) {
    const text = integerText(src[key]);
    if (text) out[key] = text;
  }
  return out;
}

/**
 * Saves a creator's packages, rate card, and derived min_rate.
 * Rejects ranges and anything that is not one positive integer.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const influencerId = String(body?.influencerId ?? "").trim();
    if (!influencerId) {
      return NextResponse.json({ error: "influencerId required" }, { status: 400 });
    }

    const servicePackages = body?.service_packages;
    const rateCard = body?.rate_card;
    if (hasUnfixedCreatorPrice(servicePackages, rateCard)) {
      return NextResponse.json(
        { error: FIXED_PRICE_MESSAGE.el, message: FIXED_PRICE_MESSAGE },
        { status: 400 }
      );
    }

    const user = await userFromBearer(request);
    const admin = supabaseService();
    const { data: row, error: fetchErr } = await admin
      .from("influencers")
      .select("id, auth_user_id")
      .eq("id", influencerId)
      .maybeSingle();

    if (fetchErr || !row) {
      return NextResponse.json({ error: fetchErr?.message || "Not found" }, { status: 404 });
    }

    const ownerId = String(row.auth_user_id || row.id || "");
    const isOwner = !!user && (user.id === influencerId || user.id === ownerId);
    const isAdmin = !!user && (await isAdminUser(user));
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const packages = packagesForSave(
      Array.isArray(servicePackages) ? (servicePackages as ServicePackage[]) : []
    );
    if (packages.length < 1) {
      return NextResponse.json(
        { error: FIXED_PRICE_MESSAGE.el, message: FIXED_PRICE_MESSAGE },
        { status: 400 }
      );
    }
    const card = normalizeRateCard(rateCard);
    const derived = deriveMinRate(packages, card);

    const { error: updateErr } = await admin
      .from("influencers")
      .update({
        service_packages: packages,
        rate_card: card,
        ...(derived != null ? { min_rate: derived } : {}),
      })
      .eq("id", influencerId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      min_rate: derived,
      service_packages: packages,
      rate_card: card,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[influencer/prices]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
