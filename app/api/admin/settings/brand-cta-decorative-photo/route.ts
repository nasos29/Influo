import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { isAdminUser, userFromBearer } from "@/lib/apiAuth";
import { getServerSupabaseUrl, publicSupabaseStorageObjectUrl } from "@/lib/supabaseServerUrl";

export const runtime = "nodejs";

const supabaseAdmin = createClient(getServerSupabaseUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ALLOWED = new Set(["image/webp", "image/jpeg", "image/png"]);
const MAX_BYTES = 1024 * 1024;

/** Admin decorative photo for homepage brand_cta showcase (campaign-covers bucket). */
export async function POST(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdminUser(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 400 });

  const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
  const rand = Math.random().toString(36).slice(2, 8);
  const objectPath = `site/homepage-brand-cta/${Date.now()}-${rand}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabaseAdmin.storage
    .from("campaign-covers")
    .upload(objectPath, buf, { cacheControl: "31536000", upsert: false, contentType: file.type });
  if (upErr) {
    console.error("[admin brand-cta photo upload]", upErr.message);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
  return NextResponse.json({ url: publicSupabaseStorageObjectUrl("campaign-covers", objectPath) });
}