import assert from "node:assert/strict";
import test from "node:test";
import {
  SITE_SETTING_DEFAULTS,
  SITE_SETTING_KEYS,
  SITE_SETTING_META,
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
  assert.equal(SITE_SETTING_DEFAULTS.campaign_detail_image_max_height_px, 420);
  assert.equal(SITE_SETTING_DEFAULTS.profile_page_max_width_px, 1440);
  assert.equal(SITE_SETTING_DEFAULTS.zoho_campaigns_announcements, 0);
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
  assert.equal(coerceSiteSetting("campaign_detail_image_max_height_px", 500), 500);
  assert.equal(coerceSiteSetting("campaign_detail_image_max_height_px", 239), 420);
  assert.equal(coerceSiteSetting("campaign_detail_image_max_height_px", 801), 420);
  assert.equal(coerceSiteSetting("profile_page_max_width_px", 1500), 1500);
  assert.equal(coerceSiteSetting("profile_page_max_width_px", 1151), 1440);
  assert.equal(coerceSiteSetting("profile_page_max_width_px", 1601), 1440);
  assert.equal(coerceSiteSetting("zoho_campaigns_announcements", 1), 1);
  assert.equal(coerceSiteSetting("zoho_campaigns_announcements", 9), 0);
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
  assert.equal(pub.campaign_detail_image_max_height_px, 420);
  assert.equal(pub.profile_page_max_width_px, 1440);
  assert.equal(pub.admin_notice_read_retention_days, undefined);
  assert.equal(pub.zoho_campaigns_announcements, undefined);
});

test("css vars encode wide grid counts", () => {
  const css = siteSettingsCssVars(SITE_SETTING_DEFAULTS);
  assert.match(css, /--creator-cols-wide:5/);
  assert.match(css, /--campaign-cols-wide:4/);
  assert.match(css, /--blog-cols-wide:4/);
  assert.match(css, /--campaign-detail-cover-max-h:420px/);
  assert.match(css, /--profile-page-max-w:1440px/);
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

test("every setting has el/en description and labeled options", () => {
  for (const key of SITE_SETTING_KEYS) {
    const meta = SITE_SETTING_META[key];
    assert.ok(meta.description.el.trim().length > 0, `${key} missing el description`);
    assert.ok(meta.description.en.trim().length > 0, `${key} missing en description`);
    if (meta.options) {
      for (const opt of meta.options) {
        assert.match(String(opt.label.el), new RegExp(`^${opt.value}\\s*=`));
        assert.match(String(opt.label.en), new RegExp(`^${opt.value}\\s*=`));
      }
    }
  }
});
