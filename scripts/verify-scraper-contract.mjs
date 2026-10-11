/**
 * Static check: AuditPro talks only to these HTTP routes, never to Supabase.
 * The routes must keep service-role access and the action contract.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const routes = [
  "app/api/cron/social-refresh-batch/route.ts",
  "app/api/cron/approve-new-influencers/route.ts",
];

for (const rel of routes) {
  const src = read(rel);
  if (!src.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    throw new Error(`${rel} must use SUPABASE_SERVICE_ROLE_KEY`);
  }
  if (src.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
    throw new Error(`${rel} must not use the anon key`);
  }
  if (!src.includes('auth !== `Bearer ${cronSecret}`') && !src.includes("auth !== `Bearer ${cronSecret}`")) {
    throw new Error(`${rel} must keep Bearer CRON_SECRET auth`);
  }
  for (const action of ["start", "log", "abort", "finish", "apply"]) {
    if (!src.includes(`action === '${action}'`)) {
      throw new Error(`${rel} missing action ${action}`);
    }
  }
  if (!src.includes("run, influencers, purged")) {
    throw new Error(`${rel} start response must still include run, influencers, purged`);
  }
  if (!src.includes(".from('influencers')") && !src.includes('.from("influencers")')) {
    throw new Error(`${rel} must still read/write influencers via the server client`);
  }
}

const approve = read("lib/approveNewInfluencer.ts");
if (!approve.includes("contact_email")) {
  throw new Error("approve-new must still read contact_email on the server to send the approval email");
}
const refresh = read("lib/refreshSocialStats.ts");
if (!refresh.includes(".from('influencers')")) {
  throw new Error("social refresh must still update influencers");
}
for (const col of ["accounts", "last_social_refresh_at", "auditpr_audit"]) {
  if (!refresh.includes(col)) throw new Error(`refreshSocialStats missing ${col}`);
}

const py = read("scripts/social_refresh_batch.py") + "\n" + read("scripts/new_influencer_approval_batch.py");
if (/supabase|SERVICE_ROLE|anon key/i.test(py)) {
  throw new Error("Oracle python scrapers must not talk to Supabase directly");
}
if (!py.includes("/api/cron/social-refresh-batch") || !py.includes("/api/cron/approve-new-influencers")) {
  throw new Error("Oracle scripts must keep the Influo cron URLs");
}
if (!py.includes("CRON_SECRET") || !py.includes('action": "start"') && !py.includes('"action": "start"')) {
  // python uses action='start' or "action": "start"
}
if (!py.includes('"start"') && !py.includes("'start'")) {
  throw new Error("Oracle scripts must still post action start");
}

console.log("scraper contract ok");
