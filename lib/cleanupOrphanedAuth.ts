import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/apiAuth";

export type CleanupOrphanedAuthMode = "public" | "admin";

export type CleanupOrphanedAuthResult =
  | { ok: true; status: number; body: Record<string, unknown> }
  | { ok: false; status: number; body: Record<string, unknown> };

const ONE_HOUR_MS = 60 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const LIST_PAGE_SIZE = 200;

/** Find auth user by email via paginated admin.listUsers (not just the first page). */
async function findAuthUserByEmail(
  supabaseAdmin: SupabaseClient,
  emailLower: string
): Promise<{ user: User | null; error: string | null }> {
  let page = 1;
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: LIST_PAGE_SIZE,
    });
    if (error) {
      return { user: null, error: error.message };
    }
    const users = data?.users || [];
    const match = users.find((u) => (u.email || "").toLowerCase().trim() === emailLower);
    if (match) return { user: match, error: null };

    const nextPage = data?.nextPage ?? null;
    if (nextPage == null || users.length === 0) {
      return { user: null, error: null };
    }
    page = typeof nextPage === "number" ? nextPage : page + 1;
    if (page > 500) {
      return { user: null, error: "Auth user search exceeded page limit" };
    }
  }
}

async function publicNotOrphaned(
  supabaseAdmin: SupabaseClient,
  authUser: User,
  emailLower: string
): Promise<boolean> {
  const { data: brandById } = await supabaseAdmin
    .from("brands")
    .select("id")
    .eq("id", authUser.id)
    .maybeSingle();
  if (brandById?.id) return true;

  const { data: brandByEmail } = await supabaseAdmin
    .from("brands")
    .select("id")
    .ilike("contact_email", emailLower)
    .maybeSingle();
  if (brandByEmail?.id) return true;

  const { data: brandPrivate } = await supabaseAdmin
    .from("brand_private")
    .select("brand_id")
    .ilike("contact_email", emailLower)
    .maybeSingle();
  if (brandPrivate?.brand_id) return true;

  const { data: infById } = await supabaseAdmin
    .from("influencers")
    .select("id")
    .eq("id", authUser.id)
    .maybeSingle();
  if (infById?.id != null) return true;

  const { data: infByAuth } = await supabaseAdmin
    .from("influencers")
    .select("id")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();
  if (infByAuth?.id != null) return true;

  const { data: infByEmail } = await supabaseAdmin
    .from("influencers")
    .select("id")
    .ilike("contact_email", emailLower)
    .maybeSingle();
  if (infByEmail?.id != null) return true;

  if (await isAdminUser(authUser)) return true;

  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("id", authUser.id)
    .maybeSingle();
  if (roleRow?.role && String(roleRow.role).toLowerCase() !== "influencer") {
    return true;
  }

  const createdAt = authUser.created_at ? new Date(authUser.created_at).getTime() : NaN;
  if (!Number.isNaN(createdAt) && Date.now() - createdAt > ONE_HOUR_MS) {
    return true;
  }

  const lastSignIn = authUser.last_sign_in_at ? new Date(authUser.last_sign_in_at).getTime() : null;
  if (
    lastSignIn != null &&
    !Number.isNaN(lastSignIn) &&
    !Number.isNaN(createdAt) &&
    lastSignIn - createdAt > FIVE_MINUTES_MS
  ) {
    return true;
  }

  return false;
}

/**
 * Delete auth user for email when it is a failed-signup orphan.
 * - mode "admin": previous behavior (block only if influencers.contact_email matches).
 * - mode "public": strict guards — only recent failed signups without brand/influencer/admin use.
 */
export async function cleanupOrphanedAuthByEmail(
  supabaseAdmin: SupabaseClient,
  emailRaw: string,
  mode: CleanupOrphanedAuthMode
): Promise<CleanupOrphanedAuthResult> {
  const email = emailRaw.trim();
  const emailLower = email.toLowerCase();
  if (!email) {
    return { ok: false, status: 400, body: { error: "Email is required" } };
  }

  if (mode === "admin") {
    const { data: influencerData } = await supabaseAdmin
      .from("influencers")
      .select("id, contact_email")
      .eq("contact_email", email)
      .maybeSingle();

    if (influencerData) {
      return {
        ok: false,
        status: 400,
        body: { error: "Email exists in influencers table. Cannot delete.", exists: true },
      };
    }
  }

  const { user: authUser, error: findError } = await findAuthUserByEmail(supabaseAdmin, emailLower);
  if (findError) {
    return {
      ok: false,
      status: 500,
      body: { error: "Failed to list users", details: findError },
    };
  }

  if (!authUser) {
    return {
      ok: true,
      status: 200,
      body: {
        success: true,
        message: "No orphaned auth user found. Email is clean.",
        deleted: false,
      },
    };
  }

  if (mode === "public") {
    if (await publicNotOrphaned(supabaseAdmin, authUser, emailLower)) {
      return { ok: false, status: 400, body: { error: "not_orphaned" } };
    }
  }

  const { error: rolesDeleteError } = await supabaseAdmin.from("user_roles").delete().eq("id", authUser.id);
  if (rolesDeleteError) {
    console.error("Error deleting from user_roles:", rolesDeleteError);
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
  if (deleteError) {
    return {
      ok: false,
      status: 500,
      body: { error: "Failed to delete auth user", details: deleteError.message },
    };
  }

  return {
    ok: true,
    status: 200,
    body: {
      success: true,
      message: "Orphaned auth user deleted successfully",
      deleted: true,
      userId: authUser.id,
    },
  };
}
