import { NextRequest, NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { findContactInfo } from "@/lib/contactFilter";
import { normalizeDeadlineForOpen } from "@/lib/campaignLifecycle";
import { normalizeCategoryToken } from "@/lib/categories";

const CONTACT_BLOCKED = {
  el: "Για την ασφάλειά σας δεν επιτρέπονται links, email ή τηλέφωνα. Η επικοινωνία γίνεται μέσα από το Influo.",
  en: "For your safety, links, emails and phone numbers aren't allowed. Communication happens inside Influo.",
} as const;

const OPEN_LOCKED = {
  el: "Η κατάσταση «Ανοιχτή» είναι διαθέσιμη μετά την επαλήθευση.",
  en: "Open status is available after verification.",
} as const;

const ALLOWED_STATUSES = new Set(["draft", "open", "closed"]);
const ALLOWED_COMPENSATION = new Set(["money", "product", "both"]);
const TEXT_FIELDS = ["title", "description", "deliverables", "location"] as const;

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function parseDeadlineIso(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T12:00:00`).toISOString();
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export async function POST(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const admin = supabaseService();

  const { data: brand } = await admin
    .from("brands")
    .select("id, verified")
    .eq("id", user.id)
    .maybeSingle();
  if (!brand || brand.id !== user.id) {
    return NextResponse.json({ error: "Brand not found" }, { status: 403 });
  }

  const campaignId = asString(body.id).trim() || null;
  const title = asString(body.title).trim();
  const description = asString(body.description).trim();
  const deliverablesRaw = asString(body.deliverables).trim();
  const locationRaw = asString(body.location).trim();
  const status = asString(body.status).trim();
  const startsOn = asString(body.starts_on).trim();
  const compensationType = asString(body.compensation_type).trim();
  const categoryRaw = asString(body.category).trim();
  const budgetNum = Math.max(0, parseFloat(asString(body.budget)) || 0);
  const minFollowersRaw = asString(body.min_followers).trim();
  const minFollowers = minFollowersRaw
    ? Math.max(0, parseInt(minFollowersRaw, 10) || 0)
    : null;
  const platforms = Array.isArray(body.platforms)
    ? body.platforms.filter((p): p is string => typeof p === "string" && !!p.trim()).map((p) => p.trim())
    : [];

  if (!title || !description) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // cover_url: undefined = leave untouched, null/"" = clear, https URL = set.
  let coverUrl: string | null | undefined;
  if (body.cover_url === null || body.cover_url === "") {
    coverUrl = null;
  } else if (typeof body.cover_url === "string") {
    const trimmed = body.cover_url.trim();
    let valid = false;
    try {
      valid = new URL(trimmed).protocol === "https:" && trimmed.length <= 1000;
    } catch {
      valid = false;
    }
    if (!valid) return NextResponse.json({ error: "Invalid cover_url" }, { status: 400 });
    coverUrl = trimmed;
  } else if (body.cover_url !== undefined) {
    return NextResponse.json({ error: "Invalid cover_url" }, { status: 400 });
  }
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (!ALLOWED_COMPENSATION.has(compensationType)) {
    return NextResponse.json({ error: "Invalid compensation_type" }, { status: 400 });
  }
  if (!categoryRaw) {
    return NextResponse.json({ error: "Category required" }, { status: 400 });
  }
  if (!platforms.length) {
    return NextResponse.json({ error: "Platforms required" }, { status: 400 });
  }
  if (!startsOn || !/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) {
    return NextResponse.json({ error: "Invalid starts_on" }, { status: 400 });
  }
  const needsMoney = compensationType === "money" || compensationType === "both";
  if (needsMoney && !(budgetNum > 0)) {
    return NextResponse.json({ error: "Budget required" }, { status: 400 });
  }

  const textValues: Record<(typeof TEXT_FIELDS)[number], string> = {
    title,
    description,
    deliverables: deliverablesRaw,
    location: locationRaw,
  };
  for (const field of TEXT_FIELDS) {
    const value = textValues[field];
    if (value && findContactInfo(value)) {
      return NextResponse.json(
        {
          error: "contact_info_not_allowed",
          field,
          message: CONTACT_BLOCKED,
        },
        { status: 400 }
      );
    }
  }

  if (status === "open" && !brand.verified) {
    return NextResponse.json(
      { error: "open_locked", message: OPEN_LOCKED },
      { status: 400 }
    );
  }

  let existing: {
    id: string;
    brand_id: string;
    status: string;
    deadline?: string | null;
    opened_at?: string | null;
    created_at?: string;
  } | null = null;

  if (campaignId) {
    const { data, error } = await admin
      .from("brand_campaigns")
      .select("id, brand_id, status, deadline, opened_at, created_at")
      .eq("id", campaignId)
      .maybeSingle();
    if (error || !data || data.brand_id !== user.id) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    existing = data;
  }

  const deadlineYmd = asString(body.deadline).trim();
  if (deadlineYmd && /^\d{4}-\d{2}-\d{2}$/.test(deadlineYmd) && deadlineYmd <= startsOn) {
    return NextResponse.json({ error: "deadline_after_start" }, { status: 400 });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  let deadlineIso = deadlineYmd ? parseDeadlineIso(deadlineYmd) : null;
  let deadlineCleared = false;
  if (status === "open") {
    const normalized = normalizeDeadlineForOpen(deadlineIso, now);
    deadlineIso = normalized.deadline;
    deadlineCleared = normalized.clearedPastDeadline;
  }

  const wasOpen = existing?.status === "open";
  const wasClosed = existing?.status === "closed";
  const category = normalizeCategoryToken(categoryRaw) || categoryRaw;

  const payload: Record<string, unknown> = {
    title,
    description,
    budget: budgetNum,
    category,
    deliverables: deliverablesRaw || null,
    status,
    deadline: deadlineIso,
    starts_on: startsOn,
    location: locationRaw || null,
    min_followers: minFollowers,
    platforms,
    compensation_type: compensationType,
    updated_at: nowIso,
  };

  if (coverUrl !== undefined) payload.cover_url = coverUrl;

  // Server-owned reopen / close stamps — never trust client opened_at / brand_id.
  if (status === "open" && !wasOpen) {
    payload.opened_at = nowIso;
    payload.close_reminder_sent_at = null;
    payload.closed_at = null;
    payload.auto_closed = false;
  }
  if (status === "closed" && !wasClosed) {
    payload.closed_at = nowIso;
  }

  const write = async (bodyPayload: Record<string, unknown>) => {
    if (existing) {
      return admin
        .from("brand_campaigns")
        .update(bodyPayload)
        .eq("id", existing.id)
        .eq("brand_id", user.id)
        .select("id")
        .single();
    }
    return admin
      .from("brand_campaigns")
      .insert({ brand_id: user.id, ...bodyPayload })
      .select("id")
      .single();
  };

  let result = await write(payload);
  // cover_url column may not be migrated yet: retry once without it, keeping all other fields.
  if (result.error && "cover_url" in payload && /cover_url/i.test(result.error.message)) {
    const { cover_url: _ignored, ...withoutCover } = payload;
    void _ignored;
    result = await write(withoutCover);
  }
  if (
    result.error &&
    /column|schema cache|compensation|platforms|starts_on|min_followers/i.test(result.error.message)
  ) {
    const fallback: Record<string, unknown> = {
      title: payload.title,
      description: payload.description,
      budget: payload.budget,
      category: payload.category,
      deliverables: payload.deliverables,
      deadline: payload.deadline,
      status: payload.status,
      updated_at: payload.updated_at,
    };
    if ("opened_at" in payload) fallback.opened_at = payload.opened_at;
    if ("close_reminder_sent_at" in payload) fallback.close_reminder_sent_at = payload.close_reminder_sent_at;
    if ("closed_at" in payload) fallback.closed_at = payload.closed_at;
    if ("auto_closed" in payload) fallback.auto_closed = payload.auto_closed;
    result = await write(fallback);
  }

  if (result.error) {
    const message = /only_verified|policy|row-level/i.test(result.error.message)
      ? OPEN_LOCKED
      : undefined;
    return NextResponse.json(
      {
        error: result.error.message,
        message: message || undefined,
      },
      { status: 400 }
    );
  }

  const id = result.data?.id || existing?.id;
  if (!id) {
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, deadlineCleared });
}
