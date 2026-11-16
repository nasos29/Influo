import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { applyShowcaseAddPost } from "@/lib/applyShowcaseAddPost";
import { parseShowcaseAddPostToken } from "@/lib/showcaseAddPost";
import { socialPostUrlErrorMessage } from "@/lib/socialPostUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST: creator submits published post URL via signed token (no login). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const token = String(body.t || body.token || "").trim();
  const url = String(body.url || "").trim();
  const parsed = parseShowcaseAddPostToken(token);
  if (!parsed) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
  if (!url) {
    return NextResponse.json({ error: socialPostUrlErrorMessage("empty") }, { status: 400 });
  }

  const result = await applyShowcaseAddPost(supabaseService(), parsed, url);
  if (!result.ok) {
    if (result.reason === "invalid_url") {
      return NextResponse.json(
        { error: socialPostUrlErrorMessage(result.message === "empty" ? "empty" : "invalid") },
        { status: 400 }
      );
    }
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: result.message || "error" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, url: result.url });
}
