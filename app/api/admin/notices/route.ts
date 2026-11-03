import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin, supabaseService } from "@/lib/apiAuth";

/** Admin only: latest notices + unread count. */
export async function GET(req: NextRequest) {
  const denied = await rejectUnlessAdmin(req);
  if (denied) return denied;
  const admin = supabaseService();
  const [{ data, error }, { count }] = await Promise.all([
    admin.from("admin_notices").select("id, kind, title, body, url, created_at, read_at").order("created_at", { ascending: false }).limit(50),
    admin.from("admin_notices").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  if (error) return NextResponse.json({ notices: [], unread: 0, error: error.code }, { status: 200 });
  return NextResponse.json({ notices: data || [], unread: count || 0 });
}

/** Admin only: mark one (`id`) or all (`all: true`) as read. */
export async function POST(req: NextRequest) {
  const denied = await rejectUnlessAdmin(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { id?: string; all?: boolean };
  let q = supabaseService().from("admin_notices").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (!body.all) {
    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    q = q.eq("id", body.id);
  }
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
