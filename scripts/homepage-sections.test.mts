/**
 * Contract: every homepage body section rendered by HomePage must declare
 * data-homepage-section="<id>" where <id> is in HOMEPAGE_SECTION_REGISTRY
 * (lib/homepageSections.ts). Admin settings reorder UI reads the same registry.
 * Documented in AGENTS.md and the comment above HOMEPAGE_SECTION_REGISTRY.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import {
  HOMEPAGE_SECTION_REGISTRY,
  defaultHomepageSectionOrder,
  mergeHomepageSectionOrder,
  parseHomepageSectionOrderSetting,
  serializeHomepageSectionOrderSetting,
  type HomepageSectionId,
} from "../lib/homepageSections.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const HOME_PAGE = path.join(ROOT, "components", "HomePage.tsx");
const REGISTRY = path.join(ROOT, "lib", "homepageSections.ts");

test("default order places brand_cta before newly_approved", () => {
  const order = defaultHomepageSectionOrder();
  const brand = order.indexOf("brand_cta");
  const newly = order.indexOf("newly_approved");
  assert.ok(brand >= 0 && newly >= 0);
  assert.ok(brand < newly, "Έχετε Επιχείρηση; must precede Νεοί Εγκεκριμένοι Creators");
});

test("merge drops unknown ids and inserts missing at default position", () => {
  const merged = mergeHomepageSectionOrder([
    "directory",
    "ghost_section",
    "brand_cta",
    "directory",
  ]);
  assert.equal(merged.includes("ghost_section" as HomepageSectionId), false);
  assert.ok(merged.includes("hero"));
  assert.ok(merged.includes("newly_approved"));
  assert.equal(merged.filter((id) => id === "directory").length, 1);
  // brand_cta stays before newly_approved when both present from defaults insert
  assert.ok(merged.indexOf("brand_cta") < merged.indexOf("newly_approved"));
});

test("parse accepts bare array or { order, hidden }", () => {
  const bare = parseHomepageSectionOrderSetting(["hero", "directory"]);
  assert.ok(bare.order.includes("hero"));
  assert.deepEqual(bare.hidden, []);

  const obj = parseHomepageSectionOrderSetting({
    order: ["hero", "directory"],
    hidden: ["directory", "nope"],
  });
  assert.deepEqual(obj.hidden, ["directory"]);
});

test("serialize uses bare array when nothing is hidden", () => {
  const order = defaultHomepageSectionOrder();
  assert.deepEqual(serializeHomepageSectionOrderSetting(order, []), order);
  const withHidden = serializeHomepageSectionOrderSetting(order, ["brand_logos"]);
  assert.ok(withHidden && typeof withHidden === "object" && !Array.isArray(withHidden));
  assert.deepEqual((withHidden as { hidden: string[] }).hidden, ["brand_logos"]);
});

test("every data-homepage-section in HomePage is in the registry", () => {
  const src = fs.readFileSync(HOME_PAGE, "utf8");
  const rendered = new Set(
    [...src.matchAll(/data-homepage-section="([a-z0-9_]+)"/g)].map((m) => m[1])
  );
  const registryIds = new Set(HOMEPAGE_SECTION_REGISTRY.map((s) => s.id));

  assert.ok(rendered.size > 0, "HomePage must render data-homepage-section attributes");

  for (const id of rendered) {
    assert.ok(
      registryIds.has(id as HomepageSectionId),
      `HomePage renders data-homepage-section="${id}" but it is missing from HOMEPAGE_SECTION_REGISTRY`
    );
  }

  for (const def of HOMEPAGE_SECTION_REGISTRY) {
    if (def.optional) continue;
    assert.ok(
      rendered.has(def.id),
      `Registry section "${def.id}" has no data-homepage-section in HomePage.tsx`
    );
  }
});

test("HomePage maps over sectionOrder (single registry-driven render path)", () => {
  const src = fs.readFileSync(HOME_PAGE, "utf8");
  assert.match(src, /sectionOrder/);
  assert.match(src, /from "@\/lib\/homepageSections"/);
  assert.match(src, /home-page-root/);
});

test("registry documents the shared contract in a code comment", () => {
  const src = fs.readFileSync(REGISTRY, "utf8");
  assert.match(src, /Central registry of homepage sections/);
  assert.match(src, /homepage_section_order/);
  assert.match(src, /data-homepage-section/);
});
