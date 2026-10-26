import type { SupabaseClient } from "@supabase/supabase-js";

export type CleanupOrphanedAuthResult =
  | { ok: true; status: number; body: Record<string, unknown> }
  | { ok: false; status: number; body: Record<string, unknown> };

/** Delete auth user for email when no influencers row exists (signup recovery). */
export async function cleanupOrphanedAuthByEmail(
  supabaseAdmin: SupabaseClient,
  emailRaw: string
): Promise<CleanupOrphanedAuthResult> {
  const email = emailRaw.trim();
  if (!email) {
    return { ok: false, status: 400, body: { error: "Email is required" } };
  }

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

  const {
    data: { users },
    error: listError,
  } = await supabaseAdmin.auth.admin.listUsers();

  if (listError) {
    return {
      ok: false,
      status: 500,
      body: { error: "Failed to list users", details: listError.message },
    };
  }

  const authUser = users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());

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
