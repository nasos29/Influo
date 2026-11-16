/**
 * Optional daily admin digest instead of per-application admin Resend copies.
 * Flag ADMIN_APPLICATION_DIGEST_ENABLED (default OFF). Brand/creator mails unchanged.
 */

import fs from "node:fs";
import path from "node:path";
import { isAdminApplicationDigestEnabled } from "@/lib/zohoBulkMailFlags";
import { mailAdminEvent, siteUrl } from "@/lib/proposalMail";

const QUEUE_FILE =
  process.env.ADMIN_APPLICATION_DIGEST_FILE ||
  path.join(process.cwd(), ".data", "admin-application-digest.json");

export type AdminApplicationDigestEntry = {
  at: string;
  campaignTitle: string;
  brandName: string;
  influencerName: string;
  proposedPrice: string | null;
};

type QueueState = { entries: AdminApplicationDigestEntry[] };

function load(): QueueState {
  try {
    const raw = JSON.parse(fs.readFileSync(QUEUE_FILE, "utf8")) as QueueState;
    return { entries: Array.isArray(raw.entries) ? raw.entries : [] };
  } catch {
    return { entries: [] };
  }
}

function save(state: QueueState): void {
  try {
    fs.mkdirSync(path.dirname(QUEUE_FILE), { recursive: true });
    const tmp = `${QUEUE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state), { mode: 0o600 });
    fs.renameSync(tmp, QUEUE_FILE);
  } catch (err) {
    console.error(
      "[admin application digest] save failed",
      err instanceof Error ? err.message : err
    );
  }
}

export function adminApplicationDigestQueueStatus(): { pending: number } {
  return { pending: load().entries.length };
}

/** Queue one row when digest flag is ON. Returns true if queued (caller should skip immediate admin mail). */
export function enqueueAdminApplicationDigest(entry: Omit<AdminApplicationDigestEntry, "at">): boolean {
  if (!isAdminApplicationDigestEnabled()) return false;
  const state = load();
  state.entries.push({
    at: new Date().toISOString(),
    campaignTitle: entry.campaignTitle,
    brandName: entry.brandName,
    influencerName: entry.influencerName,
    proposedPrice: entry.proposedPrice,
  });
  // Cap disk growth if cron is missing.
  if (state.entries.length > 500) state.entries = state.entries.slice(-500);
  save(state);
  return true;
}

export function buildAdminApplicationDigestHtml(entries: AdminApplicationDigestEntry[]): {
  subject: string;
  html: string;
} {
  const n = entries.length;
  const rows = entries
    .map((e) => {
      const price = e.proposedPrice ? ` · ${e.proposedPrice}` : "";
      return `<li><strong>${escape(e.influencerName)}</strong> → ${escape(e.brandName)} / ${escape(e.campaignTitle)}${escape(price)} <span style="color:#9ca3af;font-size:12px;">(${escape(e.at.slice(0, 16).replace("T", " "))})</span></li>`;
    })
    .join("\n");
  return {
    subject: `Influo: ${n} νέ${n === 1 ? "α αίτηση" : "ες αιτήσεις"} καμπάνιας (ημερήσιο digest)`,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#1f2937;">
  <p>Σύνοψη αιτήσεων καμπάνιας (αντί για ξεχωριστό admin email ανά αίτηση).</p>
  <ul>${rows}</ul>
  <p><a href="${siteUrl()}/admin">Άνοιξε το admin</a></p>
</div>`,
  };
}

function escape(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type AdminApplicationDigestFlushResult = {
  sent: boolean;
  count: number;
  skipped: boolean;
  reason?: string;
};

/** Send one Resend admin digest and clear the queue. Safe no-op when empty or flag off. */
export async function flushAdminApplicationDigest(opts?: {
  dryRun?: boolean;
}): Promise<AdminApplicationDigestFlushResult> {
  if (!isAdminApplicationDigestEnabled()) {
    return { sent: false, count: 0, skipped: true, reason: "flag_off" };
  }
  const state = load();
  if (!state.entries.length) {
    return { sent: false, count: 0, skipped: true, reason: "empty" };
  }
  const mail = buildAdminApplicationDigestHtml(state.entries);
  if (opts?.dryRun) {
    return { sent: false, count: state.entries.length, skipped: true, reason: "dry_run" };
  }
  await mailAdminEvent(
    "campaign_application_admin_digest",
    mail.subject,
    `Ημερήσιο digest αιτήσεων (${state.entries.length})`,
    state.entries.slice(0, 40).map((e) => [
      e.influencerName,
      `${e.brandName} / ${e.campaignTitle}${e.proposedPrice ? ` · ${e.proposedPrice}` : ""}`,
    ])
  );
  save({ entries: [] });
  return { sent: true, count: state.entries.length, skipped: false };
}
