import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deriveProposalDisplayStatus,
  deriveProposalDisplayStatusKey,
  isActiveCampaignDealRow,
  isActiveCollaborationDisplayKey,
  normalizeProposalDisplayStatusFilter,
  proposalDisplayStatusLabel,
} from "../lib/proposalDisplayStatus.ts";

test("normalize maps legacy accepted/canceled", () => {
  assert.equal(normalizeProposalDisplayStatusFilter("accepted"), "awaiting_agreement");
  assert.equal(normalizeProposalDisplayStatusFilter("canceled"), "cancelled");
  assert.equal(normalizeProposalDisplayStatusFilter("awaiting_approval"), "awaiting_approval");
  assert.equal(normalizeProposalDisplayStatusFilter("all"), "all");
  assert.equal(normalizeProposalDisplayStatusFilter("nope"), "all");
});

test("derive pending / rejected / cancelled", () => {
  assert.equal(deriveProposalDisplayStatusKey({ status: "pending" }), "pending");
  assert.equal(deriveProposalDisplayStatusKey({ status: "rejected" }), "rejected");
  assert.equal(deriveProposalDisplayStatusKey({ status: "cancelled" }), "cancelled");
  assert.equal(deriveProposalDisplayStatusKey({ status: "canceled" }), "cancelled");
});

test("accepted -> awaiting agreement", () => {
  assert.equal(
    deriveProposalDisplayStatusKey({
      status: "accepted",
      influencer_agreement_accepted: false,
      brand_agreement_accepted: false,
    }),
    "awaiting_agreement"
  );
  assert.equal(
    deriveProposalDisplayStatus({ status: "accepted" }, "el").label,
    "Αναμονή συμφωνίας"
  );
});

test("completed without deliverable -> in progress", () => {
  assert.equal(
    deriveProposalDisplayStatusKey({
      status: "completed",
      influencer_agreement_accepted: true,
      brand_agreement_accepted: true,
    }),
    "in_progress"
  );
  assert.equal(proposalDisplayStatusLabel("in_progress", "el"), "Σε εξέλιξη");
});

test("changes_requested on proposal -> in progress (not awaiting approval)", () => {
  assert.equal(
    deriveProposalDisplayStatusKey({
      status: "completed",
      delivery_mode: "link",
      delivery_submitted_at: "2026-11-01T00:00:00.000Z",
      published_post_url: "https://example.com/post",
      published_post_pending_approval: false,
      deliverable_status: "changes_requested",
    }),
    "in_progress"
  );
});

test("active collaboration display keys", () => {
  assert.equal(isActiveCollaborationDisplayKey("pending"), false);
  assert.equal(isActiveCollaborationDisplayKey("in_progress"), true);
  assert.equal(isActiveCollaborationDisplayKey("awaiting_approval"), true);
  assert.equal(isActiveCollaborationDisplayKey("completed"), false);
  assert.equal(isActiveCampaignDealRow({ status: "accepted" }), true);
  assert.equal(isActiveCampaignDealRow({ status: "accepted", deliverable_status: "approved" }), false);
  assert.equal(isActiveCampaignDealRow({ status: "pending" }), false);
});

test("link submitted awaiting brand -> awaiting approval", () => {
  assert.equal(
    deriveProposalDisplayStatusKey({
      status: "completed",
      delivery_mode: "link",
      delivery_submitted_at: "2026-11-01T00:00:00.000Z",
      published_post_url: "https://example.com/post",
    }),
    "awaiting_approval"
  );
  assert.equal(
    deriveProposalDisplayStatusKey({
      status: "completed",
      published_post_url: "https://example.com/post",
      published_post_pending_approval: true,
    }),
    "awaiting_approval"
  );
});

test("event confirm pending -> needs admin", () => {
  assert.equal(
    deriveProposalDisplayStatusKey({
      status: "completed",
      delivery_mode: "event",
      delivery_submitted_at: "2026-11-01T00:00:00.000Z",
    }),
    "needs_admin"
  );
  assert.equal(
    deriveProposalDisplayStatus({ status: "completed", delivery_mode: "event", delivery_submitted_at: "x" }, "el")
      .label,
    "Χρειάζεται admin"
  );
});

test("real completion stamps -> completed", () => {
  assert.equal(
    deriveProposalDisplayStatusKey({
      status: "completed",
      delivery_confirmed_at: "2026-11-02T00:00:00.000Z",
    }),
    "completed"
  );
  assert.equal(
    deriveProposalDisplayStatusKey({
      status: "completed",
      auto_completed_at: "2026-11-02T00:00:00.000Z",
      delivery_mode: "link",
      delivery_submitted_at: "2026-11-01T00:00:00.000Z",
    }),
    "completed"
  );
});

test("brand pending: awaiting reply (el + en)", () => {
  assert.equal(proposalDisplayStatusLabel("pending", "el", "brand"), "Αναμονή απάντησης");
  assert.equal(proposalDisplayStatusLabel("pending", "en", "brand"), "Awaiting reply");
  assert.equal(
    deriveProposalDisplayStatus({ status: "pending" }, "el", "brand").label,
    "Αναμονή απάντησης"
  );
  assert.equal(
    deriveProposalDisplayStatus({ status: "pending" }, "en", "brand").label,
    "Awaiting reply"
  );
});

test("creator/party labels: pending and collaboration-started keys (el + en)", () => {
  assert.equal(proposalDisplayStatusLabel("pending", "el", "creator"), "Πρόταση");
  assert.equal(proposalDisplayStatusLabel("pending", "en", "creator"), "Proposal");
  assert.equal(proposalDisplayStatusLabel("pending", "el", "party"), "Πρόταση");
  assert.equal(proposalDisplayStatusLabel("pending", "en", "party"), "Proposal");
  assert.equal(
    deriveProposalDisplayStatus({ status: "pending" }, "el", "party").label,
    "Πρόταση"
  );

  const startedKeys = [
    "awaiting_agreement",
    "in_progress",
    "awaiting_approval",
    "needs_admin",
  ] as const;
  for (const key of startedKeys) {
    assert.equal(
      proposalDisplayStatusLabel(key, "el", "party"),
      "Ξεκίνησε συνεργασία",
      key
    );
    assert.equal(
      proposalDisplayStatusLabel(key, "en", "party"),
      "Collaboration started",
      key
    );
  }

  assert.equal(
    deriveProposalDisplayStatus(
      { status: "accepted" },
      "en",
      "party"
    ).label,
    "Collaboration started"
  );
  assert.equal(
    deriveProposalDisplayStatus(
      { status: "completed" },
      "el",
      "party"
    ).label,
    "Ξεκίνησε συνεργασία"
  );
  assert.equal(
    deriveProposalDisplayStatus(
      {
        status: "completed",
        delivery_mode: "link",
        delivery_submitted_at: "2026-11-01T00:00:00.000Z",
        published_post_url: "https://example.com/post",
      },
      "en",
      "party"
    ).label,
    "Collaboration started"
  );

  assert.equal(
    deriveProposalDisplayStatus(
      { status: "completed", delivery_confirmed_at: "2026-11-02T00:00:00.000Z" },
      "el",
      "party"
    ).label,
    "Ολοκληρώθηκε"
  );
  assert.equal(
    deriveProposalDisplayStatus({ status: "cancelled" }, "en", "party").label,
    "Cancelled"
  );
  assert.equal(
    deriveProposalDisplayStatus({ status: "rejected" }, "el", "party").label,
    "Απορρίφθηκε"
  );
});

test("admin labels unchanged when audience omitted", () => {
  assert.equal(proposalDisplayStatusLabel("pending", "el"), "Εκκρεμεί");
  assert.equal(
    deriveProposalDisplayStatus({ status: "accepted" }, "el").label,
    "Αναμονή συμφωνίας"
  );
});

test("badge classes cover waiting / progress / done / reject / cancel / admin", () => {
  const waiting = deriveProposalDisplayStatus({ status: "pending" }, "en");
  assert.match(waiting.badgeClass, /amber/);
  const progress = deriveProposalDisplayStatus({ status: "completed" }, "en");
  assert.match(progress.badgeClass, /blue/);
  const done = deriveProposalDisplayStatus(
    { status: "completed", delivery_confirmed_at: "2026-11-01T00:00:00.000Z" },
    "en"
  );
  assert.match(done.badgeClass, /emerald/);
  const rejected = deriveProposalDisplayStatus({ status: "rejected" }, "en");
  assert.match(rejected.badgeClass, /red/);
  const cancelled = deriveProposalDisplayStatus({ status: "cancelled" }, "en");
  assert.match(cancelled.badgeClass, /slate/);
  const admin = deriveProposalDisplayStatus(
    {
      status: "completed",
      delivery_mode: "event",
      delivery_submitted_at: "2026-11-01T00:00:00.000Z",
    },
    "en"
  );
  assert.match(admin.badgeClass, /purple/);
});
