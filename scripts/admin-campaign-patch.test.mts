import assert from "node:assert/strict";
import test from "node:test";
import { parseAdminCampaignPatch } from "../lib/adminCampaignPatch.ts";
import { formatEuro, formatEuroAmount } from "../lib/formatEuro.ts";

const ID = "11111111-1111-4111-8111-111111111111";

function body(extra: Record<string, unknown> = {}) {
  return {
    campaignId: ID,
    title: "Summer launch",
    description: "A short brief",
    budget: 50,
    category: "Lifestyle",
    deliverables: "1 reel",
    status: "draft",
    deadline: "2026-12-01",
    starts_on: "2026-11-01",
    location: "Athens",
    min_followers: "1000",
    platforms: ["instagram", "tiktok"],
    compensation_type: "money",
    cover_url: "https://example.com/cover.jpg",
    ...extra,
  };
}

test("formatEuro keeps the euro sign on the right with a space", () => {
  assert.equal(formatEuro(50, "el"), "50 €");
  assert.equal(formatEuro(50, "en"), "50 €");
  assert.equal(formatEuroAmount("1.500", "el"), "1.500 €");
  assert.equal(formatEuroAmount("12,50", "en"), "12.5 €");
  assert.equal(formatEuroAmount("50 €", "el"), "50 €");
});

test("parseAdminCampaignPatch accepts existing campaign fields", () => {
  const result = parseAdminCampaignPatch(body());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.campaignId, ID);
  assert.equal(result.patch.title, "Summer launch");
  assert.equal(result.patch.budget, 50);
  assert.equal(result.patch.deadline, "2026-12-01T12:00:00.000Z");
  assert.equal(result.patch.starts_on, "2026-11-01");
  assert.deepEqual(result.patch.platforms, ["instagram", "tiktok"]);
  assert.equal(result.patch.min_followers, 1000);
  assert.equal("min_rate" in result.patch, false);
  assert.equal("brand_id" in result.patch, false);
});

test("parseAdminCampaignPatch ignores min_rate and brand_id", () => {
  const result = parseAdminCampaignPatch(
    body({ min_rate: "999", brand_id: "22222222-2222-4222-8222-222222222222" })
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(JSON.stringify(result.patch).includes("min_rate"), false);
  assert.equal(JSON.stringify(result.patch).includes("22222222"), false);
});

test("parseAdminCampaignPatch requires a budget for paid work", () => {
  const result = parseAdminCampaignPatch(body({ budget: 0, compensation_type: "money" }));
  assert.deepEqual(result, { ok: false, error: "budget_required" });
});

test("parseAdminCampaignPatch allows a zero budget for product-only work", () => {
  const result = parseAdminCampaignPatch(body({ budget: "0", compensation_type: "product" }));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.patch.budget, 0);
});

test("parseAdminCampaignPatch rejects a deadline on or before the start", () => {
  const result = parseAdminCampaignPatch(body({ starts_on: "2026-12-01", deadline: "2026-12-01" }));
  assert.deepEqual(result, { ok: false, error: "deadline_after_start" });
});

test("parseAdminCampaignPatch rejects a non-https cover", () => {
  const result = parseAdminCampaignPatch(body({ cover_url: "http://example.com/a.jpg" }));
  assert.deepEqual(result, { ok: false, error: "invalid_cover_url" });
});

test("parseAdminCampaignPatch requires a title", () => {
  const result = parseAdminCampaignPatch(body({ title: "  " }));
  assert.deepEqual(result, { ok: false, error: "title_required" });
});
