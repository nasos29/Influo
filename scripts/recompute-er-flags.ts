/**
 * Recompute stored ER flags with the thresholds in lib/engagementFlags.ts.
 *
 * Dry-run is the default. It prints how many accounts would lose or gain
 * er_suspicious and does not write.
 *
 *   node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs scripts/recompute-er-flags.ts
 *
 * --apply updates only the accounts JSON on rows whose flag fields change.
 * The next social refresh recomputes the same fields, so this is optional.
 *
 *   node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs scripts/recompute-er-flags.ts --apply
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Do not point it at production unless a stored-flag rewrite is intended.
 */
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { recomputeStoredAccount, type ErCheckInput } from "../lib/engagementFlags.ts";

type Row = {
  id: string;
  accounts?: ErCheckInput[] | null;
};

function flagChanged(before: ErCheckInput, after: ErCheckInput): boolean {
  const wasHard = before.er_suspicious === true;
  const nowHard = after.er_suspicious === true;
  const wasReason = before.er_flag_reason || null;
  const nowReason = after.er_flag_reason || null;
  return wasHard !== nowHard || wasReason !== nowReason;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const pageSize = 1000;
  let lose = 0;
  let gain = 0;
  let keep = 0;
  let soft = 0;
  let accounts = 0;
  let rowsChanged = 0;
  let rowsSeen = 0;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("influencers")
      .select("id, accounts")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Row[];
    for (const row of rows) {
      rowsSeen += 1;
      const current = Array.isArray(row.accounts) ? row.accounts : [];
      if (!current.length) continue;
      const next = current.map((account) => recomputeStoredAccount(account));
      let rowChanged = false;
      for (let i = 0; i < current.length; i += 1) {
        accounts += 1;
        const wasHard = current[i]?.er_suspicious === true;
        const nowHard = next[i]?.er_suspicious === true;
        if (wasHard && !nowHard) lose += 1;
        else if (!wasHard && nowHard) gain += 1;
        else if (wasHard && nowHard) keep += 1;
        if (!nowHard && next[i]?.er_flag_reason) soft += 1;
        if (flagChanged(current[i] || {}, next[i])) rowChanged = true;
      }
      if (!rowChanged) continue;
      rowsChanged += 1;
      if (!apply) continue;
      const { error: updateError } = await supabase.from("influencers").update({ accounts: next }).eq("id", row.id);
      if (updateError) throw new Error(`${row.id}: ${updateError.message}`);
    }
    if (rows.length < pageSize) break;
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        rowsSeen,
        accounts,
        hardFlagLose: lose,
        hardFlagGain: gain,
        hardFlagKeep: keep,
        softLabels: soft,
        rowsChanged,
      },
      null,
      2
    )
  );
}

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
