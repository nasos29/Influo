import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { handleMissingAccountNoticesForNewApproval } from "../lib/missingAccountEmail.ts";
import {
  isMissingAccountEmailOnApproveEnabled,
  isPermanentAccountMissingError,
} from "../lib/socialAccountMissing.ts";

test("permanent missing vs transient/session", () => {
  assert.equal(isPermanentAccountMissingError("Λάθος username: το προφίλ @foo δεν υπάρχει."), true);
  assert.equal(isPermanentAccountMissingError("Profile @foo not found."), true);
  assert.equal(isPermanentAccountMissingError("Private profile: το προφίλ @foo είναι ιδιωτικό."), false);
  assert.equal(isPermanentAccountMissingError("Could not read Instagram profile in browser."), false);
  assert.equal(isPermanentAccountMissingError("Instagram session expired (login wall)."), false);
  assert.equal(isPermanentAccountMissingError("TikTok video list unavailable (session)."), false);
  assert.equal(isPermanentAccountMissingError("no instagram session"), false);
  assert.equal(isPermanentAccountMissingError("Auditpr request failed: timeout"), false);
  assert.equal(isPermanentAccountMissingError("User not found on TikTok"), true);
});

test("MISSING_ACCOUNT_EMAIL_ON_APPROVE_ENABLED defaults off", () => {
  assert.equal(isMissingAccountEmailOnApproveEnabled({} as NodeJS.ProcessEnv), false);
  assert.equal(isMissingAccountEmailOnApproveEnabled({ MISSING_ACCOUNT_EMAIL_ON_APPROVE_ENABLED: "" }), false);
});

test("MISSING_ACCOUNT_EMAIL_ON_APPROVE_ENABLED on for 1", () => {
  assert.equal(isMissingAccountEmailOnApproveEnabled({ MISSING_ACCOUNT_EMAIL_ON_APPROVE_ENABLED: "1" }), true);
});

test("handleMissingAccountNoticesForNewApproval does not send when the new flag is off", async () => {
  const prior = process.env.MISSING_ACCOUNT_EMAIL_ON_APPROVE_ENABLED;
  delete process.env.MISSING_ACCOUNT_EMAIL_ON_APPROVE_ENABLED;
  let dbTouched = false;
  const supabase = {
    from() {
      dbTouched = true;
      throw new Error("should not query when flag is off");
    },
  } as unknown as SupabaseClient;
  try {
    await handleMissingAccountNoticesForNewApproval(supabase, "test-id", "Test Creator", [
      {
        platform: "instagram",
        username: "foo",
        ok: false,
        error: "Profile @foo not found.",
      },
    ]);
    assert.equal(dbTouched, false);
  } finally {
    if (prior === undefined) delete process.env.MISSING_ACCOUNT_EMAIL_ON_APPROVE_ENABLED;
    else process.env.MISSING_ACCOUNT_EMAIL_ON_APPROVE_ENABLED = prior;
  }
});