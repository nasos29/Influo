import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { isAdminUser, userFromBearer } from "@/lib/apiAuth";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ALLOWED = new Set(["image/webp", "image/jpeg", "image/png"]);
const MAX_BYTES = 512 * 1024;

/** Admin-only cover upload into campaign-covers/<brand_id>/… (service role bypasses the owner-folder policy). */
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
  const campaignId = String(form.get("campaignId") || "");
  const file = form.get("file");
  if (!campaignId || !(file instanceof Blob)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 400 });

  const { data: campaign, error: campErr } = await supabaseAdmin
    .from("brand_campaigns")
    .select("id, brand_id")
    .eq("id", campaignId)
    .maybeSingle();
  if (campErr || !campaign?.brand_id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${campaign.brand_id}/${Date.now()}-${rand}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabaseAdmin.storage
    .from("campaign-covers")
    .upload(path, buf, { cacheControl: "31536000", upsert: false, contentType: file.type });
  if (upErr) {
    console.error("[admin cover upload]", upErr.message);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
  const { data: pub } = supabaseAdmin.storage.from("campaign-covers").getPublicUrl(path);
  return NextResponse.json({ url: pub.publicUrl });
}
