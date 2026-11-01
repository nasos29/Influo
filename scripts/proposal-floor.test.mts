import assert from "node:assert/strict";
import test from "node:test";
import { collaborationFloor, formatProposalExtrasLine } from "../lib/proposalFloor.ts";

const packages = [
  { id: "pkg-reel", platform: "instagram", type: "reel", quantity: 1, price: "50" },
  { id: "pkg-story", platform: "instagram", type: "story", quantity: 1, price: "20" },
];
const rateCard = { usage_rights_ads: "15", raw_footage: "30" };

test("package plus extras is the minimum, and a higher budget is allowed", () => {
  const floor = collaborationFloor({
    packages,
    rateCard,
    serviceType: "Reel",
    packageId: "pkg-reel",
    extraKeys: ["usage_rights_ads"],
  });
  assert.deepEqual(floor, {
    ok: true,
    floor: 65,
    packagePrice: 50,
    extraTotal: 15,
    extras: [{ key: "usage_rights_ads", price: 15 }],
  });
});

test("empty extras render nothing, priced ones use the creator label", () => {
  assert.equal(formatProposalExtrasLine([], "el"), null);
  assert.equal(formatProposalExtrasLine(null, "en"), null);
  assert.equal(
    formatProposalExtrasLine([{ key: "rush_delivery", price: 20 }], "el"),
    "Extras: Γρήγορη παράδοση (20 €)"
  );
  assert.equal(
    formatProposalExtrasLine([{ key: "rush_delivery", price: 20 }], "en"),
    "Extras: Fast delivery (20 €)"
  );
});

test("a campaign invite without a package or extras has no floor", () => {
  assert.equal(
    collaborationFloor({
      packages,
      rateCard,
      serviceType: "Καμπάνια: Summer",
      extraKeys: [],
    }),
    null
  );
});

test("an unknown extra is rejected", () => {
  const floor = collaborationFloor({
    packages,
    rateCard,
    serviceType: "Reel",
    packageId: "pkg-reel",
    extraKeys: ["not-an-extra"],
  });
  assert.deepEqual(floor, { ok: false, reason: "unknown_extra" });
});

test("a missing package id is rejected", () => {
  const floor = collaborationFloor({
    packages,
    rateCard,
    serviceType: "Reel",
    packageId: "missing",
    extraKeys: [],
  });
  assert.deepEqual(floor, { ok: false, reason: "unknown_package" });
});
