import assert from "node:assert/strict";
import test from "node:test";
import {
  SITE_SETTING_DEFAULTS,
  campaignCardStyleFromSetting,
  coerceSiteSetting,
  filterUiVariantFromSetting,
  mergeSiteSettings,
  publicSiteSettings,
  siteSettingsCssVars,
} from "../lib/siteSettings.ts";

test("defaults match current product behavior", () => {
  assert.equal(SITE_SETTING_DEFAULTS.creator_cards_per_row_wide, 5);
  assert.equal(SITE_SETTING_DEFAULTS.campaign_cards_per_row_wide, 4);
  assert.equal(SITE_SETTING_DEFAULTS.campaign_default_days, 15);
  assert.equal(SITE_SETTING_DEFAULTS.admin_notice_read_retention_days, 5);
  assert.equal(SITE_SETTING_DEFAULTS.homepage_creators_count, 10);
  assert.equal(SITE_SETTING_DEFAULTS.homepage_campaigns_count, 3);
  assert.equal(SITE_SETTING_DEFAULTS.homepage_newly_approved_count, 8);
  assert.equal(SITE_SETTING_DEFAULTS.homepage_top_influencers_count, 10);
  assert.equal(SITE_SETTING_DEFAULTS.new_badge_max_days, 14);
  assert.equal(SITE_SETTING_DEFAULTS.campaign_reminder_days_before, 3);
  assert.equal(SITE_SETTING_DEFAULTS.blog_posts_per_row_wide, 4);
  assert.equal(SITE_SETTING_DEFAULTS.filter_ui_variant, 1);
  assert.equal(SITE_SETTING_DEFAULTS.campaign_card_style, 1);
});

test("coerce clamps invalid values to defaults", () => {
  assert.equal(coerceSiteSetting("creator_cards_per_row_wide", 5), 5);
  assert.equal(coerceSiteSetting("creator_cards_per_row_wide", 2), 5);
  assert.equal(coerceSiteSetting("creator_cards_per_row_wide", 99), 5);
  assert.equal(coerceSiteSetting("campaign_cards_per_row_wide", "4"), 4);
  assert.equal(coerceSiteSetting("campaign_default_days", "nope"), 15);
  assert.equal(coerceSiteSetting("homepage_creators_count", 21), 10);
  assert.equal(coerceSiteSetting("blog_posts_per_row_wide", 4), 4);
  assert.equal(coerceSiteSetting("filter_ui_variant", 3), 3);
  assert.equal(coerceSiteSetting("filter_ui_variant", 9), 1);
  assert.equal(coerceSiteSetting("campaign_card_style", 2), 2);
  assert.equal(coerceSiteSetting("campaign_card_style", 9), 1);
});

test("merge overlays stored rows onto defaults", () => {
  const merged = mergeSiteSettings([
    { key: "creator_cards_per_row_wide", value: 6 },
    { key: "unknown_key", value: 1 },
  ]);
  assert.equal(merged.creator_cards_per_row_wide, 6);
  assert.equal(merged.campaign_cards_per_row_wide, 4);
  assert.equal(merged.homepage_creators_count, 10);
  assert.equal(merged.filter_ui_variant, 1);
  assert.equal(merged.campaign_card_style, 1);
});

test("public settings omit admin-only retention key", () => {
  const pub = publicSiteSettings(SITE_SETTING_DEFAULTS);
  assert.equal(pub.creator_cards_per_row_wide, 5);
  assert.equal(pub.filter_ui_variant, 1);
  assert.equal(pub.blog_posts_per_row_wide, 4);
  assert.equal(pub.campaign_card_style, 1);
  assert.equal(pub.admin_notice_read_retention_days, undefined);
});

test("css vars encode wide grid counts", () => {
  const css = siteSettingsCssVars(SITE_SETTING_DEFAULTS);
  assert.match(css, /--creator-cols-wide:5/);
  assert.match(css, /--campaign-cols-wide:4/);
  assert.match(css, /--blog-cols-wide:4/);
});

test("filter ui variant mapping", () => {
  assert.equal(filterUiVariantFromSetting(1), "chips");
  assert.equal(filterUiVariantFromSetting(2), "sidebar");
  assert.equal(filterUiVariantFromSetting(3), "dropdown");
  assert.equal(filterUiVariantFromSetting(0), "chips");
});

test("campaign card style mapping", () => {
  assert.equal(campaignCardStyleFromSetting(1), "premium");
  assert.equal(campaignCardStyleFromSetting(2), "classic");
  assert.equal(campaignCardStyleFromSetting(0), "premium");
});
