import { supabaseService } from "@/lib/apiAuth";

/** QA brand accounts: their campaigns never push/email real creators. Override with TEST_BRAND_EMAILS (comma list). */
const TEST_BRAND_EMAILS = (process.env.TEST_BRAND_EMAILS || "thanosd1979@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function isTestBrand(brandId: string | null | undefined, contactEmail?: string | null): Promise<boolean> {
  if (contactEmail && TEST_BRAND_EMAILS.includes(contactEmail.trim().toLowerCase())) return true;
  if (!brandId) return false;
  try {
    const { data } = await supabaseService().auth.admin.getUserById(brandId);
    const email = (data?.user?.email || "").trim().toLowerCase();
    return !!email && TEST_BRAND_EMAILS.includes(email);
  } catch {
    return false;
  }
}
