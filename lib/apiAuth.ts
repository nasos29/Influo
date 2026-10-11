import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export function supabaseService(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function userFromBearer(request: Request): Promise<User | null> {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  const { data, error } = await supabaseService().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function isAdminUser(user: User): Promise<boolean> {
  const email = (user.email || "").toLowerCase().trim();
  const adminEmail = (process.env.ADMIN_EMAIL || "nd.6@hotmail.com").toLowerCase().trim();
  if (email && email === adminEmail) return true;
  const { data } = await supabaseService()
    .from("user_roles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return data?.role === "admin";
}

/** Admin session (ADMIN_EMAIL or user_roles.role = admin). Null when missing or not admin. */
export async function requireAdmin(request: Request): Promise<User | null> {
  const user = await userFromBearer(request);
  if (!user) return null;
  if (!(await isAdminUser(user))) return null;
  return user;
}

/** Same brand check the public profile uses before showing prices. */
export async function isBrandUser(user: User): Promise<boolean> {
  const admin = supabaseService();
  const byId = await admin.from("brands").select("id").eq("id", user.id).maybeSingle();
  if (byId.data?.id) return true;
  const email = (user.email || "").trim();
  if (!email) return false;
  const byEmail = await admin.from("brands").select("id").ilike("contact_email", email).maybeSingle();
  return !!byEmail.data?.id;
}
