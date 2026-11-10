import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { rejectUnlessAdmin, supabaseService } from "@/lib/apiAuth";
import { emailNextSteps } from "@/lib/emailNextSteps";

/** Admin-only: send one reviewed data-quality email to a creator. Never automatic. */
export async function POST(request: NextRequest) {
  const denied = await rejectUnlessAdmin(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => ({}))) as { influencerId?: string; subject?: string; text?: string };
  const subject = String(body.subject || "").trim().slice(0, 200);
  const text = String(body.text || "").trim().slice(0, 8000);
  if (!body.influencerId || !subject || !text) return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  const admin = supabaseService();
  const { data: inf } = await admin.from("influencers").select("contact_email").eq("id", body.influencerId).maybeSingle();
  const to = inf?.contact_email;
  if (!to) return NextResponse.json({ error: "no_email" }, { status: 400 });
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#0f172a">${esc(text).replace(/\n/g, "<br>")}${emailNextSteps("data_quality_creator")}</div>`;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const res = await resend.emails.send({ from: "Influo Support <support@influo.gr>", to: [to], subject, html, replyTo: "support@influo.gr" });
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "send_failed" }, { status: 502 });
  }
}
