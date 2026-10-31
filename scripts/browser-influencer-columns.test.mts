// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/browser-influencer-columns.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import { INFLUENCER_BROWSER_COLUMNS, INFLUENCER_OWNER_COLUMNS } from "../lib/profileColumns.ts";

/** Must match docs/influencer-private/02_revoke_browser_private_columns.sql public_cols. */
const GRANTED_SELECT = [
  "id",
  "created_at",
  "display_name",
  "gender",
  "bio",
  "category",
  "location",
  "languages",
  "engagement_rate",
  "avg_likes",
  "audience_male_percent",
  "audience_female_percent",
  "audience_top_age",
  "accounts",
  "avatar_url",
  "verified",
  "videos",
  "avg_rating",
  "total_reviews",
  "avg_response_time",
  "completion_rate",
  "availability_status",
  "skills",
  "certifications",
  "approved",
  "analytics_verified",
  "approved_at",
  "analytics_verified_at",
  "video_thumbnails",
  "bio_en",
  "last_social_refresh_at",
  "auditpr_audit",
  "brands_notified_at",
  "profile_slug",
] as const;

const NOT_GRANTED = [
  "contact_email",
  "min_rate",
  "insights_urls",
  "service_packages",
  "approval_notes",
  "analytics_verification_notes",
  "auth_user_id",
  "birth_date",
  "rate_card",
  "hidden_videos",
] as const;

test("browser influencer selects stay inside the column SELECT grant", () => {
  assert.equal(GRANTED_SELECT.length, 34);
  assert.deepEqual([...INFLUENCER_BROWSER_COLUMNS], [...GRANTED_SELECT]);
  for (const column of NOT_GRANTED) {
    assert.equal(
      (INFLUENCER_BROWSER_COLUMNS as readonly string[]).includes(column),
      false,
      column
    );
  }
  assert.equal(INFLUENCER_OWNER_COLUMNS.includes("hidden_videos"), true);
  assert.equal(INFLUENCER_OWNER_COLUMNS.includes("rate_card"), true);
  assert.equal(INFLUENCER_OWNER_COLUMNS.includes("min_rate"), true);
  assert.equal(INFLUENCER_OWNER_COLUMNS.includes("service_packages"), true);
});
