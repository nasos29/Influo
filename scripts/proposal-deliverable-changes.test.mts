import assert from "node:assert/strict";
import { test } from "node:test";

/** Mirrors brand request-changes eligibility in /api/collaborations/showcase. */
function brandCanRequestProposalDeliverableChanges(proposal: {
  published_post_pending_approval?: boolean | null;
  deliverable_status?: string | null;
  delivery_confirmed_at?: string | null;
  auto_completed_at?: string | null;
}): boolean {
  if (proposal.delivery_confirmed_at || proposal.auto_completed_at) return false;
  return (
    !!proposal.published_post_pending_approval ||
    String(proposal.deliverable_status || "").toLowerCase() === "submitted"
  );
}

test("brand can request changes only while deliverable awaits review", () => {
  assert.equal(
    brandCanRequestProposalDeliverableChanges({
      published_post_pending_approval: true,
      deliverable_status: "submitted",
    }),
    true
  );
  assert.equal(
    brandCanRequestProposalDeliverableChanges({
      published_post_pending_approval: false,
      deliverable_status: "changes_requested",
    }),
    false
  );
  assert.equal(
    brandCanRequestProposalDeliverableChanges({
      published_post_pending_approval: true,
      delivery_confirmed_at: "2026-11-02T00:00:00.000Z",
    }),
    false
  );
});