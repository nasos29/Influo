/**
 * Authenticated GET/PATCH for the current brand or influencer notification preferences.
 * ?party=brand|influencer (required when the user could be both; otherwise auto).
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveBrandIdForUser } from "@/lib/brandProfile";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import {
  isNotifCategory,
  loadNotificationPreferences,
  upsertNotificationPreferences,
  type NotifCategory,
  type NotifSubjectKind,
  type NotificationPreferences,
} from "@/lib/notificationPreferences";

export const runtime = "nodejs";

async function resolveSubject(
  request: NextRequest,
  user: { id: string; email?: string | null }
): Promise<{ kind: NotifSubjectKind; subjectId: string } | { error: string; status: number }> {
  const admin = supabaseService();
  const party = (request.nextUrl.searchParams.get("party") || "").trim().toLowerCase();

  if (party === "brand") {
    const brandId = await resolveBrandIdForUser(admin, user as never);
    if (!brandId) return { error: "Brand not found", status: 404 };
    return { kind: "brand", subjectId: brandId };
  }

  if (party === "influencer" || party === "creator") {
    const { data } = await admin
      .from("influencers")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!data?.id) return { error: "Influencer not found", status: 404 };
    return { kind: "influencer", subjectId: String(data.id) };
  }

  // Auto: prefer explicit hint from path referrer is not reliable — try brand first then influencer.
  const brandId = await resolveBrandIdForUser(admin, user as never);
  if (brandId) return { kind: "brand", subjectId: brandId };

  const { data } = await admin
    .from("influencers")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (data?.id) return { kind: "influencer", subjectId: String(data.id) };

  return { error: "Profile not found", status: 404 };
}

function parsePatch(body: unknown): Partial<NotificationPreferences> | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const patch: Partial<NotificationPreferences> = {};
  for (const key of Object.keys(raw)) {
    if (!isNotifCategory(key)) continue;
    const v = raw[key];
    if (typeof v !== "boolean") continue;
    patch[key as NotifCategory] = v;
  }
  return Object.keys(patch).length ? patch : null;
}

export async function GET(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subject = await resolveSubject(request, user);
  if ("error" in subject) {
    return NextResponse.json({ error: subject.error }, { status: subject.status });
  }

  const prefs = await loadNotificationPreferences(supabaseService(), subject.kind, subject.subjectId);
  return NextResponse.json({ data: prefs, party: subject.kind, subjectId: subject.subjectId });
}

export async function PATCH(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subject = await resolveSubject(request, user);
  if ("error" in subject) {
    return NextResponse.json({ error: subject.error }, { status: subject.status });
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

  const result = await upsertNotificationPreferences(
    supabaseService(),
    subject.kind,
    subject.subjectId,
    patch
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ data: result.prefs, party: subject.kind, subjectId: subject.subjectId });
}
