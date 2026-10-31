// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/min-rate.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveMinRate,
  isPositivePriceInput,
  packagesForSave,
  type ServicePackage,
} from "../lib/servicePackages.ts";

test("deriveMinRate uses the smallest positive package or rate-card price", () => {
  assert.equal(
    deriveMinRate(
      [
        { id: "a", platform: "instagram", type: "reel", quantity: 1, price: "200" },
        { id: "b", platform: "instagram", type: "story", quantity: 1, price: "80" },
        { id: "c", platform: "instagram", type: "post", quantity: 1, price: "0" },
        { id: "d", platform: "instagram", type: "post", quantity: 1, price: "" },
      ],
      { reel: "0", youtube: "" }
    ),
    "80"
  );
  assert.equal(deriveMinRate([], { story: "150", reel: "0", post: "ask" }), "150");
  assert.equal(deriveMinRate([], { reel: "0", story: "", post: "ρώτησε" }), null);
  assert.equal(deriveMinRate([{ id: "a", platform: "instagram", type: "reel", quantity: 1, price: "-5" }], null), null);
});

test("package prices must be empty or greater than 0", () => {
  assert.equal(isPositivePriceInput(""), true);
  assert.equal(isPositivePriceInput("150"), true);
  assert.equal(isPositivePriceInput("0.5"), true);
  assert.equal(isPositivePriceInput("0"), false);
  assert.equal(isPositivePriceInput("-3"), false);
  assert.equal(isPositivePriceInput("abc"), false);

  const saved = packagesForSave([
    { id: "a", platform: "instagram", type: "reel", quantity: 1, price: "0" },
    { id: "b", platform: "instagram", type: "story", quantity: 1, price: "40" },
  ] as ServicePackage[]);
  assert.deepEqual(saved.map((p) => p.price), ["40"]);
});
