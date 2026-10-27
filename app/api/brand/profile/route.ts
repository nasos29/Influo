import { NextRequest, NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { findContactInfo } from "@/lib/contactFilter";
import { formatStoredCategories } from "@/lib/categories";
import {
  BRAND_BIO_MAX,
  BRAND_PROFILE_WHITELIST,
  applyClearableBrandFieldGuards,
  normalizeBrandBio,
  normalizeBrandCity,
  parseClearFields,
  parseHttpsUrl,
  resolveBrandIdForUser,
} from "@/lib/brandProfile";

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
 * Brand self-serve profile update — only fields present in the body are patched
 * (same pattern as /api/admin/brands/update).
 */
export async function POST(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const lang = langOf(body);
  const admin = supabaseService();
  const clearFields = parseClearFields(body.clearFields);

  const brandId = await resolveBrandIdForUser(admin, user);
  if (!brandId) {
    return NextResponse.json({ error: "Brand not found" }, { status: 403 });
  }

  const { data: existing, error: existingErr } = await admin
    .from("brands")
    .select("id, brand_name, contact_person, website, industry, logo_url, bio, instagram, city")
    .eq("id", brandId)
    .maybeSingle();

  if (existingErr) {
    console.error("[brand/profile] load failed:", existingErr);
    return NextResponse.json({ error: existingErr.message || "Failed to load brand" }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  const updateData: Record<string, string | null> = {};

  if (body.brand_name !== undefined) {
    const brandName = asString(body.brand_name).trim();
    if (!brandName) {
      return NextResponse.json(
        { error: lang === "el" ? "Το όνομα επιχείρησης είναι υποχρεωτικό." : "Company name is required." },
        { status: 400 }
      );
    }
    updateData.brand_name = brandName;
  }

  if (body.contact_person !== undefined) {
    updateData.contact_person = asString(body.contact_person).trim() || null;
  }

  if (body.industry !== undefined || body.category !== undefined) {
    const industryRaw = asString(body.industry || body.category).trim();
    const industry = formatStoredCategories(industryRaw) || null;
    if (!industry) {
      return NextResponse.json(
        { error: lang === "el" ? "Επιλέξτε τουλάχιστον μία κατηγορία." : "Select at least one category." },
        { status: 400 }
      );
    }
    updateData.industry = industry;
  }

  if (body.logo_url !== undefined) {
    updateData.logo_url =
      body.logo_url === null ? null : asString(body.logo_url).trim() || null;
  }

  let bio: string | null | undefined;
  let website: string | null | undefined;
  let instagram: string | null | undefined;
  let city: string | null | undefined;

  try {
    if (body.bio !== undefined) bio = normalizeBrandBio(asString(body.bio));
    if (body.website !== undefined) website = parseHttpsUrl(asString(body.website), "website");
    if (body.instagram !== undefined) instagram = parseHttpsUrl(asString(body.instagram), "instagram");
    if (body.city !== undefined) city = normalizeBrandCity(asString(body.city));
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
    if (code === "invalid_website") {
      return NextResponse.json(
        {
          error:
            lang === "el"
              ? "Η ιστοσελίδα πρέπει να είναι έγκυρο https URL."
              : "Website must be a valid https URL.",
        },
        { status: 400 }
      );
    }
    if (code === "invalid_instagram") {
      return NextResponse.json(
        {
          error:
            lang === "el"
              ? "Το Instagram πρέπει να είναι έγκυρο https URL του instagram.com."
              : "Instagram must be a valid https instagram.com URL.",
        },
        { status: 400 }
      );
    }
    if (code === "city_too_long") {
      return NextResponse.json(
        { error: lang === "el" ? "Η πόλη είναι πολύ μεγάλη." : "City is too long." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (bio !== undefined) {
    if (bio && findContactInfo(bio)) {
      return NextResponse.json({ error: CONTACT_BLOCKED[lang], code: "contact_info_not_allowed" }, { status: 400 });
    }
    updateData.bio = bio;
  }
  if (city !== undefined) {
    if (city && findContactInfo(city)) {
      return NextResponse.json({ error: CONTACT_BLOCKED[lang], code: "contact_info_not_allowed" }, { status: 400 });
    }
    updateData.city = city;
  }
  if (website !== undefined) updateData.website = website;
  if (instagram !== undefined) updateData.instagram = instagram;

  for (const key of Object.keys(updateData)) {
    if (!(BRAND_PROFILE_WHITELIST as readonly string[]).includes(key)) {
      delete updateData[key];
    }
  }

  applyClearableBrandFieldGuards(updateData, existing as Record<string, unknown>, clearFields);

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ success: true, brand: existing });
  }

  const { data, error } = await admin
    .from("brands")
    .update(updateData)
    .eq("id", brandId)
    .select(
      "id, brand_name, contact_person, website, industry, logo_url, bio, instagram, city, verified, contact_email, afm"
    )
    .maybeSingle();

  if (error) {
    console.error("[brand/profile] update failed:", error);
    const missingCol = /column|schema cache|does not exist/i.test(error.message || "");
    return NextResponse.json(
      {
        error: missingCol
          ? lang === "el"
            ? "Λείπουν στήλες προφίλ — εφαρμόστε το docs/ADD_BRAND_BIO_PROFILE.sql."
            : "Missing profile columns — apply docs/ADD_BRAND_BIO_PROFILE.sql."
          : error.message || "Failed to update profile",
      },
      { status: missingCol ? 503 : 500 }
    );
  }

  return NextResponse.json({ success: true, brand: data });
}
