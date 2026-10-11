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

async function findOwnBrand(user: User) {
  const admin = supabaseService();
  const byId = await admin.from("brands").select(brandColumns).eq("id", user.id).maybeSingle();
  if (byId.error) throw new Error(byId.error.message);
  if (byId.data) return byId.data;

  const email = user.email?.trim();
  if (!email) return null;
  const byEmail = await admin.from("brands").select(brandColumns).ilike("contact_email", email).maybeSingle();
  if (byEmail.error) throw new Error(byEmail.error.message);
  return byEmail.data;
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
