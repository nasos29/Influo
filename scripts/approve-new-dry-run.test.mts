import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildWouldBeEmailsForApproveNew,
  wouldApproveNewFromScrapedAccounts,
} from "../lib/approveNewDryRun.ts";

test("would_approve when all accounts ok", () => {
  assert.deepEqual(
    wouldApproveNewFromScrapedAccounts([
      { platform: "instagram", username: "a", ok: true },
    ]),
    { would_approve: true, block_reason: null }
  );
});

test("would not approve on scrape failure", () => {
  assert.equal(
    wouldApproveNewFromScrapedAccounts([
      { platform: "instagram", username: "a", ok: false, error: "Profile not found" },
    ]).would_approve,
    false
  );
});

test("missing-account email only on clear not-found when flag on", () => {
  const prior = process.env.MISSING_ACCOUNT_EMAIL_ON_APPROVE_ENABLED;
  process.env.MISSING_ACCOUNT_EMAIL_ON_APPROVE_ENABLED = "1";
  process.env.ADMIN_EMAIL = "admin@example.com";
  try {
    const emails = buildWouldBeEmailsForApproveNew({
      influencerId: "x",
      influencerName: "N",
      contactEmail: "c@example.com",
      accounts: [
        { platform: "instagram", username: "a", ok: false, error: "Profile @a not found." },
        { platform: "tiktok", username: "b", ok: false, error: "Private profile: ιδιωτικό" },
      ],
      wouldApprove: false,
      wouldAdminUnapproved: true,
    });
    assert.equal(emails.filter((e) => e.template === "missing_social_account").length, 1);
    assert.ok(emails.some((e) => e.reason === "admin_alert_unapproved"));
  } finally {
    if (prior === undefined) delete process.env.MISSING_ACCOUNT_EMAIL_ON_APPROVE_ENABLED;
    else process.env.MISSING_ACCOUNT_EMAIL_ON_APPROVE_ENABLED = prior;
  }
});

test("preview path does not write to influencers", async () => {
  let writes = 0;
  const chain = {
    eq() {
      return chain;
    },
    maybeSingle: async () => ({
      data: {
        id: "id1",
        display_name: "N",
        contact_email: "c@test.com",
        bio: "el bio",
        bio_en: null,
        category: null,
        gender: null,
        location: null,
        insights_urls: null,
        approved: false,
        approved_at: null,
      },
      error: null,
    }),
    select() {
      return chain;
    },
    update() {
      writes += 1;
      return chain;
    },
    from(table: string) {
      if (table === "influencers") return chain;
      throw new Error(`unexpected write table ${table}`);
    },
  };
  const supabase = { from: chain.from } as unknown as SupabaseClient;
  const { runApproveNewPreview } = await import("../lib/approveNewDryRun.ts");
  const priorKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    await runApproveNewPreview(supabase, {
      influencerId: "id1",
      influencerName: "N",
      accounts: [{ platform: "instagram", username: "foo", ok: true, followers: "100" }],
    });
    assert.equal(writes, 0);
  } finally {
    if (priorKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = priorKey;
  }
});