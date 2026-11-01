import assert from "node:assert/strict";
import test from "node:test";
import {
  budgetFloorMessage,
  collaborationFloor,
  collaborationMinimum,
  formatProposalExtrasLine,
} from "../lib/proposalFloor.ts";

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
    minRate: "1000",
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
    minRate: "80",
  });
  assert.deepEqual(floor, { ok: false, reason: "unknown_package" });
});

test("a campaign invite stays unlimited even when the creator has a minimum charge", () => {
  assert.equal(
    collaborationFloor({
      packages,
      rateCard,
      serviceType: "Campaign: Summer",
      extraKeys: [],
      minRate: "80",
    }),
    null
  );
});

test("without a package the floor is the creator minimum charge", () => {
  const floor = collaborationFloor({
    packages,
    rateCard,
    serviceType: "Custom package",
    extraKeys: [],
    minRate: "80",
  });
  assert.deepEqual(floor, {
    ok: true,
    floor: 80,
    packagePrice: 0,
    extraTotal: 0,
    extras: [],
  });
  assert.equal(
    collaborationMinimum({ hasPackage: false, minRate: "80 €" }),
    80
  );
  assert.equal(budgetFloorMessage(80, "el"), "Το budget δεν μπορεί να είναι μικρότερο από 80 €.");
  assert.equal(budgetFloorMessage(80, "en"), "Budget cannot be lower than 80 €.");
});

test("checked extras sit on top of the minimum charge when no package is selected", () => {
  const floor = collaborationFloor({
    packages,
    rateCard,
    serviceType: "Προσαρμοσμένο πακέτο",
    extraKeys: ["usage_rights_ads"],
    minRate: "80",
  });
  assert.ok(floor && floor.ok);
  assert.equal(floor && floor.ok && floor.floor, 95);
});

test("a negotiate label still floors at the selected package price", () => {
  const floor = collaborationFloor({
    packages,
    rateCard,
    serviceType: "2 × 1 Instagram Reel",
    minRate: "10",
  });
  assert.ok(floor && floor.ok);
  assert.equal(floor && floor.ok && floor.floor, 50);
  assert.equal(
    collaborationMinimum({ hasPackage: true, packagePrice: "50", extraTotal: 15, minRate: "10" }),
    65
  );
});
