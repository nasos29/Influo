import assert from "node:assert/strict";
import test from "node:test";
import { normalizeGender } from "../lib/gender.ts";
import { isAvailableStatus } from "../lib/trustSignals.ts";
import {
  compareDirectoryOrder,
  directoryFiltersAreSqlOnly,
  directoryFiltersNeedAccounts,
  matchesDirectoryFilters,
  type DirectoryCandidate,
  type DirectoryFilters,
} from "../lib/directoryQuery.ts";
import { DEFAULT_DIRECTORY_FILTERS } from "../lib/directoryQuery.ts";

function candidate(overrides: Partial<DirectoryCandidate> = {}): DirectoryCandidate {
  return {
    id: "1",
    name: "Άννα",
    bio: "Ταξίδια στην Αθήνα",
    categories: ["Travel"],
    gender: "Female",
    location: "Αθήνα",
    languages: ["Ελληνικά"],
    skills: [],
    socials: { instagram: "anna" },
    followers: { instagram: 12000 },
    engagement_rate: { instagram: "3.2%" },
    price_tier: "100",
    avg_rating: 4.5,
    total_reviews: 2,
    past_brands: [],
    created_at: "2026-10-01T00:00:00.000Z",
    age: 28,
    availability_status: "available",
    verified: true,
    ...overrides,
  };
}

test("created_at descending matches the new-within-30-days sort", () => {
  const now = Date.parse("2026-11-01T12:00:00.000Z");
  const rows = [
    { id: "old", created_at: "2026-08-01T00:00:00.000Z" },
    { id: "new", created_at: "2026-10-20T00:00:00.000Z" },
    { id: "missing", created_at: undefined },
    { id: "newer", created_at: "2026-10-28T00:00:00.000Z" },
  ];
  const byComparator = [...rows].sort((a, b) => compareDirectoryOrder(a, b, now));
  const byCreated = [...rows].sort((a, b) => {
    if (a.created_at && b.created_at) {
      const delta = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (delta !== 0) return delta;
    } else if (a.created_at) return -1;
    else if (b.created_at) return 1;
    return a.id < b.id ? -1 : 1;
  });
  assert.deepEqual(byComparator.map((row) => row.id), byCreated.map((row) => row.id));
  assert.deepEqual(byComparator.map((row) => row.id), ["newer", "new", "old", "missing"]);
});

test("search matches name or Greek bio and ignores a closed bio_en field", () => {
  const filters: DirectoryFilters = { ...DEFAULT_DIRECTORY_FILTERS, q: "αθήνα", availability: "all" };
  assert.equal(matchesDirectoryFilters(candidate(), filters), true);
  assert.equal(matchesDirectoryFilters(candidate({ bio: "μόνο μόδα", name: "Νίκος" }), filters), false);
  assert.equal(matchesDirectoryFilters(candidate({ name: "Αθήνα Travel" }), filters), true);
});

test("skills filter requires every selected skill", () => {
  const base = { ...DEFAULT_DIRECTORY_FILTERS, availability: "all" as const, skills: ["ugc", "video_editing"] };
  assert.equal(matchesDirectoryFilters(candidate({ skills: ["ugc", "video_editing", "vlogs"] }), base), true);
  assert.equal(matchesDirectoryFilters(candidate({ skills: ["ugc"] }), base), false);
  assert.equal(directoryFiltersAreSqlOnly(base), false);
});

test("sql-only filters are availability, gender, and rating", () => {
  assert.equal(directoryFiltersAreSqlOnly(DEFAULT_DIRECTORY_FILTERS), true);
  assert.equal(directoryFiltersAreSqlOnly({ ...DEFAULT_DIRECTORY_FILTERS, gender: "Male", rating: "4" }), true);
  assert.equal(directoryFiltersAreSqlOnly({ ...DEFAULT_DIRECTORY_FILTERS, q: "a" }), false);
  assert.equal(directoryFiltersAreSqlOnly({ ...DEFAULT_DIRECTORY_FILTERS, category: "Travel" }), false);
  assert.equal(directoryFiltersAreSqlOnly({ ...DEFAULT_DIRECTORY_FILTERS, platform: "TikTok" }), false);
  assert.equal(directoryFiltersNeedAccounts({ ...DEFAULT_DIRECTORY_FILTERS, platform: "TikTok" }), true);
  assert.equal(directoryFiltersNeedAccounts({ ...DEFAULT_DIRECTORY_FILTERS, q: "a" }), false);
});

test("gender and availability rules match the old directory normalizers", () => {
  assert.equal(normalizeGender(null), "Female");
  assert.equal(normalizeGender(""), "Female");
  assert.equal(normalizeGender("Other"), "AI");
  assert.equal(normalizeGender("Male"), "Male");
  assert.equal(isAvailableStatus(null), true);
  assert.equal(isAvailableStatus(""), true);
  assert.equal(isAvailableStatus("available"), true);
  assert.equal(isAvailableStatus("unavailable"), false);
});

test("follower and budget filters keep the previous bounds", () => {
  const base = { ...DEFAULT_DIRECTORY_FILTERS, availability: "all" as const };
  assert.equal(matchesDirectoryFilters(candidate(), { ...base, followers: "Micro" }), true);
  assert.equal(matchesDirectoryFilters(candidate(), { ...base, followers: "Nano" }), false);
  assert.equal(matchesDirectoryFilters(candidate({ followers: { instagram: 1500 } }), { ...base, followers: "Nano" }), true);
  assert.equal(matchesDirectoryFilters(candidate({ price_tier: "0" }), { ...base, budget: "50" }), true);
  assert.equal(matchesDirectoryFilters(candidate({ price_tier: "above_5000" }), { ...base, budget: "Unlimited" }), true);
  assert.equal(matchesDirectoryFilters(candidate({ price_tier: "100" }), { ...base, budget: "50" }), false);
});
