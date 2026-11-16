/**
 * Token-authenticated notification preferences (unsubscribe links, no login).
 * GET ?token=… → current prefs (+ applies one-click off when token carries a category)
 * PATCH ?token=… body partial prefs
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  isNotifCategory,
  loadNotificationPreferences,
  upsertNotificationPreferences,
  type NotifCategory,
  type NotificationPreferences,
} from "@/lib/notificationPreferences";
import { parseNotifPrefsToken } from "@/lib/notificationUnsubToken";

export const runtime = "nodejs";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function assertEmailMatches(
  kind: "brand" | "influencer",
  subjectId: string,
  email: string
): Promise<boolean> {
  const db = admin();
  const want = email.trim().toLowerCase();
  if (kind === "brand") {
    const { data } = await db.from("brands").select("contact_email").eq("id", subjectId).maybeSingle();
    const got = String(data?.contact_email || "")
      .trim()
      .toLowerCase();
    if (got && got === want) return true;
    const priv = await db
      .from("brand_private")
      .select("contact_email")
      .eq("brand_id", subjectId)
      .maybeSingle();
    return (
      String(priv.data?.contact_email || "")
        .trim()
        .toLowerCase() === want
    );
  }
  const { data } = await db
    .from("influencers")
    .select("contact_email")
    .eq("id", subjectId)
    .maybeSingle();
  const got = String(data?.contact_email || "")
    .trim()
    .toLowerCase();
  if (got && got === want) return true;
  const priv = await db
    .from("influencer_private")
    .select("contact_email")
    .eq("influencer_id", subjectId)
    .maybeSingle();
  return (
    String(priv.data?.contact_email || "")
      .trim()
      .toLowerCase() === want
  );
}

function parsePatch(body: unknown): Partial<NotificationPreferences> | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const patch: Partial<NotificationPreferences> = {};
  for (const key of Object.keys(raw)) {
    if (!isNotifCategory(key)) continue;
    if (typeof raw[key] !== "boolean") continue;
    patch[key as NotifCategory] = raw[key] as boolean;
  }
  return Object.keys(patch).length ? patch : null;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const parsed = parseNotifPrefsToken(token);
  if (!parsed) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  const ok = await assertEmailMatches(parsed.kind, parsed.subjectId, parsed.email);
  if (!ok) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  let prefs = await loadNotificationPreferences(admin(), parsed.kind, parsed.subjectId);
  let applied: NotifCategory | null = null;

  if (parsed.category && prefs[parsed.category] !== false) {
    const result = await upsertNotificationPreferences(admin(), parsed.kind, parsed.subjectId, {
      [parsed.category]: false,
    });
    if (result.ok) {
      prefs = result.prefs;
      applied = parsed.category;
    }
  }

  return NextResponse.json({
    data: prefs,
    party: parsed.kind,
    subjectId: parsed.subjectId,
    applied,
  });
}

export async function PATCH(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const parsed = parseNotifPrefsToken(token);
  if (!parsed) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  const ok = await assertEmailMatches(parsed.kind, parsed.subjectId, parsed.email);
  if (!ok) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const patch = parsePatch(body);
  if (!patch) {
    return NextResponse.json({ error: "No valid preference fields" }, { status: 400 });
  }

  const result = await upsertNotificationPreferences(admin(), parsed.kind, parsed.subjectId, patch);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ data: result.prefs, party: parsed.kind, subjectId: parsed.subjectId });
}
