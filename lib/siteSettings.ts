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
  help: { el: string; en: string };
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
    help: {
      el: "Πόσες κάρτες creators εμφανίζονται σε μία σειρά σε μεγάλες οθόνες.",
      en: "How many creator cards appear in one row on large screens.",
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
    help: {
      el: "Πόσες κάρτες καμπανιών εμφανίζονται σε μία σειρά σε μεγάλες οθόνες.",
      en: "How many campaign cards appear in one row on large screens.",
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
    help: {
      el: "Όταν το brand δεν ορίζει προθεσμία, η καμπάνια κλείνει αυτόματα μετά από τόσες ημέρες.",
      en: "When a brand sets no deadline, the campaign auto-closes after this many days.",
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
    help: {
      el: "Πόσες ημέρες πριν το αυτόματο κλείσιμο παίρνει υπενθύμιση το brand.",
      en: "How many days before auto-close the brand gets a reminder.",
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
    help: {
      el: "Διαβασμένες ειδοποιήσεις admin διαγράφονται αυτόματα μετά από τόσες ημέρες.",
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
    help: {
      el: "Πόσοι creators εμφανίζονται στο τμήμα καταλόγου της αρχικής (ιδανικά 2× σειρές wide).",
      en: "How many creators appear in the homepage directory preview (ideally 2× wide rows).",
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
    help: {
      el: "Πόσες ανοιχτές καμπάνιες εμφανίζονται στην αρχική.",
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
    help: {
      el: "Πόσοι νεοεγκεκριμένοι creators εμφανίζονται στο carousel.",
      en: "How many newly approved creators appear in the carousel.",
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
    help: {
      el: "Πόσοι creators εμφανίζονται στο Top influencers carousel.",
      en: "How many creators appear in the Top influencers carousel.",
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
    help: {
      el: "Το badge New εμφανίζεται όταν ο λογαριασμός είναι νεότερος από τόσες ημέρες.",
      en: "The New badge shows when the account is younger than this many days.",
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
    help: {
      el: "Πόσα άρθρα εμφανίζονται σε μία σειρά στο blog σε μεγάλες οθόνες.",
      en: "How many blog posts appear in one row on large screens.",
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
    help: {
      el: "Επιλέξτε εμφάνιση φίλτρων: οριζόντια chips, πλευρική στήλη, ή συμπαγής μπάρα dropdown.",
      en: "Choose filter layout: horizontal chips, sidebar, or compact dropdown bar.",
    },
    public: true,
    options: [
      {
        value: 1,
        label: {
          el: "Οριζόντια chips / pill bar (προεπιλογή)",
          en: "Horizontal chips / pill bar (default)",
        },
      },
      {
        value: 2,
        label: {
          el: "Πλευρική στήλη (sidebar)",
          en: "Sidebar",
        },
      },
      {
        value: 3,
        label: {
          el: "Συμπαγής μπάρα dropdown",
          en: "Compact dropdown bar",
        },
      },
    ],
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
  ].join(";");
}
