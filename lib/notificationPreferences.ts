/**
 * User notification preferences (optional categories).
 * Essential transactional emails are always allowed (not stored / not toggleable).
 * Legacy columns announcements_email_opted_out / reminders_email_opted_out stay in sync.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type NotifSubjectKind = "brand" | "influencer";

/** Optional email / in-site categories the user can toggle. */
export type NotifCategory =
  | "matches_email"
  | "reminders_email"
  | "announcements_email"
  | "in_site";

export type NotificationPreferences = {
  matches_email: boolean;
  reminders_email: boolean;
  announcements_email: boolean;
  in_site: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  matches_email: true,
  reminders_email: true,
  announcements_email: true,
  in_site: true,
};

export const NOTIF_CATEGORIES: NotifCategory[] = [
  "matches_email",
  "reminders_email",
  "announcements_email",
  "in_site",
];

/** Essential transactional — always on, never stored as off. */
export const ESSENTIAL_NOTIF_KEYS = [
  "new_message",
  "new_proposal",
  "agreement_accepted",
  "agreement_locked",
  "deliverable_submitted",
  "deliverable_approved",
  "payment_safety",
] as const;

export type EssentialNotifKey = (typeof ESSENTIAL_NOTIF_KEYS)[number];

export function isNotifCategory(value: string): value is NotifCategory {
  return (NOTIF_CATEGORIES as string[]).includes(value);
}

export function normalizePreferences(
  partial?: Partial<NotificationPreferences> | null
): NotificationPreferences {
  return {
    matches_email: partial?.matches_email !== false,
    reminders_email: partial?.reminders_email !== false,
    announcements_email: partial?.announcements_email !== false,
    in_site: partial?.in_site !== false,
  };
}

/** Prefer prefs row; fall back to legacy opt-out columns (opted_out → false). */
export function preferencesFromLegacy(row: {
  announcements_email_opted_out?: boolean | null;
  reminders_email_opted_out?: boolean | null;
  matches_email?: boolean | null;
  reminders_email?: boolean | null;
  announcements_email?: boolean | null;
  in_site?: boolean | null;
}): NotificationPreferences {
  const hasPrefsRow =
    row.matches_email != null ||
    row.reminders_email != null ||
    row.announcements_email != null ||
    row.in_site != null;

  if (hasPrefsRow) {
    return normalizePreferences({
      matches_email: row.matches_email ?? true,
      reminders_email: row.reminders_email ?? true,
      announcements_email: row.announcements_email ?? true,
      in_site: row.in_site ?? true,
    });
  }

  return normalizePreferences({
    matches_email: true,
    reminders_email: row.reminders_email_opted_out !== true,
    announcements_email: row.announcements_email_opted_out !== true,
    in_site: true,
  });
}

export function isCategoryEnabled(
  prefs: NotificationPreferences | null | undefined,
  category: NotifCategory
): boolean {
  const p = normalizePreferences(prefs);
  return p[category] !== false;
}

export function allowMatchesEmail(prefs?: NotificationPreferences | null): boolean {
  return isCategoryEnabled(prefs, "matches_email");
}

export function allowRemindersEmail(prefs?: NotificationPreferences | null): boolean {
  return isCategoryEnabled(prefs, "reminders_email");
}

export function allowAnnouncementsEmail(
  prefs?: NotificationPreferences | null,
  opts?: { importantBypass?: boolean }
): boolean {
  if (opts?.importantBypass) return true;
  return isCategoryEnabled(prefs, "announcements_email");
}

/**
 * In-site platform announcements always show (bell/dashboard), regardless of toggles.
 * `in_site` only gates other non-announcement in-site alerts when those exist.
 */
export function allowInSiteAnnouncements(): boolean {
  return true;
}

export function allowInSiteOther(prefs?: NotificationPreferences | null): boolean {
  return isCategoryEnabled(prefs, "in_site");
}

type PrefsRow = NotificationPreferences & {
  subject_kind: NotifSubjectKind;
  subject_id: string;
};

function isMissingPrefsTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = `${error.code || ""} ${error.message || ""}`;
  return /notification_preferences|PGRST205|42P01|schema cache/i.test(msg);
}

export async function loadNotificationPreferences(
  admin: SupabaseClient,
  kind: NotifSubjectKind,
  subjectId: string
): Promise<NotificationPreferences> {
  const id = String(subjectId || "").trim();
  if (!id) return { ...DEFAULT_NOTIFICATION_PREFERENCES };

  const prefs = await admin
    .from("notification_preferences")
    .select("matches_email, reminders_email, announcements_email, in_site")
    .eq("subject_kind", kind)
    .eq("subject_id", id)
    .maybeSingle();

  if (!prefs.error && prefs.data) {
    return normalizePreferences(prefs.data as Partial<NotificationPreferences>);
  }

  if (prefs.error && !isMissingPrefsTable(prefs.error)) {
    console.warn("[notif prefs] load", kind, id, prefs.error.message);
  }

  if (kind === "brand") {
    const legacy = await admin
      .from("brands")
      .select("announcements_email_opted_out, reminders_email_opted_out")
      .eq("id", id)
      .maybeSingle();
    if (legacy.data) return preferencesFromLegacy(legacy.data);
  } else {
    const legacy = await admin
      .from("influencers")
      .select("announcements_email_opted_out")
      .eq("id", id)
      .maybeSingle();
    if (legacy.data) return preferencesFromLegacy(legacy.data);
  }

  return { ...DEFAULT_NOTIFICATION_PREFERENCES };
}

/** Batch load for senders (missing → defaults / legacy). */
export async function loadNotificationPreferencesMap(
  admin: SupabaseClient,
  kind: NotifSubjectKind,
  subjectIds: string[]
): Promise<Map<string, NotificationPreferences>> {
  const ids = [...new Set(subjectIds.map((x) => String(x || "").trim()).filter(Boolean))];
  const out = new Map<string, NotificationPreferences>();
  for (const id of ids) out.set(id, { ...DEFAULT_NOTIFICATION_PREFERENCES });
  if (ids.length === 0) return out;

  const prefs = await admin
    .from("notification_preferences")
    .select("subject_id, matches_email, reminders_email, announcements_email, in_site")
    .eq("subject_kind", kind)
    .in("subject_id", ids);

  if (!prefs.error && prefs.data) {
    for (const row of prefs.data as Array<PrefsRow & { subject_id: string }>) {
      out.set(String(row.subject_id), normalizePreferences(row));
    }
  }

  const missing = ids.filter((id) => {
    const p = out.get(id);
    // Still default — try legacy for anyone without an explicit prefs hit when table missing
    return !prefs.data?.some((r: { subject_id: string }) => String(r.subject_id) === id);
  });

  if (missing.length === 0 && !prefs.error) return out;

  if (kind === "brand") {
    const legacy = await admin
      .from("brands")
      .select("id, announcements_email_opted_out, reminders_email_opted_out")
      .in("id", missing.length ? missing : ids);
    for (const row of legacy.data || []) {
      const id = String(row.id);
      if (prefs.error || missing.includes(id)) {
        out.set(id, preferencesFromLegacy(row));
      }
    }
  } else {
    const legacy = await admin
      .from("influencers")
      .select("id, announcements_email_opted_out")
      .in("id", missing.length ? missing : ids);
    for (const row of legacy.data || []) {
      const id = String(row.id);
      if (prefs.error || missing.includes(id)) {
        out.set(id, preferencesFromLegacy(row));
      }
    }
  }

  return out;
}

export async function upsertNotificationPreferences(
  admin: SupabaseClient,
  kind: NotifSubjectKind,
  subjectId: string,
  patch: Partial<NotificationPreferences>
): Promise<{ ok: true; prefs: NotificationPreferences } | { ok: false; error: string }> {
  const id = String(subjectId || "").trim();
  if (!id) return { ok: false, error: "missing_subject" };

  const current = await loadNotificationPreferences(admin, kind, id);
  const next = normalizePreferences({ ...current, ...patch });

  const { error } = await admin.from("notification_preferences").upsert(
    {
      subject_kind: kind,
      subject_id: id,
      matches_email: next.matches_email,
      reminders_email: next.reminders_email,
      announcements_email: next.announcements_email,
      in_site: next.in_site,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "subject_kind,subject_id" }
  );

  if (error) {
    if (isMissingPrefsTable(error)) {
      // Fall back: only sync legacy columns until migration is applied.
      const synced = await syncLegacyOptOutColumns(admin, kind, id, next);
      if (!synced.ok) return synced;
      return { ok: true, prefs: next };
    }
    return { ok: false, error: error.message };
  }

  const synced = await syncLegacyOptOutColumns(admin, kind, id, next);
  if (!synced.ok) {
    console.warn("[notif prefs] legacy sync", synced.error);
  }

  return { ok: true, prefs: next };
}

/** Keep legacy opt-out columns aligned so Zoho sync / old senders keep working. */
export async function syncLegacyOptOutColumns(
  admin: SupabaseClient,
  kind: NotifSubjectKind,
  subjectId: string,
  prefs: NotificationPreferences
): Promise<{ ok: true } | { ok: false; error: string }> {
  const announcements_email_opted_out = prefs.announcements_email === false;
  const reminders_email_opted_out = prefs.reminders_email === false;

  if (kind === "brand") {
    const { error } = await admin
      .from("brands")
      .update({
        announcements_email_opted_out,
        reminders_email_opted_out,
      })
      .eq("id", subjectId);
    if (error && !/reminders_email_opted_out|announcements_email_opted_out|PGRST204|42703/i.test(error.message || "")) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  const { error } = await admin
    .from("influencers")
    .update({ announcements_email_opted_out })
    .eq("id", subjectId);
  if (error && !/announcements_email_opted_out|PGRST204|42703/i.test(error.message || "")) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Quick check helpers used by senders that already loaded legacy flags. */
export function brandAllowsRemindersEmail(row: {
  reminders_email?: boolean | null;
  reminders_email_opted_out?: boolean | null;
  announcements_email?: boolean | null;
  announcements_email_opted_out?: boolean | null;
}): boolean {
  const prefs = preferencesFromLegacy(row);
  return allowRemindersEmail(prefs);
}

export function allowsAnnouncementsEmailFromRow(
  row: {
    announcements_email?: boolean | null;
    announcements_email_opted_out?: boolean | null;
  },
  opts?: { importantBypass?: boolean }
): boolean {
  if (opts?.importantBypass) return true;
  return allowAnnouncementsEmail(preferencesFromLegacy(row));
}

export function allowsMatchesEmailFromRow(row: {
  matches_email?: boolean | null;
  announcements_email_opted_out?: boolean | null;
}): boolean {
  // Historical: strong-match used announcements_email_opted_out as a hard skip.
  // New prefs: matches_email; if only legacy present, treat announcement opt-out as matches off too.
  if (row.matches_email != null) return row.matches_email !== false;
  if (row.announcements_email_opted_out === true) return false;
  return true;
}
