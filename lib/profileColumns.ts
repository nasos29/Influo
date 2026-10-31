/**
 * Columns anon/authenticated may SELECT after
 * docs/influencer-private/02_revoke_browser_private_columns.sql.
 * Table-level SELECT is revoked. A browser .select() that names any other
 * column (including hidden_videos) fails the whole request with
 * "permission denied for table influencers", including UPDATE ... RETURNING.
 */

export const INFLUENCER_BROWSER_COLUMNS = [
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
  // Nested top_posts / channel_id / channel_handle (Auditpr) travel inside accounts JSON — no extra column.
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

/**
 * Owner-only columns. The browser must not SELECT these.
 * /api/me/profile reads them with the service role and returns them to the owner.
 * hidden_videos has no column SELECT grant, same as the private price columns.
 */
export const INFLUENCER_OWNER_COLUMNS = [
  "contact_email",
  "birth_date",
  "min_rate",
  "rate_card",
  "service_packages",
  "insights_urls",
  "hidden_videos",
] as const;

export const BRAND_BROWSER_COLUMNS = [
  "id",
  "brand_name",
  "contact_person",
  "website",
  "industry",
  "logo_url",
  "verified",
  "created_at",
  "bio",
  "city",
  "instagram",
] as const;

/** Owner-only. afm is not in brand_private; the server reads it for this account. */
export const BRAND_OWNER_COLUMNS = ["contact_email", "afm"] as const;
