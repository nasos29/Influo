/**
 * Signed unsubscribe / preferences tokens (no login required).
 * Links land on /notifications/preferences?token=… with optional one-click category off.
 */

import { createHmac, timingSafeEqual } from "crypto";
import type { NotifCategory, NotifSubjectKind } from "@/lib/notificationPreferences";
import { isNotifCategory } from "@/lib/notificationPreferences";
import { siteUrl } from "@/lib/proposalMail";

function unsubSecret(): string {
  return (
    process.env.NOTIF_PREFS_UNSUB_SECRET ||
    process.env.BRAND_REMINDERS_UNSUB_SECRET ||
    process.env.CRON_SECRET ||
    process.env.RESEND_API_KEY ||
    "influo-notif-prefs-dev"
  ).trim();
}

export type NotifUnsubPayload = {
  kind: NotifSubjectKind;
  subjectId: string;
  email: string;
  /** When set, one-click turns this category off. */
  category?: NotifCategory;
};

function signPayload(raw: string): string {
  return createHmac("sha256", unsubSecret()).update(raw).digest("hex").slice(0, 32);
}

/** Encode a signed token. */
export function createNotifPrefsToken(payload: NotifUnsubPayload): string {
  const kind = payload.kind === "brand" ? "brand" : "influencer";
  const email = String(payload.email || "")
    .trim()
    .toLowerCase();
  const subjectId = String(payload.subjectId || "").trim();
  const category = payload.category && isNotifCategory(payload.category) ? payload.category : "";
  const body = `${kind}:${subjectId}:${email}:${category}`;
  const sig = signPayload(body);
  return Buffer.from(`${body}:${sig}`, "utf8").toString("base64url");
}

export function parseNotifPrefsToken(token: string): NotifUnsubPayload | null {
  try {
    const raw = Buffer.from(String(token || ""), "base64url").toString("utf8");
    const parts = raw.split(":");
    if (parts.length < 4) return null;
    const sig = parts.pop() || "";
    const categoryRaw = parts.length >= 4 ? parts.pop() || "" : "";
    const email = (parts.pop() || "").trim().toLowerCase();
    const kindRaw = parts.shift() || "";
    const subjectId = parts.join(":").trim();
    if (kindRaw !== "brand" && kindRaw !== "influencer") return null;
    if (!subjectId || !email.includes("@")) return null;
    const category = categoryRaw && isNotifCategory(categoryRaw) ? categoryRaw : undefined;
    const body = `${kindRaw}:${subjectId}:${email}:${category || ""}`;
    const expected = signPayload(body);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    // Full-token re-encode compare (guards against partial field tricks).
    const rebuild = createNotifPrefsToken({
      kind: kindRaw,
      subjectId,
      email,
      category,
    });
    const ta = Buffer.from(String(token || ""));
    const tb = Buffer.from(rebuild);
    if (ta.length !== tb.length || !timingSafeEqual(ta, tb)) return null;
    return { kind: kindRaw, subjectId, email, category };
  } catch {
    return null;
  }
}

export function notificationPreferencesUrl(payload: NotifUnsubPayload): string {
  const token = createNotifPrefsToken(payload);
  const base = `${siteUrl()}/notifications/preferences?token=${encodeURIComponent(token)}`;
  return base;
}

/** One-click off for a category (still opens the preferences page which applies it). */
export function notificationUnsubscribeUrl(
  payload: NotifUnsubPayload & { category: NotifCategory }
): string {
  return notificationPreferencesUrl(payload);
}

/** Map legacy brand-reminder unsub links → reminders_email category. */
export function brandReminderPrefsUnsubUrl(brandId: string, email: string): string {
  return notificationUnsubscribeUrl({
    kind: "brand",
    subjectId: brandId,
    email,
    category: "reminders_email",
  });
}

export function announcementsPrefsUnsubUrl(
  kind: NotifSubjectKind,
  subjectId: string,
  email: string
): string {
  return notificationUnsubscribeUrl({
    kind,
    subjectId,
    email,
    category: "announcements_email",
  });
}

export function matchesPrefsUnsubUrl(
  kind: NotifSubjectKind,
  subjectId: string,
  email: string
): string {
  return notificationUnsubscribeUrl({
    kind,
    subjectId,
    email,
    category: "matches_email",
  });
}
