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

async function findOwnBrand(user: User) {
  const admin = supabaseService();
  const byId = await admin.from("brands").select(brandColumns).eq("id", user.id).maybeSingle();
  if (byId.error) throw new Error(byId.error.message);
  const ownById = asBrandRow(byId.data);
  if (ownById) return withOwnerEmail(ownById, await privateBrandEmail(ownById.id));

  const email = user.email?.trim();
  if (!email) return null;

  const priv = await admin.from("brand_private").select("brand_id, contact_email").ilike("contact_email", email).maybeSingle();
  if (priv.error) throw new Error(priv.error.message);
  if (priv.data?.brand_id) {
    const row = await admin.from("brands").select(brandColumns).eq("id", priv.data.brand_id).maybeSingle();
    if (row.error) throw new Error(row.error.message);
    const matched = asBrandRow(row.data);
    if (matched) {
      const privateEmail = typeof priv.data.contact_email === "string" ? priv.data.contact_email : "";
      return withOwnerEmail(matched, privateEmail);
    }
  }

  const byEmail = await admin.from("brands").select(brandColumns).ilike("contact_email", email).maybeSingle();
  if (byEmail.error) throw new Error(byEmail.error.message);
  const ownByEmail = asBrandRow(byEmail.data);
  if (!ownByEmail) return null;
  return withOwnerEmail(ownByEmail, await privateBrandEmail(ownByEmail.id));
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
