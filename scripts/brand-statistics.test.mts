import assert from "node:assert/strict";
import test from "node:test";
import { aggregateBrandStatistics, agreedProposalEuros } from "../lib/brandStatistics.ts";

test("agreed price uses an accepted counter-offer", () => {
  assert.equal(agreedProposalEuros({ budget: "100", counterBudget: "180", counterStatus: "accepted" }), 180);
  assert.equal(agreedProposalEuros({ budget: "100", counterBudget: "180", counterStatus: "pending" }), 100);
});

test("statistics count only this brand's accepted work", () => {
  const stats = aggregateBrandStatistics(
    [
      {
        id: "1",
        influencerId: "a",
        status: "accepted",
        budget: "100",
        counterBudget: "150",
        counterStatus: "accepted",
        agreementAcceptedAt: "2026-10-02T10:00:00.000Z",
        publishDeadline: "2026-10-20",
        createdAt: "2026-10-01T10:00:00.000Z",
      },
      {
        id: "2",
        influencerId: "a",
        status: "pending",
        budget: "80",
        counterBudget: null,
        counterStatus: null,
        agreementAcceptedAt: null,
        publishDeadline: null,
        createdAt: "2026-10-15T10:00:00.000Z",
      },
      {
        id: "3",
        influencerId: "b",
        status: "rejected",
        budget: "40",
        counterBudget: null,
        counterStatus: null,
        agreementAcceptedAt: null,
        publishDeadline: null,
        createdAt: "2026-09-01T10:00:00.000Z",
      },
    ],
    [{ status: "open" }, { status: "draft" }],
    new Date("2026-11-01T12:00:00.000Z")
  );
  assert.equal(stats.sent, 3);
  assert.equal(stats.accepted, 1);
  assert.equal(stats.acceptanceRate, 33);
  assert.equal(stats.completedAgreements, 1);
  assert.equal(stats.spent, 150);
  assert.equal(stats.average, 150);
  assert.equal(stats.activeCampaigns, 1);
  assert.equal(stats.totalCampaigns, 2);
  assert.equal(stats.uniqueCreators, 2);
  assert.equal(stats.collaborations[0]?.amount, 150);
  const october = stats.months.find((month) => month.key === "2026-10");
  assert.equal(october?.proposals, 2);
  assert.equal(october?.amount, 150 + 80);
});
