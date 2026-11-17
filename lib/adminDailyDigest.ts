/**
 * Admin daily digest (~09:30 Europe/Athens): campaign applications, signups,
 * profile edits, unapproved alerts, new proposals.
 * When ADMIN_DAILY_DIGEST_ENABLED is ON, callers should enqueue instead of 1:1 mail.
 * Also covers legacy ADMIN_APPLICATION_DIGEST_ENABLED for applications-only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminApplicationDigestEnabled } from "@/lib/zohoBulkMailFlags";
import { isAdminDailyDigestEnabled } from "@/lib/emailDigestFlags";
import {
  enqueueDigestItem,
  listPendingDigestItems,
  markDigestItemsFlushed,
  type DigestType,
} from "@/lib/emailDigestQueue";
import { siteUrl } from "@/lib/proposalMail";
import { escapeHtml } from "@/lib/proposalParty";

const ADMIN_GROUP = "admin:daily";

export type AdminDigestKind =
  | "campaign_application"
  | "signup_creator"
  | "signup_brand"
  | "profile_edit"
  | "unapproved"
  | "proposal"
  | "collaboration_completed";

const KIND_TO_TYPE: Record<AdminDigestKind, DigestType> = {
  campaign_application: "admin_campaign_application",
  signup_creator: "admin_signup_creator",
  signup_brand: "admin_signup_brand",
  profile_edit: "admin_profile_edit",
  unapproved: "admin_alert_unapproved",
  proposal: "admin_proposal",
  collaboration_completed: "admin_collaboration_completed",
};

/** True when admin should queue this kind instead of sending 1:1. */
export function shouldQueueAdminDigest(
  kind: AdminDigestKind,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (isAdminDailyDigestEnabled(env)) return true;
  // Legacy: applications-only digest flag.
  if (kind === "campaign_application" && isAdminApplicationDigestEnabled(env)) return true;
  return false;
}

export async function enqueueAdminDigestItem(
  admin: SupabaseClient,
  kind: AdminDigestKind,
  payload: Record<string, unknown>
): Promise<boolean> {
  if (!shouldQueueAdminDigest(kind)) return false;
  const result = await enqueueDigestItem(admin, {
    digestType: KIND_TO_TYPE[kind],
    recipientKind: "admin",
    recipientEmail: null,
    groupKey: ADMIN_GROUP,
    payload: { kind, at: new Date().toISOString(), ...payload },
  });
  return result.ok;
}

function sectionTitle(kind: string): string {
  switch (kind) {
    case "campaign_application":
      return "Αιτήσεις καμπάνιας";
    case "signup_creator":
      return "Νέοι creators";
    case "signup_brand":
      return "Νέα brands";
    case "profile_edit":
      return "Επεξεργασίες προφίλ";
    case "unapproved":
      return "Μη εγκεκριμένοι creators";
    case "proposal":
      return "Νέες προτάσεις";
    case "collaboration_completed":
      return "Συνεργασίες που ολοκληρώθηκαν";
    default:
      return kind;
  }
}

function lineFor(payload: Record<string, unknown>): string {
  const kind = String(payload.kind || "");
  const at = String(payload.at || "").slice(0, 16).replace("T", " ");
  if (kind === "campaign_application") {
    return `<li><strong>${escapeHtml(String(payload.influencerName || ""))}</strong> → ${escapeHtml(String(payload.brandName || ""))} / ${escapeHtml(String(payload.campaignTitle || ""))}${
      payload.proposedPrice ? ` · ${escapeHtml(String(payload.proposedPrice))}` : ""
    } <span style="color:#9ca3af;font-size:12px;">(${escapeHtml(at)})</span></li>`;
  }
  if (kind === "signup_creator" || kind === "signup_brand") {
    return `<li><strong>${escapeHtml(String(payload.name || payload.email || ""))}</strong> ${escapeHtml(String(payload.email || ""))} <span style="color:#9ca3af;font-size:12px;">(${escapeHtml(at)})</span></li>`;
  }
  if (kind === "profile_edit") {
    return `<li><strong>${escapeHtml(String(payload.name || ""))}</strong> ${escapeHtml(String(payload.email || ""))} <span style="color:#9ca3af;font-size:12px;">(${escapeHtml(at)})</span></li>`;
  }
  if (kind === "unapproved") {
    return `<li><strong>${escapeHtml(String(payload.name || ""))}</strong> ${escapeHtml(String(payload.detail || ""))} <span style="color:#9ca3af;font-size:12px;">(${escapeHtml(at)})</span></li>`;
  }
  if (kind === "proposal") {
    return `<li><strong>${escapeHtml(String(payload.brandName || ""))}</strong> → ${escapeHtml(String(payload.creatorName || ""))} · ${escapeHtml(String(payload.service || ""))} <span style="color:#9ca3af;font-size:12px;">(${escapeHtml(at)})</span></li>`;
  }
  if (kind === "collaboration_completed") {
    const how =
      payload.mode === "auto"
        ? "αυτόματα"
        : payload.deliveryMode === "event"
          ? "event"
          : "έγκριση";
    return `<li><strong>${escapeHtml(String(payload.brandName || ""))}</strong> / ${escapeHtml(String(payload.creatorName || ""))} · ${escapeHtml(String(payload.source || ""))} ${escapeHtml(String(payload.id || ""))} · ${escapeHtml(how)} <span style="color:#9ca3af;font-size:12px;">(${escapeHtml(at)})</span></li>`;
  }
  return `<li>${escapeHtml(JSON.stringify(payload).slice(0, 200))}</li>`;
}

export function buildAdminDailyDigestHtml(
  items: Array<{ payload: Record<string, unknown> }>
): { subject: string; html: string } {
  const byKind = new Map<string, Record<string, unknown>[]>();
  for (const item of items) {
    const kind = String(item.payload.kind || "other");
    const list = byKind.get(kind) || [];
    list.push(item.payload);
    byKind.set(kind, list);
  }
  const n = items.length;
  const sections: string[] = [];
  for (const [kind, payloads] of byKind) {
    sections.push(
      `<h3 style="margin:16px 0 8px;font-size:15px;">${escapeHtml(sectionTitle(kind))} (${payloads.length})</h3><ul>${payloads.map(lineFor).join("")}</ul>`
    );
  }
  return {
    subject: `Influo: ημερήσιο digest (${n} ειδοποιήσ${n === 1 ? "η" : "εις"})`,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#1f2937;">
  <p>Σύνοψη admin ειδοποιήσεων (αντί για ξεχωριστά 1:1 emails).</p>
  ${sections.join("\n")}
  <p><a href="${siteUrl()}/admin">Άνοιξε το admin</a></p>
</div>`,
  };
}

/**
 * Athens local hour/minute check for ~09:30 window.
 * Cron runs every 15 min; we flush once when local time is 09:30–09:44.
 */
export function isAthensAdminDigestWindow(nowMs = Date.now()): boolean {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Athens",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(nowMs));
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    const minute = Number(parts.find((p) => p.type === "minute")?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
    return hour === 9 && minute >= 30 && minute < 45;
  } catch {
    return false;
  }
}

export type AdminDailyFlushResult = {
  sent: boolean;
  count: number;
  skipped: boolean;
  reason?: string;
};

export async function flushAdminDailyDigest(
  admin: SupabaseClient,
  opts?: { dryRun?: boolean; force?: boolean; nowMs?: number }
): Promise<AdminDailyFlushResult> {
  const dailyOn = isAdminDailyDigestEnabled();
  const appsOnly = isAdminApplicationDigestEnabled();
  if (!dailyOn && !appsOnly) {
    return { sent: false, count: 0, skipped: true, reason: "flag_off" };
  }

  const nowMs = opts?.nowMs ?? Date.now();
  if (!opts?.force && dailyOn && !isAthensAdminDigestWindow(nowMs)) {
    return { sent: false, count: 0, skipped: true, reason: "outside_window" };
  }

  const types: DigestType[] = dailyOn
    ? [
        "admin_campaign_application",
        "admin_signup_creator",
        "admin_signup_brand",
        "admin_profile_edit",
        "admin_alert_unapproved",
        "admin_proposal",
        "admin_collaboration_completed",
      ]
    : ["admin_campaign_application"];

  const all: Awaited<ReturnType<typeof listPendingDigestItems>> = [];
  for (const digestType of types) {
    const rows = await listPendingDigestItems(admin, { digestType, limit: 300 });
    all.push(...rows);
  }

  if (!all.length) {
    return { sent: false, count: 0, skipped: true, reason: "empty" };
  }

  const mail = buildAdminDailyDigestHtml(all.map((r) => ({ payload: r.payload })));
  if (opts?.dryRun) {
    return { sent: false, count: all.length, skipped: true, reason: "dry_run" };
  }

  const { send } = await import("@/lib/proposalMail");
  const adminTo = (process.env.ADMIN_EMAIL || "nd.6@hotmail.com").trim();
  await send("admin_daily_digest", adminTo, mail.subject, mail.html);
  await markDigestItemsFlushed(
    admin,
    all.map((r) => r.id)
  );
  return { sent: true, count: all.length, skipped: false };
}
