import { NextRequest, NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { findContactInfo } from "@/lib/contactFilter";
import { formatStoredCategories } from "@/lib/categories";
import { BRAND_BIO_MAX, normalizeBrandBio } from "@/lib/brandProfile";

const CONTACT_BLOCKED = {
  el: "Για την ασφάλειά σας δεν επιτρέπονται links, email ή τηλέφωνα στο bio.",
  en: "For your safety, links, emails and phone numbers aren't allowed in the bio.",
} as const;

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function langOf(body: Record<string, unknown>): "el" | "en" {
  return asString(body.lang).toLowerCase() === "en" ? "en" : "el";
}

/**
 * Create the brands row for a newly signed-up auth user.
 * Validates bio with the same rules as /api/brand/profile.
 */
export async function POST(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const lang = langOf(body);
  const admin = supabaseService();

  const existing = await admin.from("brands").select("id").eq("id", user.id).maybeSingle();
  if (existing.data?.id) {
    return NextResponse.json(
      { error: lang === "el" ? "Ο λογαριασμός επιχείρησης υπάρχει ήδη." : "Brand account already exists." },
      { status: 409 }
    );
  }

  const brandName = asString(body.brand_name).trim();
  if (!brandName) {
    return NextResponse.json(
      { error: lang === "el" ? "Το όνομα επιχείρησης είναι υποχρεωτικό." : "Company name is required." },
      { status: 400 }
    );
  }

  const industry = formatStoredCategories(asString(body.industry || body.category).trim()) || null;
  if (!industry) {
    return NextResponse.json(
      { error: lang === "el" ? "Επιλέξτε τουλάχιστον μία κατηγορία." : "Select at least one category." },
      { status: 400 }
    );
  }

  let bio: string | null;
  try {
    bio = normalizeBrandBio(asString(body.bio));
  } catch (err) {
    const code = err instanceof Error ? err.message : "invalid";
    if (code === "bio_too_long") {
      return NextResponse.json(
        {
          error:
            lang === "el"
              ? `Το bio μπορεί να έχει έως ${BRAND_BIO_MAX} χαρακτήρες.`
              : `Bio can be at most ${BRAND_BIO_MAX} characters.`,
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Invalid bio" }, { status: 400 });
  }

  if (bio && findContactInfo(bio)) {
    return NextResponse.json({ error: CONTACT_BLOCKED[lang], code: "contact_info_not_allowed" }, { status: 400 });
  }

  // Always from Bearer token — never trust body.contact_email.
  const contactEmail = (user.email || "").toLowerCase().trim();
  if (!contactEmail) {
    return NextResponse.json(
      { error: lang === "el" ? "Το email είναι υποχρεωτικό." : "Email is required." },
      { status: 400 }
    );
  }

  const afmDigits = asString(body.afm).replace(/\D/g, "");
  if (afmDigits.length > 0 && afmDigits.length !== 9) {
    return NextResponse.json(
      { error: lang === "el" ? "Το ΑΦΜ πρέπει να έχει 9 ψηφία." : "Tax ID must have 9 digits." },
      { status: 400 }
    );
  }

  let website = asString(body.website).trim();
  if (website) {
    website = website.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
  }

  const contactPerson = asString(body.contact_person).trim() || null;
  const logoUrlRaw = body.logo_url;
  const logo_url =
    typeof logoUrlRaw === "string" && logoUrlRaw.trim() ? logoUrlRaw.trim() : null;

  const { data, error } = await admin
    .from("brands")
    .insert({
      id: user.id,
      brand_name: brandName,
      contact_email: contactEmail,
      contact_person: contactPerson,
      afm: afmDigits || null,
      website: website || null,
      industry,
      logo_url,
      bio,
    })
    .select("id, brand_name, bio")
    .maybeSingle();

  if (error) {
    console.error("[brand/register] insert failed:", error);
    const missingCol = /column|schema cache|does not exist/i.test(error.message || "");
    return NextResponse.json(
      {
        error: missingCol
          ? lang === "el"
            ? "Λείπουν στήλες προφίλ — εφαρμόστε το docs/ADD_BRAND_BIO_PROFILE.sql."
            : "Missing profile columns — apply docs/ADD_BRAND_BIO_PROFILE.sql."
          : error.message || "Failed to create brand",
      },
      { status: missingCol ? 503 : 500 }
    );
  }

  return NextResponse.json({ success: true, brand: data });
}
