// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/completion-rate.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPLETION_NONE_SUBTITLE,
  formatCompletionRateDisplay,
  resolveCompletionRate,
} from "../lib/completionRate.ts";
import { buildChannelScore } from "../lib/channelScore.ts";
import { computeCollabScore, computeReviewScore, type TopScoreInfluencer } from "../lib/topInfluencerScore.ts";
import {
  completionRateFromStatuses,
  computeCompletionRate,
  refreshInfluencerTrustMetrics,
} from "../lib/influencerMetrics.ts";

test("resolveCompletionRate returns null for null/undefined/invalid", () => {
  assert.equal(resolveCompletionRate(null), null);
  assert.equal(resolveCompletionRate(undefined), null);
  assert.equal(resolveCompletionRate(""), null);
  assert.equal(resolveCompletionRate("nope"), null);
  assert.equal(resolveCompletionRate(-1), null);
});

test("resolveCompletionRate returns null when proposalCount is 0", () => {
  assert.equal(resolveCompletionRate(100, { proposalCount: 0 }), null);
  assert.equal(resolveCompletionRate(80, { proposalCount: 2 }), 80);
});

test("resolveCompletionRate ignores fake 100 when no reviews and no completed campaigns", () => {
  assert.equal(
    resolveCompletionRate(100, { totalReviews: 0, completedCampaigns: 0 }),
    null
  );
  assert.equal(
    resolveCompletionRate(100, { totalReviews: 1, completedCampaigns: 0 }),
    100
  );
  assert.equal(
    resolveCompletionRate(100, { totalReviews: 0, completedCampaigns: 2 }),
    100
  );
});

test("formatCompletionRateDisplay shows dash + subtitle when missing", () => {
  const el = formatCompletionRateDisplay(null, "el");
  assert.equal(el.primary, "—");
  assert.equal(el.subtitle, COMPLETION_NONE_SUBTITLE.el);
  const en = formatCompletionRateDisplay(undefined, "en");
  assert.equal(en.primary, "—");
  assert.equal(en.subtitle, COMPLETION_NONE_SUBTITLE.en);
  const ok = formatCompletionRateDisplay(75, "en");
  assert.equal(ok.primary, "75%");
  assert.equal(ok.subtitle, null);
});

test("computeCollabScore ignores completion_rate 100 with zero reviews and zero campaigns", () => {
  const bare: TopScoreInfluencer = {
    id: "1",
    completion_rate: 100,
    total_reviews: 0,
    avg_rating: 0,
  };
  const withReviews: TopScoreInfluencer = {
    id: "2",
    completion_rate: 100,
    total_reviews: 3,
    avg_rating: 5,
  };
  assert.equal(computeCollabScore(bare, 0), computeReviewScore(bare));
  assert.ok(computeCollabScore(withReviews, 0) > computeReviewScore(withReviews));
});

test("buildChannelScore does not boost coop from fake completion 100 with 0 reviews", () => {
  const base = {
    followersTotal: 10000,
    contentCount: 0,
    platformCount: 1,
    reviewCount: 0,
  };
  const without = buildChannelScore({ ...base, completionRate: null });
  const fake100 = buildChannelScore({ ...base, completionRate: 100 });
  assert.equal(fake100.coopPotential, without.coopPotential);

  const real = buildChannelScore({ ...base, reviewCount: 2, completionRate: 100 });
  assert.ok(real.coopPotential > without.coopPotential);
});

test("completionRateFromStatuses: no terminal outcomes → null", () => {
  assert.equal(completionRateFromStatuses([]), null);
  assert.equal(completionRateFromStatuses(["pending", "accepted"]), null);
  assert.equal(completionRateFromStatuses(["accepted"]), null);
});

test("completionRateFromStatuses: 1 completed + 1 rejected → 50", () => {
  assert.equal(completionRateFromStatuses(["completed", "rejected"]), 50);
  assert.equal(completionRateFromStatuses(["COMPLETED", "Rejected", "pending", "accepted"]), 50);
});

test("completionRateFromStatuses: completed only among terminals → 100", () => {
  assert.equal(completionRateFromStatuses(["completed", "pending"]), 100);
  assert.equal(completionRateFromStatuses(["completed", "cancelled"]), 50);
  assert.equal(completionRateFromStatuses(["completed", "declined", "canceled"]), 33);
});

test("computeCompletionRate returns null when influencer has no proposals", async () => {
  const supabase = {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return Promise.resolve({ data: [], error: null });
        },
      };
    },
  };
  const rate = await computeCompletionRate(supabase as never, "inf-1");
  assert.equal(rate, null);
});

test("computeCompletionRate: accepted-only proposals → null; completed+rejected → 50", async () => {
  const makeSb = (rows: Array<{ status: string }>) => ({
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return Promise.resolve({ data: rows, error: null });
        },
      };
    },
  });
  assert.equal(
    await computeCompletionRate(makeSb([{ status: "accepted" }, { status: "pending" }]) as never, "inf-1"),
    null
  );
  assert.equal(
    await computeCompletionRate(
      makeSb([{ status: "completed" }, { status: "rejected" }, { status: "accepted" }]) as never,
      "inf-1"
    ),
    50
  );
});

test("refreshInfluencerTrustMetrics writes completion_rate null explicitly", async () => {
  const updates: Array<{ patch: Record<string, unknown>; id: string }> = [];
  const supabase = {
    from(table: string) {
      if (table === "conversations") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          limit() {
            return Promise.resolve({ data: [], error: null });
          },
        };
      }
      if (table === "proposals") {
        return {
          select() {
            return this;
          },
          eq() {
            return Promise.resolve({ data: [], error: null });
          },
        };
      }
      if (table === "influencers") {
        return {
          update(patch: Record<string, unknown>) {
            return {
              eq(col: string, id: string) {
                updates.push({ patch, id });
                return Promise.resolve({ data: null, error: null });
              },
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  const result = await refreshInfluencerTrustMetrics(supabase as never, "inf-42");
  assert.equal(result.completion_rate, null);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].id, "inf-42");
  assert.equal(updates[0].patch.completion_rate, null);
});
