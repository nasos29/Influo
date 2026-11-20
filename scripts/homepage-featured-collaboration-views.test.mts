import assert from "node:assert/strict";
import test from "node:test";
import {
  computeFeaturedCollaborationViewsTotal,
  mergeFeaturedCollaborationViews,
  parseHomepageFeaturedCollaborationViewsSetting,
} from "../lib/homepageFeaturedCollaborationViews.ts";
import { DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS } from "../lib/homepageFeaturedCollaborations.ts";

const IDS = DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS.applicationIds;
const [A, B, C, D] = IDS;
const T0 = "2026-01-01T00:00:00.000Z";

test("parse rejects invalid stored shape", () => {
  assert.equal(parseHomepageFeaturedCollaborationViewsSetting(null), null);
  assert.equal(parseHomepageFeaturedCollaborationViewsSetting({}), null);
  assert.equal(parseHomepageFeaturedCollaborationViewsSetting({ updatedAt: "" }), null);
});

test("merge keeps last-good on fetch failure; success overwrites lower counts", () => {
  const previous = parseHomepageFeaturedCollaborationViewsSetting({
    updatedAt: T0,
    total: 100,
    items: [
      {
        applicationId: A,
        sourceUrl: "https://tiktok.com/a",
        views: 10,
        fetchedAt: T0,
      },
      {
        applicationId: B,
        sourceUrl: "https://instagram.com/b",
        views: 20,
        fetchedAt: T0,
      },
    ],
  });
  assert.ok(previous);

  const afterFail = mergeFeaturedCollaborationViews(IDS, previous, [
    { applicationId: A, url: "https://tiktok.com/a", views: null },
    { applicationId: B, url: "https://instagram.com/b", views: 5 },
  ]);
  assert.equal(afterFail.items.find((i) => i.applicationId === A)?.views, 10);
  assert.equal(afterFail.items.find((i) => i.applicationId === B)?.views, 5);
  assert.equal(computeFeaturedCollaborationViewsTotal(IDS, afterFail.items), null);
  assert.equal(afterFail.total, null);

  const afterAll = mergeFeaturedCollaborationViews(IDS, afterFail, [
    { applicationId: A, url: "https://tiktok.com/a", views: 8 },
    { applicationId: B, url: "https://instagram.com/b", views: 5 },
    { applicationId: C, url: "https://tiktok.com/c", views: 30 },
    { applicationId: D, url: "https://tiktok.com/d", views: 40 },
  ]);
  assert.equal(computeFeaturedCollaborationViewsTotal(IDS, afterAll.items), 8 + 5 + 30 + 40);

  const staleDropped = mergeFeaturedCollaborationViews(IDS, afterAll, [
    { applicationId: "00000000-0000-4000-8000-000000000099", url: "https://x", views: 9999 },
  ]);
  assert.equal(
    staleDropped.items.find((i) => i.applicationId === "00000000-0000-4000-8000-000000000099"),
    undefined
  );
  assert.equal(computeFeaturedCollaborationViewsTotal(IDS, staleDropped.items), 8 + 5 + 30 + 40);
});