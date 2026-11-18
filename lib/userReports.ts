import type { SupabaseClient } from "@supabase/supabase-js";

export const USER_REPORT_REASON_KEYS = [
  "fake_profile",
  "fake_stats",
  "inappropriate",
  "spam_fraud",
  "harassment",
  "broke_agreement",
  "other",
] as const;

export type UserReportReason = (typeof USER_REPORT_REASON_KEYS)[number];

export const USER_REPORT_STATUSES = ["new", "in_review", "closed"] as const;
export type UserReportStatus = (typeof USER_REPORT_STATUSES)[number];

export const USER_REPORT_CONTEXTS = ["profile", "chat"] as const;
export type UserReportContext = (typeof USER_REPORT_CONTEXTS)[number];

export const USER_REPORT_TARGET_TYPES = ["creator", "brand"] as const;
export type UserReportTargetType = (typeof USER_REPORT_TARGET_TYPES)[number];

export const USER_REPORT_REPORTER_ROLES = ["creator", "brand", "admin"] as const;
export type UserReportReporterRole = (typeof USER_REPORT_REPORTER_ROLES)[number];

export const USER_REPORT_COMMENT_MAX = 2000;

const REASON_LABELS: Record<UserReportReason, { el: string; en: string }> = {
  fake_profile: {
    el: "Ψεύτικο προφίλ / πλαστοπροσωπία",
    en: "Fake profile / impersonation",
  },
  fake_stats: {
    el: "Ψεύτικοι followers ή στατιστικά",
    en: "Fake followers or stats",
  },
  inappropriate: {
    el: "Ανάρμοστο ή προσβλητικό περιεχόμενο",
    en: "Inappropriate or offensive content",
  },
  spam_fraud: {
    el: "Spam ή απάτη",
    en: "Spam or fraud",
  },
  harassment: {
    el: "Παρενόχληση ή ενοχλητικά μηνύματα",
    en: "Harassment or unsolicited messages",
  },
  broke_agreement: {
    el: "Δεν τήρησε τη συνεργασία",
    en: "Did not honor the collaboration",
  },
  other: {
    el: "Άλλο",
    en: "Other",
  },
};

const STATUS_LABELS: Record<UserReportStatus, { el: string; en: string }> = {
  new: { el: "Νέα", en: "New" },
  in_review: { el: "Σε εξέταση", en: "In review" },
  closed: { el: "Κλειστή", en: "Closed" },
};

export function userReportReasonLabel(reason: UserReportReason, lang: "el" | "en"): string {
  return REASON_LABELS[reason][lang];
}

export function userReportStatusLabel(status: UserReportStatus, lang: "el" | "en"): string {
  return STATUS_LABELS[status][lang];
}

export function allUserReportReasons(lang: "el" | "en"): { key: UserReportReason; label: string }[] {
  return USER_REPORT_REASON_KEYS.map((key) => ({ key, label: REASON_LABELS[key][lang] }));
}

export function isOpenUserReportStatus(status: string): boolean {
  return status === "new" || status === "in_review";
}

export type UserReportSubmitInput = {
  target_type?: unknown;
  target_id?: unknown;
  brand_email?: unknown;
  reason?: unknown;
  comment?: unknown;
  context?: unknown;
  conversation_id?: unknown;
};

export type UserReportValidatedBody = {
  target_type: UserReportTargetType;
  target_id: string;
  reason: UserReportReason;
  comment: string | null;
  context: UserReportContext;
  conversation_id: string | null;
  brand_email?: string;
};

export type ParsedUserReportSubmit =
  | { ok: true; value: UserReportValidatedBody }
  | { ok: false; error: string };

function trimComment(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t ? t.slice(0, USER_REPORT_COMMENT_MAX) : null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseUserReportSubmit(body: UserReportSubmitInput): ParsedUserReportSubmit {
  const target_type = body.target_type;
  if (target_type !== "creator" && target_type !== "brand") {
    return { ok: false, error: "Invalid target_type" };
  }

  const target_id = typeof body.target_id === "string" ? body.target_id.trim() : "";
  const brand_email = typeof body.brand_email === "string" ? body.brand_email.trim() : "";
  if (!target_id) {
    if (target_type === "brand" && brand_email) {
      /* resolved server-side */
    } else {
      return { ok: false, error: "Invalid target_id" };
    }
  } else if (!UUID_RE.test(target_id)) {
    return { ok: false, error: "Invalid target_id" };
  }

  const reason = body.reason;
  if (typeof reason !== "string" || !USER_REPORT_REASON_KEYS.includes(reason as UserReportReason)) {
    return { ok: false, error: "Invalid reason" };
  }

  const context = body.context;
  if (context !== "profile" && context !== "chat") {
    return { ok: false, error: "Invalid context" };
  }

  const comment = trimComment(body.comment);
  if (reason === "other" && !comment) {
    return { ok: false, error: "Comment required for other" };
  }

  let conversation_id: string | null = null;
  if (body.conversation_id != null && body.conversation_id !== "") {
    if (typeof body.conversation_id !== "string" || !UUID_RE.test(body.conversation_id.trim())) {
      return { ok: false, error: "Invalid conversation_id" };
    }
    conversation_id = body.conversation_id.trim();
  }

  if (context === "chat" && !conversation_id) {
    return { ok: false, error: "conversation_id required for chat context" };
  }

  const value: UserReportValidatedBody = {
    target_type,
    target_id,
    reason: reason as UserReportReason,
    comment,
    context,
    conversation_id,
  };
  if (target_type === "brand" && brand_email && !target_id) {
    value.brand_email = brand_email;
  }
  return { ok: true, value };
}

export async function resolveBrandIdFromEmail(
  admin: SupabaseClient,
  email: string
): Promise<string | null> {
  const e = email.trim();
  if (!e || !e.includes("@")) return null;
  const lower = e.toLowerCase();
  const byId = await admin.from("brands").select("id").ilike("contact_email", lower).maybeSingle();
  if (byId.data?.id) return String(byId.data.id);
  const priv = await admin
    .from("brand_private")
    .select("brand_id")
    .ilike("contact_email", lower)
    .maybeSingle();
  if (priv.data?.brand_id) return String(priv.data.brand_id);
  return null;
}

export async function resolveBrandIdForAuthUser(
  admin: SupabaseClient,
  userId: string,
  email: string | null | undefined
): Promise<string | null> {
  const byId = await admin.from("brands").select("id").eq("id", userId).maybeSingle();
  if (byId.data?.id) return String(byId.data.id);
  const e = (email || "").trim();
  if (!e) return null;
  return resolveBrandIdFromEmail(admin, e);
}

export async function resolveInfluencerIdForAuthUser(
  admin: SupabaseClient,
  userId: string,
  email: string | null | undefined
): Promise<string | null> {
  const byAuth = await admin.from("influencers").select("id").eq("auth_user_id", userId).maybeSingle();
  if (byAuth.data?.id) return String(byAuth.data.id);
  const byId = await admin.from("influencers").select("id").eq("id", userId).maybeSingle();
  if (byId.data?.id) return String(byId.data.id);
  const e = (email || "").trim();
  if (!e) return null;
  const byEmail = await admin.from("influencers").select("id").ilike("contact_email", e).maybeSingle();
  return byEmail.data?.id ? String(byEmail.data.id) : null;
}