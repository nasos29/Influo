import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import {
  BRAND_BROWSER_COLUMNS,
  BRAND_OWNER_COLUMNS,
  INFLUENCER_BROWSER_COLUMNS,
  INFLUENCER_OWNER_COLUMNS,
} from "@/lib/profileColumns";

const influencerColumns = [...INFLUENCER_BROWSER_COLUMNS, ...INFLUENCER_OWNER_COLUMNS].join(",");
const brandColumns = [...BRAND_BROWSER_COLUMNS, ...BRAND_OWNER_COLUMNS].join(",");
/** Pre-migration brands select (bio/website already exist; city/instagram may not). */
const brandColumnsLegacy = [
  ...BRAND_BROWSER_COLUMNS.filter((c) => c !== "city" && c !== "instagram"),
  ...BRAND_OWNER_COLUMNS,
].join(",");

function isMissingColumnError(message: string | undefined): boolean {
  return /column|schema cache|does not exist/i.test(message || "");
}

type BrandSelectResult = {
  data: Record<string, unknown> | null;
  error: { message: string } | null;
  schema: "full" | "legacy";
};

async function selectOwnBrand(
  admin: ReturnType<typeof supabaseService>,
  filter: {
    column: string;
    value: string;
  }
): Promise<BrandSelectResult> {
  const full = await admin.from("brands").select(brandColumns).eq(filter.column, filter.value).maybeSingle();
  if (!full.error) {
    return {
      data: (full.data as Record<string, unknown> | null) ?? null,
      error: null,
      schema: "full",
    };
  }
  if (!isMissingColumnError(full.error.message)) {
    return {
      data: null,
      error: { message: full.error.message },
      schema: "full",
    };
  }
  const legacy = await admin
    .from("brands")
    .select(brandColumnsLegacy)
    .eq(filter.column, filter.value)
    .maybeSingle();
  if (legacy.error) {
    return {
      data: null,
      error: { message: legacy.error.message },
      schema: "legacy",
    };
  }
  const row = (legacy.data as Record<string, unknown> | null) ?? null;
  if (row) {
    // Ensure legacy payloads never expose city/instagram keys for client save guards.
    delete row.city;
    delete row.instagram;
    row._profileSchema = "legacy";
  }
  return { data: row, error: null, schema: "legacy" };
}

async function findOwnInfluencer(user: User) {
  const admin = supabaseService();
  const byId = await admin.from("influencers").select(influencerColumns).eq("id", user.id).maybeSingle();
  if (byId.error) throw new Error(byId.error.message);
  if (byId.data) return byId.data;

  const byAuth = await admin
    .from("influencers")
    .select(influencerColumns)
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (byAuth.error) throw new Error(byAuth.error.message);
  if (byAuth.data) return byAuth.data;

  const email = user.email?.trim();
  if (!email) return null;
  const byEmail = await admin
    .from("influencers")
    .select(influencerColumns)
    .ilike("contact_email", email)
    .maybeSingle();
  if (byEmail.error) throw new Error(byEmail.error.message);
  return byEmail.data;
}

async function privateBrandEmail(brandId: string): Promise<string> {
  const priv = await supabaseService()
    .from("brand_private")
    .select("contact_email")
    .eq("brand_id", brandId)
    .maybeSingle();
  if (priv.error) throw new Error(priv.error.message);
  return typeof priv.data?.contact_email === "string" ? priv.data.contact_email.trim() : "";
}

type BrandRow = { id: string; contact_email?: string | null };

function asBrandRow(value: unknown): BrandRow | null {
  if (!value || typeof value !== "object" || !("id" in value)) return null;
  const id = (value as { id?: unknown }).id;
  if (typeof id !== "string" || !id) return null;
  return value as BrandRow;
}

function withOwnerEmail<T extends BrandRow>(row: T, email: string): T {
  if (typeof row.contact_email === "string" && row.contact_email.includes("@")) return row;
  if (!email.includes("@")) return row;
  return { ...row, contact_email: email };
}

function tagBrandSchema<T extends BrandRow>(
  row: T,
  schema: "full" | "legacy"
): T & { _profileSchema?: "full" | "legacy" } {
  if (schema === "legacy") {
    const tagged = { ...row, _profileSchema: "legacy" as const };
    delete (tagged as Record<string, unknown>).city;
    delete (tagged as Record<string, unknown>).instagram;
    return tagged;
  }
  return { ...row, _profileSchema: "full" };
}

async function findOwnBrand(user: User) {
  const admin = supabaseService();
  const byId = await selectOwnBrand(admin, { column: "id", value: user.id });
  if (byId.error) throw new Error(byId.error.message);
  const ownById = asBrandRow(byId.data);
  if (ownById) {
    return tagBrandSchema(withOwnerEmail(ownById, await privateBrandEmail(ownById.id)), byId.schema);
  }

  const email = user.email?.trim();
  if (!email) return null;

  const priv = await admin.from("brand_private").select("brand_id, contact_email").ilike("contact_email", email).maybeSingle();
  if (priv.error) throw new Error(priv.error.message);
  if (priv.data?.brand_id) {
    const row = await selectOwnBrand(admin, { column: "id", value: String(priv.data.brand_id) });
    if (row.error) throw new Error(row.error.message);
    const matched = asBrandRow(row.data);
    if (matched) {
      const privateEmail = typeof priv.data.contact_email === "string" ? priv.data.contact_email : "";
      return tagBrandSchema(withOwnerEmail(matched, privateEmail), row.schema);
    }
  }

  // contact_email may be denied/absent on brands; prefer brand_private path above.
  const byEmailFull = await admin.from("brands").select(brandColumns).ilike("contact_email", email).maybeSingle();
  if (byEmailFull.error && isMissingColumnError(byEmailFull.error.message)) {
    const byEmailLegacy = await admin
      .from("brands")
      .select(brandColumnsLegacy)
      .ilike("contact_email", email)
      .maybeSingle();
    if (byEmailLegacy.error) throw new Error(byEmailLegacy.error.message);
    const ownByEmail = asBrandRow(byEmailLegacy.data);
    if (!ownByEmail) return null;
    return tagBrandSchema(withOwnerEmail(ownByEmail, await privateBrandEmail(ownByEmail.id)), "legacy");
  }
  if (byEmailFull.error) throw new Error(byEmailFull.error.message);
  const ownByEmail = asBrandRow(byEmailFull.data);
  if (!ownByEmail) return null;
  return tagBrandSchema(withOwnerEmail(ownByEmail, await privateBrandEmail(ownByEmail.id)), "full");
}

/** The signed-in user's own rows. Lookup by auth id, then auth_user_id, then email. */
export async function GET(request: Request) {
  try {
    const user = await userFromBearer(request);
    if (!user) {
      return NextResponse.json({ error: "Δεν υπάρχει ενεργή σύνδεση." }, { status: 401 });
    }

    const [influencer, brand] = await Promise.all([findOwnInfluencer(user), findOwnBrand(user)]);
    return NextResponse.json(
      { influencer: influencer ?? null, brand: brand ?? null },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err: unknown) {
    console.error("[API /api/me/profile]", err);
    const message = err instanceof Error ? err.message : "Δεν ήταν δυνατή η ανάγνωση του προφίλ.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
