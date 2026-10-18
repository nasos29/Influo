import { NextRequest, NextResponse } from "next/server";

function isAuthCookie(name: string): boolean {
  return name.startsWith("sb-") || /supabase/i.test(name);
}

/** Revoke the bearer session and expire any Supabase auth cookies. */
export async function POST(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (token && url && anon) {
    await fetch(`${url}/auth/v1/logout?scope=global`, {
      method: "POST",
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }

  const res = NextResponse.json({ ok: true });
  for (const cookie of req.cookies.getAll()) {
    if (!isAuthCookie(cookie.name)) continue;
    res.cookies.set(cookie.name, "", { path: "/", maxAge: 0, sameSite: "lax" });
  }
  return res;
}
