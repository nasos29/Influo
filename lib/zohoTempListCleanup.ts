/**
 * Delayed cleanup for temporary Zoho mailing lists used by selected-recipient
 * announcements. Deleting the list while sendcampaign is still InProgress drops
 * the recipient set and emails_sent_count stays 0 — so we wait until Sent (and
 * emails_sent_count matches) or a safe max age.
 */

import fs from "node:fs";
import path from "node:path";
import { getZohoCampaignsEnv, type ZohoCampaignsEnv } from "@/lib/zohoCampaignsConfig";
import {
  zohoDeleteMailingList,
  zohoGetCampaignDetails,
  zohoResponseOk,
} from "@/lib/zohoCampaignsClient";

const STATE_FILE =
  process.env.ZOHO_TEMP_LIST_CLEANUP_FILE ||
  path.join(process.cwd(), ".data", "zoho-temp-list-cleanup.json");

/** Force-delete after this age even if Zoho status never reaches Sent. */
export const ZOHO_TEMP_LIST_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export type ZohoTempListPending = {
  listKey: string;
  campaignKey: string;
  expectedEmails: number;
  createdAt: string;
  audience?: string;
};

type State = { pending: ZohoTempListPending[] };

function loadState(): State {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as { pending?: ZohoTempListPending[] };
    return { pending: Array.isArray(raw.pending) ? raw.pending : [] };
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.error("[zoho temp list] state load failed", err instanceof Error ? err.message : err);
    }
    return { pending: [] };
  }
}

function saveState(state: State): void {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    const tmp = `${STATE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ pending: state.pending }, null, 0), { mode: 0o600 });
    fs.renameSync(tmp, STATE_FILE);
  } catch (err) {
    console.error("[zoho temp list] state save failed", err instanceof Error ? err.message : err);
  }
}

export function enqueueZohoTempListCleanup(entry: ZohoTempListPending): void {
  const state = loadState();
  if (state.pending.some((p) => p.listKey === entry.listKey && p.campaignKey === entry.campaignKey)) {
    return;
  }
  state.pending.push(entry);
  saveState(state);
  console.log("[zoho temp list] queued cleanup", {
    listKey: entry.listKey.slice(0, 8) + "…",
    campaignKey: entry.campaignKey,
    expectedEmails: entry.expectedEmails,
  });
}

export function listZohoTempListPending(): ZohoTempListPending[] {
  return loadState().pending.slice();
}

function statusIsSent(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === "sent" || s.includes("sent");
}

function statusIsTerminalFailure(status: string): boolean {
  const s = status.trim().toLowerCase();
  return (
    s.includes("cancel") ||
    s.includes("stopped") ||
    s.includes("deleted") ||
    s.includes("error") ||
    s.includes("fail")
  );
}

async function tryDeleteList(
  listKey: string,
  env: ZohoCampaignsEnv
): Promise<{ deleted: boolean; error?: string }> {
  try {
    const delRaw = await zohoDeleteMailingList(listKey, { deleteContacts: false }, env);
    const deleted =
      zohoResponseOk(delRaw) || JSON.stringify(delRaw).toLowerCase().includes("deleted");
    if (!deleted) {
      return { deleted: false, error: JSON.stringify(delRaw).slice(0, 200) };
    }
    return { deleted: true };
  } catch (err) {
    return { deleted: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type ZohoTempListCleanupResult = {
  checked: number;
  deleted: number;
  kept: number;
  errors: string[];
};

/**
 * Process pending temp lists: delete when Sent + emails_sent_count matches
 * expected, or when past max age / terminal failure.
 */
export async function processZohoTempListCleanup(
  opts?: { maxAgeMs?: number; env?: ZohoCampaignsEnv }
): Promise<ZohoTempListCleanupResult> {
  const env = opts?.env || getZohoCampaignsEnv();
  const maxAgeMs = opts?.maxAgeMs ?? ZOHO_TEMP_LIST_MAX_AGE_MS;
  const state = loadState();
  const initialCount = state.pending.length;
  const kept: ZohoTempListPending[] = [];
  const errors: string[] = [];
  let deleted = 0;
  const now = Date.now();

  for (const entry of state.pending) {
    const ageMs = Math.max(0, now - new Date(entry.createdAt).getTime());
    const expired = ageMs >= maxAgeMs;
    let shouldDelete = false;
    let reason = "";

    try {
      const details = await zohoGetCampaignDetails(entry.campaignKey, env);
      const sent = statusIsSent(details.status);
      const failed = statusIsTerminalFailure(details.status);
      const count = details.emailsSentCount;
      const countOk =
        count != null &&
        Number.isFinite(count) &&
        count >= Math.max(1, entry.expectedEmails);

      if (sent && countOk) {
        shouldDelete = true;
        reason = `sent count=${count}`;
      } else if (failed || expired) {
        shouldDelete = true;
        reason = failed ? `terminal status=${details.status}` : `max_age_ms=${maxAgeMs}`;
      } else {
        reason = `wait status=${details.status || "?"} count=${count ?? "n/a"} ageMs=${ageMs}`;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (expired) {
        shouldDelete = true;
        reason = `details_error+max_age: ${msg}`;
      } else {
        errors.push(`${entry.campaignKey}: ${msg}`);
        reason = `keep after details_error: ${msg}`;
      }
    }

    if (shouldDelete) {
      const result = await tryDeleteList(entry.listKey, env);
      if (result.deleted) {
        deleted += 1;
        console.log("[zoho temp list] deleted", {
          campaignKey: entry.campaignKey,
          reason,
        });
      } else {
        errors.push(`delete ${entry.campaignKey}: ${result.error || "failed"}`);
        kept.push(entry);
      }
    } else {
      kept.push(entry);
      console.log("[zoho temp list] keep", { campaignKey: entry.campaignKey, reason });
    }
  }

  state.pending = kept;
  saveState(state);
  return {
    checked: initialCount,
    deleted,
    kept: kept.length,
    errors: errors.slice(0, 20),
  };
}
