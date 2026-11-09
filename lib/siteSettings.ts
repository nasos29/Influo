/**
 * Tunable site settings (safe defaults = current product behavior).
 * No secrets, pricing, or auth. Values are integers with min/max validation.
 */

export const SITE_SETTING_KEYS = [
  "creator_cards_per_row_wide",
  "campaign_cards_per_row_wide",
  "campaign_default_days",
  "campaign_reminder_days_before",
  "admin_notice_read_retention_days",
  "homepage_creators_count",
  "homepage_campaigns_count",
  "homepage_newly_approved_count",
  "homepage_top_influencers_count",
  "new_badge_max_days",
  "blog_posts_per_row_wide",
  "filter_ui_variant",
  "campaign_card_style",
  "campaign_detail_image_max_height_px",
  "profile_page_max_width_px",
] as const;

export type SiteSettingKey = (typeof SITE_SETTING_KEYS)[number];

export type SiteSettings = Record<SiteSettingKey, number>;

export type FilterUiVariant = "chips" | "sidebar" | "dropdown";

export const FILTER_UI_VARIANTS: FilterUiVariant[] = ["chips", "sidebar", "dropdown"];

/** Map stored integer → filter UI variant. Default = chips (horizontal bar). */
export function filterUiVariantFromSetting(value: number): FilterUiVariant {
  if (value === 2) return "sidebar";
  if (value === 3) return "dropdown";
  return "chips";
}

export type CampaignCardStyle = "premium" | "classic";

/** Map stored integer → campaign list card style. Default = premium. */
export function campaignCardStyleFromSetting(value: number): CampaignCardStyle {
  if (value === 2) return "classic";
  return "premium";
}

export type SiteSettingOption = {
  value: number;
  label: { el: string; en: string };
};

export type SiteSettingMeta = {
  key: SiteSettingKey;
  default: number;
  min: number;
  max: number;
  label: { el: string; en: string };
  /**
   * Short plain-language description (el/en) shown on every admin settings tile.
   * Explain what the setting does and where it appears. Required for every setting.
   */
  description: { el: string; en: string };
  /** Safe for public CSS / client display. */
  public: boolean;
  /** When set, admin UI shows a select instead of a number input. */
  options?: SiteSettingOption[];
};

export const SITE_SETTING_META: Record<SiteSettingKey, SiteSettingMeta> = {
  creator_cards_per_row_wide: {
    key: "creator_cards_per_row_wide",
    default: 5,
    min: 3,
    max: 6,
    label: {
      el: "Κάρτες creators ανά σειρά (≥1536px)",
      en: "Creator cards per row (≥1536px)",
    },
    description: {
      el: "Πόσες κάρτες influencers δείχνει σε κάθε σειρά σε μεγάλες οθόνες (≥1536px).",
      en: "How many influencer cards per row on large screens (≥1536px).",
    },
    public: true,
  },
  campaign_cards_per_row_wide: {
    key: "campaign_cards_per_row_wide",
    default: 4,
    min: 2,
    max: 5,
    label: {
      el: "Κάρτες καμπανιών ανά σειρά (≥1536px)",
      en: "Campaign cards per row (≥1536px)",
    },
    description: {
      el: "Πόσες κάρτες καμπανιών ανά σειρά στις λίστες (αρχική, /campaigns) σε μεγάλες οθόνες.",
      en: "How many campaign cards per row in lists (home, /campaigns) on large screens.",
    },
    public: true,
  },
  campaign_default_days: {
    key: "campaign_default_days",
    default: 15,
    min: 7,
    max: 60,
    label: {
      el: "Προεπιλεγμένη διάρκεια καμπάνιας (ημέρες)",
      en: "Default campaign duration (days)",
    },
    description: {
      el: "Αν το brand δεν ορίσει προθεσμία, η καμπάνια κλείνει αυτόματα μετά από τόσες ημέρες.",
      en: "If a brand sets no deadline, the campaign auto-closes after this many days.",
    },
    public: true,
  },
  campaign_reminder_days_before: {
    key: "campaign_reminder_days_before",
    default: 3,
    min: 1,
    max: 14,
    label: {
      el: "Υπενθύμιση κλεισίματος καμπάνιας (ημέρες πριν)",
      en: "Campaign close reminder (days before)",
    },
    description: {
      el: "Πόσες ημέρες πριν το αυτόματο κλείσιμο παίρνει υπενθύμιση το brand.",
      en: "Days before auto-close when the brand gets a reminder.",
    },
    public: true,
  },
  admin_notice_read_retention_days: {
    key: "admin_notice_read_retention_days",
    default: 5,
    min: 1,
    max: 90,
    label: {
      el: "Διατήρηση διαβασμένων ειδοποιήσεων admin (ημέρες)",
      en: "Keep read admin notices (days)",
    },
    description: {
      el: "Διαβασμένες ειδοποιήσεις στο admin διαγράφονται αυτόματα μετά από τόσες ημέρες.",
      en: "Read admin notices are auto-deleted after this many days.",
    },
    public: false,
  },
  homepage_creators_count: {
    key: "homepage_creators_count",
    default: 10,
    min: 4,
    max: 20,
    label: {
      el: "Creators στην αρχική (Κατάλογος Influencers)",
      en: "Homepage creators (directory section)",
    },
    description: {
      el: "Πόσοι creators εμφανίζονται στο τμήμα καταλόγου της αρχικής σελίδας.",
      en: "How many creators appear in the homepage directory preview section.",
    },
    public: true,
  },
  homepage_campaigns_count: {
    key: "homepage_campaigns_count",
    default: 3,
    min: 2,
    max: 12,
    label: {
      el: "Καμπάνιες στην αρχική",
      en: "Homepage campaigns",
    },
    description: {
      el: "Πόσες ανοιχτές καμπάνιες εμφανίζονται στην αρχική σελίδα.",
      en: "How many open campaigns appear on the homepage.",
    },
    public: true,
  },
  homepage_newly_approved_count: {
    key: "homepage_newly_approved_count",
    default: 8,
    min: 4,
    max: 24,
    label: {
      el: "Νεοεγκεκριμένοι creators στην αρχική",
      en: "Newly approved creators on homepage",
    },
    description: {
      el: "Πόσοι νεοεγκεκριμένοι creators εμφανίζονται στο carousel της αρχικής.",
      en: "How many newly approved creators appear in the homepage carousel.",
    },
    public: true,
  },
  homepage_top_influencers_count: {
    key: "homepage_top_influencers_count",
    default: 10,
    min: 5,
    max: 20,
    label: {
      el: "Top influencers στην αρχική",
      en: "Top influencers on homepage",
    },
    description: {
      el: "Πόσοι creators εμφανίζονται στο Top influencers carousel της αρχικής.",
      en: "How many creators appear in the homepage Top influencers carousel.",
    },
    public: true,
  },
  new_badge_max_days: {
    key: "new_badge_max_days",
    default: 14,
    min: 7,
    max: 60,
    label: {
      el: "Badge «Νέος» (μέγιστες ημέρες λογαριασμού)",
      en: "“New” badge (max account age days)",
    },
    description: {
      el: "Το badge «Νέος» στις κάρτες creators όσο ο λογαριασμός είναι νεότερος από τόσες ημέρες.",
      en: "“New” badge on creator cards while the account is younger than this many days.",
    },
    public: true,
  },
  blog_posts_per_row_wide: {
    key: "blog_posts_per_row_wide",
    default: 4,
    min: 2,
    max: 5,
    label: {
      el: "Άρθρα blog ανά σειρά (≥1536px)",
      en: "Blog posts per row (≥1536px)",
    },
    description: {
      el: "Πόσα άρθρα ανά σειρά στη σελίδα /blog σε μεγάλες οθόνες (≥1536px).",
      en: "How many posts per row on /blog on large screens (≥1536px).",
    },
    public: true,
  },
  filter_ui_variant: {
    key: "filter_ui_variant",
    default: 1,
    min: 1,
    max: 3,
    label: {
      el: "Σχεδίαση φίλτρων καταλόγου",
      en: "Directory filter design",
    },
    description: {
      el: "Εμφάνιση φίλτρων στον κατάλογο influencers: 1 = Chips, 2 = Sidebar, 3 = Dropdown.",
      en: "Directory filter layout: 1 = Chips, 2 = Sidebar, 3 = Dropdown.",
    },
    public: true,
    options: [
      {
        value: 1,
        label: {
          el: "1 = Chips (οριζόντια)",
          en: "1 = Chips (horizontal)",
        },
      },
      {
        value: 2,
        label: {
          el: "2 = Sidebar",
          en: "2 = Sidebar",
        },
      },
      {
        value: 3,
        label: {
          el: "3 = Dropdown",
          en: "3 = Dropdown",
        },
      },
    ],
  },
  campaign_card_style: {
    key: "campaign_card_style",
    default: 1,
    min: 1,
    max: 2,
    label: {
      el: "Στυλ κάρτας καμπάνιας",
      en: "Campaign card style",
    },
    description: {
      el: "Στυλ κάρτας στις λίστες καμπανιών (αρχική, /campaigns): 1 = Premium, 2 = Classic.",
      en: "Campaign list card style (home, /campaigns): 1 = Premium, 2 = Classic.",
    },
    public: true,
    options: [
      {
        value: 1,
        label: {
          el: "1 = Premium",
          en: "1 = Premium",
        },
      },
      {
        value: 2,
        label: {
          el: "2 = Classic",
          en: "2 = Classic",
        },
      },
    ],
  },
  campaign_detail_image_max_height_px: {
    key: "campaign_detail_image_max_height_px",
    default: 420,
    min: 240,
    max: 800,
    label: {
      el: "Μέγιστο ύψος εικόνας λεπτομερειών καμπάνιας (px)",
      en: "Campaign detail image max height (px)",
    },
    description: {
      el: "Μέγ. ύψος cover στη δημόσια σελίδα καμπάνιας σε μεγάλες οθόνες· στο κινητό μένει ως έχει.",
      en: "Max cover height on the public campaign detail page on large screens; mobile unchanged.",
    },
    public: true,
  },
  profile_page_max_width_px: {
    key: "profile_page_max_width_px",
    default: 1440,
    min: 1152,
    max: 1600,
    label: {
      el: "Μέγιστο πλάτος δημόσιου προφίλ (px)",
      en: "Public profile max width (px)",
    },
    description: {
      el: "Πλάτος κύριου container στο δημόσιο προφίλ creator σε μεγάλες οθόνες (≥1440px)· κινητό/laptop ως έχει.",
      en: "Main container width on the public creator profile on large screens (≥1440px); mobile/laptop unchanged.",
    },
    public: true,
  },
};

export const SITE_SETTING_DEFAULTS: SiteSettings = Object.fromEntries(
  SITE_SETTING_KEYS.map((key) => [key, SITE_SETTING_META[key].default])
) as SiteSettings;

export function isSiteSettingKey(value: string): value is SiteSettingKey {
  return (SITE_SETTING_KEYS as readonly string[]).includes(value);
}

/** Coerce DB/json value to a validated integer within min/max, else default. */
export function coerceSiteSetting(key: SiteSettingKey, raw: unknown): number {
  const meta = SITE_SETTING_META[key];
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw)
        : raw && typeof raw === "object" && "value" in (raw as object)
          ? Number((raw as { value: unknown }).value)
          : NaN;
  if (!Number.isFinite(n)) return meta.default;
  const rounded = Math.round(n);
  if (rounded < meta.min || rounded > meta.max) return meta.default;
  return rounded;
}

export function mergeSiteSettings(
  rows: Array<{ key?: unknown; value?: unknown }> | Record<string, unknown> | null | undefined
): SiteSettings {
  const out: SiteSettings = { ...SITE_SETTING_DEFAULTS };
  if (!rows) return out;
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const key = String(row.key || "");
      if (!isSiteSettingKey(key)) continue;
      out[key] = coerceSiteSetting(key, row.value);
    }
    return out;
  }
  for (const [key, value] of Object.entries(rows)) {
    if (!isSiteSettingKey(key)) continue;
    out[key] = coerceSiteSetting(key, value);
  }
  return out;
}

export function publicSiteSettings(settings: SiteSettings): Partial<SiteSettings> {
  const out: Partial<SiteSettings> = {};
  for (const key of SITE_SETTING_KEYS) {
    if (SITE_SETTING_META[key].public) out[key] = settings[key];
  }
  return out;
}

/** CSS custom properties for wide card grids (and related public display). */
export function siteSettingsCssVars(settings: SiteSettings): string {
  return [
    `--creator-cols-wide:${settings.creator_cards_per_row_wide}`,
    `--campaign-cols-wide:${settings.campaign_cards_per_row_wide}`,
    `--blog-cols-wide:${settings.blog_posts_per_row_wide}`,
    `--campaign-detail-cover-max-h:${settings.campaign_detail_image_max_height_px}px`,
    `--profile-page-max-w:${settings.profile_page_max_width_px}px`,
  ].join(";");
}
