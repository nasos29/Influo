"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import InfluencerCard from "./InfluencerCard";
import { getBadges, BADGE_FILTER_TYPES, getBadgeFilterLabel, type BadgeType } from "../lib/badges";
import { getVisitorId } from "../lib/visitorId";
import { normalizeGender, type GenderValue } from "../lib/gender";
import { trustChipsFromAccounts } from "@/lib/trustSignals";
import { publicProfilePath } from "@/lib/profileSlug";
import { CATEGORIES, categoryTranslations, parseStoredCategories } from "@/lib/categories";
import { formatEuro } from "@/lib/formatEuro";
import { parseDirectoryPhrase } from "@/lib/directoryPhrase";
import {
  badgeMinRateFromTier,
  DIRECTORY_BUDGET_CAPS,
} from "@/lib/publicInfluencer";
import { resolveCompletionRate } from "@/lib/completionRate";
import { displayLocation } from "@/lib/displayLocation";
import LocationTypeahead from "@/components/LocationTypeahead";
import { SKILLS, sanitizeSkills, skillLabel } from "@/lib/skills";

const CATEGORY_KEYS = new Set<string>(CATEGORIES);
const PAGE_SIZE = 40;

function categoryFromSearchParam(raw: string | null): string {
  if (!raw) return "All";
  return CATEGORY_KEYS.has(raw) ? raw : "All";
}

function skillsFromSearchParam(raw: string | null): string[] {
  return sanitizeSkills((raw || "").split(","));
}

function languagesFromSearchParam(raw: string | null): string[] {
  const known = new Set(LANGUAGES.map((item) => item.code));
  const out: string[] = [];
  for (const part of (raw || "").split(",")) {
    const code = part.trim();
    if (!known.has(code) || out.includes(code)) continue;
    out.push(code);
  }
  return out;
}

function sameList(a: string[], b: string[]): boolean {
  return a.join(",") === b.join(",");
}

function pageFromSearchParam(raw: string | null): number {
  const n = parseInt(raw || "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export interface Influencer {
  id: string | number;
  name: string;
  bio: string;
  bio_en?: string | null;
  avatar: string;
  verified: boolean;
  socials: { [key: string]: string | undefined };
  followers: { [key: string]: number | undefined };
  categories: string[];
  platform: string;
  gender: GenderValue;
  videos?: string[];
  location?: string;
  languages?: string[];
  skills?: string[];
  avg_likes?: string | { [key: string]: string };
  engagement_rate?: string | { [key: string]: string };
  /** Ceiling tier for the budget filter. Guest copy uses `from_price`. */
  price_tier?: string | null;
  /** Exact lowest price. Guest label is «Από X €». */
  from_price?: number | null;
  past_brands?: any[] | number;
  total_reviews?: number;
  avg_rating?: number;
  created_at?: string;
  /** Whole years, computed on the server. Not a birth date. */
  age?: number | null;
  availability_status?: string | null;
  profile_slug?: string | null;
  accounts?: Array<{
    platform?: string;
    username?: string;
    followers?: string | number;
    engagement_rate?: string;
    engagement_rate_raw?: string | number | null;
    posts_count?: number | string;
    avg_likes?: string | number;
    avg_views?: string | number | null;
    is_private?: boolean;
    er_suspicious?: boolean;
    er_flag_reason?: string | null;
    engagement_hidden?: boolean;
    suspected_fake_penalty?: boolean;
    fake_follower_percent?: number | string | null;
    suspected_fake_percent?: number | string | null;
    fake_followers_percent?: number | string | null;
    quality_penalty_percent?: number | string | null;
    er_penalty_percent?: number | string | null;
    penalty_percent?: number | string | null;
  }>;
  avg_response_time?: number | null;
  completion_rate?: number | null;
}

const LANGUAGES = [
  { code: "el", el: "Ελληνικά", en: "Greek" },
  { code: "en", el: "Αγγλικά", en: "English" },
  { code: "de", el: "Γερμανικά", en: "German" },
  { code: "fr", el: "Γαλλικά", en: "French" },
  { code: "es", el: "Ισπανικά", en: "Spanish" },
  { code: "it", el: "Ιταλικά", en: "Italian" },
  { code: "pt", el: "Πορτογαλικά", en: "Portuguese" },
  { code: "ru", el: "Ρωσικά", en: "Russian" },
  { code: "zh", el: "Κινεζικά", en: "Chinese" },
  { code: "ja", el: "Ιαπωνικά", en: "Japanese" },
  { code: "sq", el: "Αλβανικά", en: "Albanian" },
  { code: "bg", el: "Βουλγαρικά", en: "Bulgarian" },
  { code: "tr", el: "Τουρκικά", en: "Turkish" },
];

const SEARCH_EXAMPLES = {
  el: [
    "UGC creator",
    "reel έως 50 €",
    "influencer για καφέ",
    "για εστιατόριο",
    "για κομμωτήριο",
    "για γυμναστήριο",
    "για κατάστημα ρούχων",
    "για ξενοδοχείο",
    "για e-shop καλλυντικών",
    "για barber shop",
    "για nail salon",
    "για ζαχαροπλαστείο",
    "fitness Θεσσαλονίκη",
    "μαρία",
  ],
  en: [
    "UGC creator",
    "reel up to 50 €",
    "influencer for a cafe",
    "for a restaurant",
    "for a hair salon",
    "for a gym",
    "for a clothing store",
    "for a hotel",
    "for a cosmetics e-shop",
    "for a barber shop",
    "for a nail salon",
    "for a pastry shop",
    "fitness Thessaloniki",
    "maria",
  ],
} as const;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return reduced;
}

function useTypewriterPlaceholder(examples: readonly string[], active: boolean): string {
  const reduced = usePrefersReducedMotion();
  const [text, setText] = useState(examples[0] ?? "");
  useEffect(() => {
    if (!active) return;
    const first = examples[0] ?? "";
    if (reduced) {
      setText(first);
      return;
    }
    let example = 0;
    let count = 0;
    let deleting = false;
    let timer = 0;
    const tick = () => {
      const current = examples[example] ?? "";
      if (!deleting) {
        count += 1;
        setText(current.slice(0, count));
        if (count >= current.length) {
          deleting = true;
          timer = window.setTimeout(tick, 1400);
          return;
        }
        timer = window.setTimeout(tick, 72);
        return;
      }
      count -= 1;
      setText(current.slice(0, Math.max(0, count)));
      if (count <= 0) {
        deleting = false;
        example = (example + 1) % examples.length;
        timer = window.setTimeout(tick, 320);
        return;
      }
      timer = window.setTimeout(tick, 36);
    };
    timer = window.setTimeout(tick, 480);
    return () => window.clearTimeout(timer);
  }, [active, examples, reduced]);
  return text;
}

const t = {
  el: {
    searchPlace: "Αναζήτηση",
    locPlace: "Τοποθεσία (π.χ. Αθήνα)",
    results: "Αποτελέσματα",
    clear: "Καθαρισμός",
    clearAll: "Καθαρισμός όλων",
    filters: "Φίλτρα",
    platAll: "Πλατφόρμα: Όλες",
    catAll: "Κατηγορία: Όλες",
    fieldGender: "Φύλο",
    fieldAvailability: "Διαθεσιμότητα",
    fieldFollowers: "Ακόλουθοι",
    fieldBudget: "Budget",
    fieldEngagement: "Engagement",
    fieldLanguage: "Γλώσσα",
    fieldSkills: "Δεξιότητες",
    skillsAll: "Όλες",
    fieldRating: "Αξιολόγηση",
    fieldBadges: "Badges",
    fieldAge: "Ηλικία",
    genAll: "Όλα",
    genFem: "Γυναίκα",
    genMal: "Άνδρας",
    genAi: "AI (Artificial Intelligence)",
    follAll: "Όλοι",
    follNano: "Nano (1k-10k)",
    follMicro: "Micro (10k-100k)",
    follMacro: "Macro (100k+)",
    budAll: "Όλα",
    budUpTo: "Έως",
    budUnlimited: "5.000 €+ (VIP)",
    engAll: "Όλα",
    engMin: "Ελάχ.",
    engGood: "Καλό",
    engHigh: "Υψηλό",
    langAll: "Όλες",
    ratingAll: "Όλες",
    ratingMin: "Ελάχ.",
    badgeAll: "Όλα",
    ageAll: "Ηλικία: Όλες",
    ageRange: "Ηλικία",
    ageFrom: "Από",
    ageTo: "Έως",
    availAll: "Όλες",
    availYes: "Διαθέσιμοι",
    availNo: "Μη διαθέσιμοι",
    noResults: "Δεν βρέθηκαν influencers",
    adjust: "Δοκίμασε διαφορετικά φίλτρα.",
    reset: "Επαναφορά",
    seeFullDirectory: "Δείτε όλο τον κατάλογο",
    pagePrev: "Προηγούμενη",
    pageNext: "Επόμενη",
    pageOf: "από",
  },
  en: {
    searchPlace: "Search",
    locPlace: "Location (e.g. Athens)",
    results: "Results",
    clear: "Clear",
    clearAll: "Clear all",
    filters: "Filters",
    platAll: "Platform: All",
    catAll: "Category: All",
    fieldGender: "Gender",
    fieldAvailability: "Availability",
    fieldFollowers: "Followers",
    fieldBudget: "Budget",
    fieldEngagement: "Engagement",
    fieldLanguage: "Language",
    fieldSkills: "Skills",
    skillsAll: "All",
    fieldRating: "Rating",
    fieldBadges: "Badges",
    fieldAge: "Age",
    genAll: "Any",
    genFem: "Female",
    genMal: "Male",
    genAi: "AI (Artificial Intelligence)",
    follAll: "Any",
    follNano: "Nano (1k-10k)",
    follMicro: "Micro (10k-100k)",
    follMacro: "Macro (100k+)",
    budAll: "Any",
    budUpTo: "Up to",
    budUnlimited: "5,000 €+ (VIP)",
    engAll: "Any",
    engMin: "Min",
    engGood: "Good",
    engHigh: "High",
    langAll: "All",
    ratingAll: "Any",
    ratingMin: "Min",
    badgeAll: "Any",
    ageAll: "Age: All",
    ageRange: "Age",
    ageFrom: "From",
    ageTo: "To",
    availAll: "Any",
    availYes: "Available",
    availNo: "Unavailable",
    noResults: "No influencers found",
    adjust: "Try adjusting your filters.",
    reset: "Reset Filters",
    seeFullDirectory: "See the full directory",
    pagePrev: "Previous",
    pageNext: "Next",
    pageOf: "of",
  },
};

const SearchIcon = () => (
  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const LocationIcon = () => (
  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const FilterIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
  </svg>
);
const ChevronDown = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
  </svg>
);

const parseFollowerString = (str: string) => {
  if (!str) return 0;
  const clean = str.toLowerCase().replace(/,/g, "").trim();
  if (clean.includes("k")) return parseFloat(clean) * 1000;
  if (clean.includes("m")) return parseFloat(clean) * 1000000;
  return parseFloat(clean) || 0;
};

const badgesForInfluencer = (inf: Influencer, lang: "el" | "en") => {
  const accountAgeDays = inf.created_at
    ? Math.floor((new Date().getTime() - new Date(inf.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 999;
  return getBadges(
    {
      verified: inf.verified,
      followers: inf.followers,
      engagement_rate: inf.engagement_rate,
      total_reviews: inf.total_reviews || 0,
      avg_rating: inf.avg_rating || 0,
      past_brands: inf.past_brands || 0,
      account_created_days: accountAgeDays,
      min_rate: badgeMinRateFromTier(inf.price_tier),
    },
    lang
  );
};

const pillSelect =
  "h-11 w-full appearance-none rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20 cursor-pointer";
const pillInput =
  "h-11 w-full rounded-full border border-slate-200 bg-white pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20";
const fieldLabel = "mb-1.5 block text-xs font-semibold text-slate-500";
const chipBtn =
  "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900/20";

function closedMultiLabel(selected: string[], labelFor: (value: string) => string, placeholder: string): string {
  if (!selected.length) return placeholder;
  const first = labelFor(selected[0]) || selected[0];
  if (selected.length === 1) return first;
  return `${first} +${selected.length - 1}`;
}

function MultiFilterDropdown({
  placeholder,
  options,
  selected,
  onChange,
  ariaLabel,
}: {
  placeholder: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  ariaLabel: string;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const labels = new Map(options.map((option) => [option.value, option.label]));

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setBox({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    };
    place();
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (value: string) => {
    const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
    onChange(options.map((option) => option.value).filter((value) => next.includes(value)));
  };

  const summary = closedMultiLabel(selected, (value) => labels.get(value) || value, placeholder);
  const panel =
    open && box && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            role="group"
            aria-label={ariaLabel}
            style={{ top: box.top, left: box.left, width: box.width }}
            className="fixed z-50 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"
          >
            {options.map((option) => {
              const checked = selected.includes(option.value);
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm text-slate-800 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(option.value)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="min-w-0">{option.label}</span>
                </label>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center rounded-full border border-slate-200 bg-white px-4 text-left text-sm font-medium text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
      >
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        <span className="ml-2 shrink-0 text-xs text-slate-400" aria-hidden>
          ▾
        </span>
      </button>
      {panel}
    </>
  );
}

export default function Directory({
  lang = "el",
  initialInfluencers = [],
  initialTotal = 0,
  homeLimit,
  onDisplayedIdsChange,
  preset,
}: {
  lang?: "el" | "en";
  initialInfluencers?: Influencer[];
  initialTotal?: number;
  /** Homepage preview: show only this many cards, no pagination. */
  homeLimit?: number;
  /** Fired when the visible preview card ids change (home preview). */
  onDisplayedIdsChange?: (ids: string[]) => void;
  /** Landing page filters. The browser URL stays the landing path. */
  preset?: { skills?: string[]; location?: string; platform?: string; category?: string };
}) {
  const [influencers, setInfluencers] = useState<Influencer[]>(initialInfluencers);
  const [total, setTotal] = useState(initialTotal);
  const txt = t[lang];
  const isMountedRef = useRef(true);
  const router = useRouter();
  const pathname = usePathname() || "/directory";
  const searchParams = useSearchParams();
  const skipPageResetRef = useRef(true);
  const isHomePreview = typeof homeLimit === "number" && homeLimit > 0;

  const [searchQuery, setSearchQuery] = useState(() => (preset ? "" : (searchParams.get("q") || "").trim()));
  const [searchFocused, setSearchFocused] = useState(false);
  const searchPlaceholder = useTypewriterPlaceholder(
    SEARCH_EXAMPLES[lang],
    !searchFocused && !searchQuery.trim()
  );
  const [locationQuery, setLocationQuery] = useState(preset?.location || "");
  const [platformFilter, setPlatformFilter] = useState(preset?.platform || "All");
  const [packageType, setPackageType] = useState("All");
  const [maxPackagePrice, setMaxPackagePrice] = useState("");
  const [relaxedMax, setRelaxedMax] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState(() =>
    preset?.category || categoryFromSearchParam(searchParams.get("category"))
  );
  const [genderFilter, setGenderFilter] = useState("All");
  // Always start closed for SSR; open on lg+ after mount (except home preview).
  const [showAdvanced, setShowAdvanced] = useState(false);
  const advancedDefaultAppliedRef = useRef(false);

  const [followerRange, setFollowerRange] = useState("All");
  const [budgetMax, setBudgetMax] = useState("All");
  const [minEngagement, setMinEngagement] = useState("All");
  const [languageFilter, setLanguageFilter] = useState(() => languagesFromSearchParam(searchParams.get("language")));
  const [skillFilter, setSkillFilter] = useState(() => preset?.skills || skillsFromSearchParam(searchParams.get("skills")));
  const [minRating, setMinRating] = useState("All");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [badgeFilter, setBadgeFilter] = useState<BadgeType | "All">("All");
  const [availabilityFilter, setAvailabilityFilter] = useState<"All" | "available" | "unavailable">(
    "available"
  );
  const [loading, setLoading] = useState(initialInfluencers.length === 0);
  const [page, setPage] = useState(() => pageFromSearchParam(searchParams.get("page")));

  useEffect(() => {
    if (isHomePreview || advancedDefaultAppliedRef.current) return;
    advancedDefaultAppliedRef.current = true;
    const mq = window.matchMedia("(min-width: 1024px)");
    if (mq.matches) setShowAdvanced(true);
  }, [isHomePreview]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    const filtersAreDefault =
      !searchQuery.trim() &&
      !locationQuery.trim() &&
      platformFilter === "All" &&
      categoryFilter === "All" &&
      genderFilter === "All" &&
      followerRange === "All" &&
      budgetMax === "All" &&
      minEngagement === "All" &&
      languageFilter.length === 0 &&
      skillFilter.length === 0 &&
      minRating === "All" &&
      !ageMin.trim() &&
      !ageMax.trim() &&
      badgeFilter === "All" &&
      availabilityFilter === "available" &&
      (isHomePreview || page === 1);
    if (!(filtersAreDefault && initialInfluencers.length > 0)) setLoading(true);

    const params = new URLSearchParams();
    params.set("page", isHomePreview ? "1" : String(page));
    params.set("pageSize", String(isHomePreview ? homeLimit : PAGE_SIZE));
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (locationQuery.trim()) params.set("location", locationQuery.trim());
    if (platformFilter !== "All") params.set("platform", platformFilter);
    if (categoryFilter !== "All") params.set("category", categoryFilter);
    if (genderFilter !== "All") params.set("gender", genderFilter);
    if (followerRange !== "All") params.set("followers", followerRange);
    if (budgetMax !== "All") params.set("budget", budgetMax);
    if (minEngagement !== "All") params.set("engagement", minEngagement);
    if (languageFilter.length) params.set("language", languageFilter.join(","));
    if (skillFilter.length) params.set("skills", skillFilter.join(","));
    if (packageType !== "All") params.set("pkg", packageType);
    if (maxPackagePrice.trim()) params.set("maxPrice", maxPackagePrice.trim());
    if (minRating !== "All") params.set("rating", minRating);
    if (ageMin.trim()) params.set("ageMin", ageMin.trim());
    if (ageMax.trim()) params.set("ageMax", ageMax.trim());
    if (badgeFilter !== "All") params.set("badge", badgeFilter);
    params.set("availability", availabilityFilter);

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/influencers/public?${params.toString()}`, {
          signal: controller.signal,
        });
        const result = await response.json();
        if (!isMountedRef.current) return;
        if (!response.ok || result.error) {
          setInfluencers([]);
          setTotal(0);
          setRelaxedMax(null);
          return;
        }
        const data = result.data || [];
        const realInfluencers: Influencer[] = data.map((inf: any) => {
            const socialsObj: { [key: string]: string } = {};
            const followersObj: { [key: string]: number } = {};
            const engagementRatesObj: { [key: string]: string } = {};

            if (Array.isArray(inf.accounts)) {
              inf.accounts.forEach((acc: any) => {
                if (acc.platform && acc.username) {
                  const key = acc.platform.toLowerCase();
                  socialsObj[key] = acc.username;
                  followersObj[key] = parseFollowerString(acc.followers);
                  if (acc.engagement_rate) {
                    engagementRatesObj[key] = acc.engagement_rate;
                  }
                }
              });
            }

            const languagesArray = inf.languages
              ? typeof inf.languages === "string" && inf.languages.includes(",")
                ? inf.languages.split(",").map((l: string) => l.trim())
                : typeof inf.languages === "string"
                  ? [inf.languages.trim()]
                  : Array.isArray(inf.languages)
                    ? inf.languages
                    : []
              : [];

            return {
              id: inf.id,
              name: inf.display_name,
              bio: inf.bio || "",
              bio_en: inf.bio_en || null,
              avatar: inf.avatar_url || null,
              verified: inf.analytics_verified || false,
              socials: socialsObj,
              followers: followersObj,
              categories: inf.category
                ? parseStoredCategories(inf.category).length
                  ? parseStoredCategories(inf.category)
                  : ["New"]
                : ["New"],
              languages: languagesArray,
              skills: sanitizeSkills(inf.skills),
              platform: "Instagram",
              gender: normalizeGender(inf.gender),
              location: inf.location,
              price_tier: inf.price_tier || "0",
              from_price: typeof inf.from_price === "number" && inf.from_price > 0 ? inf.from_price : null,
              avg_likes: inf.avg_likes,
              engagement_rate:
                Object.keys(engagementRatesObj).length > 0
                  ? engagementRatesObj
                  : inf.engagement_rate || undefined,
              videos: Array.isArray(inf.videos) ? inf.videos : [],
              avg_rating: inf.avg_rating || 0,
              total_reviews: inf.total_reviews || 0,
              avg_response_time: inf.avg_response_time ?? null,
              completion_rate: resolveCompletionRate(inf.completion_rate),
              past_brands: inf.past_brands || 0,
              created_at: inf.created_at,
              age: typeof inf.age === "number" ? inf.age : null,
              availability_status: inf.availability_status || "available",
              profile_slug: inf.profile_slug || null,
              accounts: Array.isArray(inf.accounts) ? inf.accounts : [],
            };
          });

        if (!isMountedRef.current) return;
        setInfluencers(realInfluencers);
        setTotal(typeof result.total === "number" ? result.total : realInfluencers.length);
        setRelaxedMax(typeof result.relaxedMax === "number" ? result.relaxedMax : null);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (isMountedRef.current) {
          setInfluencers([]);
          setTotal(0);
          setRelaxedMax(null);
        }
      } finally {
        if (isMountedRef.current && !controller.signal.aborted) setLoading(false);
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    isHomePreview,
    homeLimit,
    page,
    searchQuery,
    locationQuery,
    platformFilter,
    categoryFilter,
    genderFilter,
    followerRange,
    budgetMax,
    minEngagement,
    languageFilter,
    skillFilter,
    packageType,
    maxPackagePrice,
    minRating,
    ageMin,
    ageMax,
    badgeFilter,
    availabilityFilter,
    initialInfluencers.length,
  ]);

  const replaceUrlParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      if (preset) return;
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      const next = qs ? `${pathname}?${qs}` : pathname;
      const currentQs = searchParams.toString();
      const current = currentQs ? `${pathname}?${currentQs}` : pathname;
      if (next !== current) {
        router.replace(next, { scroll: false });
      }
    },
    [pathname, preset, router, searchParams]
  );

  const setCategoryFilterAndUrl = useCallback(
    (value: string) => {
      setCategoryFilter(value);
      setPage(1);
      replaceUrlParams((params) => {
        if (!value || value === "All") params.delete("category");
        else params.set("category", value);
        params.delete("page");
      });
    },
    [replaceUrlParams]
  );

  const setPageAndUrl = useCallback(
    (nextPage: number) => {
      const safe = Math.max(1, nextPage);
      setPage(safe);
      replaceUrlParams((params) => {
        if (safe <= 1) params.delete("page");
        else params.set("page", String(safe));
      });
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [replaceUrlParams]
  );

  // Keep category + page in sync with shared URL / browser back.
  useEffect(() => {
    if (preset) return;
    const fromUrlCat = categoryFromSearchParam(searchParams.get("category"));
    setCategoryFilter((prev) => (prev === fromUrlCat ? prev : fromUrlCat));
    const fromUrlPage = pageFromSearchParam(searchParams.get("page"));
    setPage((prev) => (prev === fromUrlPage ? prev : fromUrlPage));
    const fromUrlQuery = (searchParams.get("q") || "").trim();
    setSearchQuery((prev) => (prev === fromUrlQuery ? prev : fromUrlQuery));
    const fromSkill = skillsFromSearchParam(searchParams.get("skills"));
    setSkillFilter((prev) => (sameList(prev, fromSkill) ? prev : fromSkill));
    const fromLanguage = languagesFromSearchParam(searchParams.get("language"));
    setLanguageFilter((prev) => (sameList(prev, fromLanguage) ? prev : fromLanguage));
    const fromLocation = (searchParams.get("location") || "").trim();
    setLocationQuery((prev) => (prev === fromLocation ? prev : fromLocation));
    const fromPlatform = searchParams.get("platform") || "All";
    setPlatformFilter((prev) => (prev === fromPlatform ? prev : fromPlatform));
    const fromPkg = searchParams.get("pkg") || "All";
    setPackageType((prev) => (prev === fromPkg ? prev : fromPkg));
    const fromMax = (searchParams.get("maxPrice") || "").trim();
    setMaxPackagePrice((prev) => (prev === fromMax ? prev : fromMax));
  }, [preset, searchParams]);

  const clearFilters = () => {
    setSearchQuery("");
    setLocationQuery("");
    setPlatformFilter("All");
    setCategoryFilter("All");
    setGenderFilter("All");
    setFollowerRange("All");
    setBudgetMax("All");
    setMinEngagement("All");
    setLanguageFilter([]);
    setSkillFilter([]);
    setPackageType("All");
    setMaxPackagePrice("");
    setMinRating("All");
    setAgeMin("");
    setAgeMax("");
    setBadgeFilter("All");
    setAvailabilityFilter("available");
    setPage(1);
    replaceUrlParams((params) => {
      params.delete("q");
      params.delete("category");
      params.delete("language");
      params.delete("skills");
      params.delete("pkg");
      params.delete("maxPrice");
      params.delete("page");
    });
  };

  type ActiveChip = { id: string; label: string; clear: () => void };

  const { activeChips, extraFilterCount } = useMemo(() => {
    const chips: ActiveChip[] = [];
    let extra = 0;

    const q = searchQuery.trim();
    if (q) {
      chips.push({
        id: "search",
        label: q,
        clear: () => {
          setSearchQuery("");
          replaceUrlParams((params) => params.delete("q"));
        },
      });
    }
    if (platformFilter !== "All") {
      chips.push({
        id: "platform",
        label: platformFilter,
        clear: () => setPlatformFilter("All"),
      });
    }
    if (categoryFilter !== "All") {
      const parts = categoryFilter.split(",").map((part) => part.trim()).filter(Boolean);
      chips.push({
        id: "category",
        label: parts.map((part) => (categoryTranslations[part] ? categoryTranslations[part][lang] : part)).join(", "),
        clear: () => setCategoryFilterAndUrl("All"),
      });
    }
    if (packageType !== "All" || maxPackagePrice.trim()) {
      const cap = Number(maxPackagePrice);
      chips.push({
        id: "package",
        label:
          packageType !== "All" && Number.isFinite(cap) && cap > 0
            ? `${packageType} ${txt.budUpTo} ${formatEuro(cap, lang)}`
            : packageType !== "All"
              ? packageType
              : `${txt.budUpTo} ${formatEuro(cap, lang)}`,
        clear: () => {
          setPackageType("All");
          setMaxPackagePrice("");
          setPage(1);
          replaceUrlParams((params) => {
            params.delete("pkg");
            params.delete("maxPrice");
            params.delete("page");
          });
        },
      });
    }
    const loc = locationQuery.trim();
    if (loc) {
      chips.push({ id: "location", label: loc, clear: () => setLocationQuery("") });
    }
    if (budgetMax !== "All") {
      extra += 1;
      chips.push({
        id: "budget",
        label:
          budgetMax === "Unlimited"
            ? txt.budUnlimited
            : `${txt.budUpTo} ${formatEuro(Number(budgetMax), lang)}`,
        clear: () => setBudgetMax("All"),
      });
    }
    if (followerRange !== "All") {
      extra += 1;
      const follLabel =
        followerRange === "Nano"
          ? "Nano"
          : followerRange === "Micro"
            ? "Micro"
            : followerRange === "Macro"
              ? "Macro"
              : followerRange;
      chips.push({
        id: "followers",
        label: follLabel,
        clear: () => setFollowerRange("All"),
      });
    }
    if (minEngagement !== "All") {
      extra += 1;
      chips.push({
        id: "engagement",
        label: `${txt.engMin} ${minEngagement}%`,
        clear: () => setMinEngagement("All"),
      });
    }
    for (const code of languageFilter) {
      extra += 1;
      const langItem = LANGUAGES.find((item) => item.code === code);
      chips.push({
        id: `language-${code}`,
        label: langItem ? langItem[lang] : code,
        clear: () => {
          const next = languageFilter.filter((item) => item !== code);
          setLanguageFilter(next);
          setPage(1);
          replaceUrlParams((params) => {
            if (!next.length) params.delete("language");
            else params.set("language", next.join(","));
            params.delete("page");
          });
        },
      });
    }
    for (const key of skillFilter) {
      extra += 1;
      chips.push({
        id: `skill-${key}`,
        label: skillLabel(key, lang) || key,
        clear: () => {
          const next = skillFilter.filter((item) => item !== key);
          setSkillFilter(next);
          setPage(1);
          replaceUrlParams((params) => {
            if (!next.length) params.delete("skills");
            else params.set("skills", next.join(","));
            params.delete("page");
          });
        },
      });
    }
    if (genderFilter !== "All") {
      extra += 1;
      const genderLabel =
        genderFilter === "Female"
          ? txt.genFem
          : genderFilter === "Male"
            ? txt.genMal
            : genderFilter === "AI"
              ? txt.genAi
              : genderFilter;
      chips.push({ id: "gender", label: genderLabel, clear: () => setGenderFilter("All") });
    }
    if (ageMin.trim() || ageMax.trim()) {
      extra += 1;
      const from = ageMin.trim() || "…";
      const to = ageMax.trim() || "…";
      chips.push({
        id: "age",
        label: `${from}–${to}`,
        clear: () => {
          setAgeMin("");
          setAgeMax("");
        },
      });
    }
    if (minRating !== "All") {
      extra += 1;
      chips.push({
        id: "rating",
        label: `${txt.ratingMin} ${minRating}★`,
        clear: () => setMinRating("All"),
      });
    }
    // Default availability ("available") does not count as an active filter.
    if (availabilityFilter !== "available") {
      extra += 1;
      chips.push({
        id: "availability",
        label: availabilityFilter === "unavailable" ? txt.availNo : txt.availAll,
        clear: () => setAvailabilityFilter("available"),
      });
    }
    if (badgeFilter !== "All") {
      extra += 1;
      chips.push({
        id: "badge",
        label: getBadgeFilterLabel(badgeFilter, lang),
        clear: () => setBadgeFilter("All"),
      });
    }

    return { activeChips: chips, extraFilterCount: extra };
  }, [
    searchQuery,
    locationQuery,
    platformFilter,
    categoryFilter,
    genderFilter,
    availabilityFilter,
    followerRange,
    budgetMax,
    minEngagement,
    languageFilter,
    skillFilter,
    packageType,
    maxPackagePrice,
    minRating,
    badgeFilter,
    ageMin,
    ageMax,
    lang,
    txt,
    setCategoryFilterAndUrl,
    replaceUrlParams,
  ]);

  // Reset to page 1 when filters change (skip first mount so ?page= is kept).
  // Do not depend on replaceUrlParams — its identity changes when ?page= updates.
  useEffect(() => {
    if (skipPageResetRef.current) {
      skipPageResetRef.current = false;
      return;
    }
    setPage(1);
    replaceUrlParams((params) => {
      params.delete("page");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only filter values
  }, [
    searchQuery,
    locationQuery,
    platformFilter,
    categoryFilter,
    genderFilter,
    followerRange,
    budgetMax,
    minEngagement,
    languageFilter,
    skillFilter,
    packageType,
    maxPackagePrice,
    minRating,
    ageMin,
    ageMax,
    badgeFilter,
    availabilityFilter,
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const displayedInfluencers = influencers;

  const pageButtons = useMemo(() => {
    if (isHomePreview || totalPages <= 7) {
      return isHomePreview ? [] : Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);
    for (let i = safePage - 1; i <= safePage + 1; i++) {
      if (i >= 1 && i <= totalPages) pages.add(i);
    }
    return Array.from(pages).sort((a, b) => a - b);
  }, [isHomePreview, safePage, totalPages]);

  const fullDirectoryHref = useMemo(() => {
    const base = lang === "en" ? "/en/directory" : "/directory";
    const params = new URLSearchParams();
    if (categoryFilter && categoryFilter !== "All") params.set("category", categoryFilter);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }, [categoryFilter, lang]);

  const displayedIdsKey = displayedInfluencers.map((inf) => String(inf.id)).join(",");
  useEffect(() => {
    if (!isHomePreview || !onDisplayedIdsChange) return;
    onDisplayedIdsChange(displayedIdsKey ? displayedIdsKey.split(",") : []);
  }, [isHomePreview, onDisplayedIdsChange, displayedIdsKey]);

  const cardGridClass = isHomePreview
    ? "grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4 md:gap-x-6 md:gap-y-8"
    : "grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-8";

  return (
    <div>
      {/* Filter bar — Collabstr-style pills */}
      <div className="mb-6 space-y-3">
        {/* Top row: search → platform → category → location → filters → count */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:min-w-[200px] sm:flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              <SearchIcon />
            </div>
            <input
              type="text"
              placeholder={searchFocused || searchQuery.trim() ? "" : searchPlaceholder}
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onChange={(e) => {
                const parsed = parseDirectoryPhrase(e.target.value);
                setSearchQuery(parsed.remainder);
                if (parsed.skill) {
                  setSkillFilter((prev) => (prev.includes(parsed.skill!) ? prev : [...prev, parsed.skill!]));
                }
                if (parsed.categories.length) setCategoryFilter(parsed.categories.join(","));
                if (parsed.location) setLocationQuery(parsed.location);
                if (parsed.platform) setPlatformFilter(parsed.platform);
                if (parsed.language) {
                  setLanguageFilter((prev) => (prev.includes(parsed.language!) ? prev : [...prev, parsed.language!]));
                }
                if (parsed.packageType) setPackageType(parsed.packageType);
                if (parsed.maxPrice != null) setMaxPackagePrice(String(parsed.maxPrice));
                replaceUrlParams((params) => {
                  if (parsed.remainder.trim()) params.set("q", parsed.remainder.trim());
                  else params.delete("q");
                  if (parsed.skill) {
                    const next = new Set([...(params.get("skills") || "").split(",").filter(Boolean), parsed.skill]);
                    params.set("skills", [...next].join(","));
                  }
                  if (parsed.categories.length) params.set("category", parsed.categories.join(","));
                  if (parsed.location) params.set("location", parsed.location);
                  if (parsed.platform) params.set("platform", parsed.platform);
                  if (parsed.language) {
                    const next = new Set([...(params.get("language") || "").split(",").filter(Boolean), parsed.language]);
                    params.set("language", [...next].join(","));
                  }
                  if (parsed.packageType) params.set("pkg", parsed.packageType);
                  if (parsed.maxPrice != null) params.set("maxPrice", String(parsed.maxPrice));
                  params.delete("page");
                });
              }}
              className={pillInput}
              aria-label={txt.searchPlace}
            />
          </div>

          <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap sm:items-center">
            <div className="min-w-0 sm:min-w-[120px] sm:flex-none sm:w-40">
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className={pillSelect}
                aria-label={txt.platAll}
              >
                <option value="All">{txt.platAll}</option>
                <option value="Instagram">Instagram</option>
                <option value="TikTok">TikTok</option>
                <option value="YouTube">YouTube</option>
              </select>
            </div>

            <div className="min-w-0 sm:min-w-[120px] sm:flex-none sm:w-48">
              <select
                value={(CATEGORIES as readonly string[]).includes(categoryFilter) ? categoryFilter : categoryFilter === "All" ? "All" : categoryFilter}
                onChange={(e) => setCategoryFilterAndUrl(e.target.value)}
                className={pillSelect}
                aria-label={txt.catAll}
              >
                <option value="All">{txt.catAll}</option>
                {categoryFilter !== "All" && !(CATEGORIES as readonly string[]).includes(categoryFilter) ? (
                  <option value={categoryFilter}>
                    {categoryFilter.split(",").map((part) => categoryTranslations[part.trim()]?.[lang] || part.trim()).join(", ")}
                  </option>
                ) : null}
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {categoryTranslations[cat] ? categoryTranslations[cat][lang] : cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative min-w-0 sm:min-w-[140px] sm:flex-none sm:w-44">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <LocationIcon />
              </div>
              <LocationTypeahead
                lang={lang}
                value={locationQuery}
                onChange={setLocationQuery}
                placeholder={txt.locPlace}
                className={pillInput}
                ariaLabel={txt.locPlace}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
              className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900/20 sm:w-auto sm:justify-start ${
                showAdvanced
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <FilterIcon />
              <span>{txt.filters}</span>
              {extraFilterCount > 0 ? (
                <span
                  className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                    showAdvanced ? "bg-white text-slate-900" : "bg-slate-900 text-white"
                  }`}
                >
                  {extraFilterCount}
                </span>
              ) : null}
              <span className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}>
                <ChevronDown />
              </span>
            </button>

            <span className="col-span-2 ml-auto shrink-0 text-right text-xs font-medium text-slate-400 sm:col-span-1 sm:ml-0 sm:pl-1 sm:text-left">
              {total} {txt.results}
            </span>
          </div>
        </div>

        {/* Active filter chips */}
        {activeChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {activeChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={chip.clear}
                className={chipBtn}
                aria-label={`${txt.clear}: ${chip.label}`}
              >
                <span className="max-w-[12rem] truncate">{chip.label}</span>
                <span aria-hidden className="text-slate-400">
                  ×
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold text-slate-500 underline-offset-2 transition-colors hover:text-slate-900 hover:underline focus:outline-none focus:ring-2 focus:ring-slate-900/20 rounded"
            >
              {txt.clearAll}
            </button>
          </div>
        ) : null}

        {/* Advanced filters panel — grid collapse (no max-h clip) */}
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            showAdvanced ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden min-h-0" aria-hidden={!showAdvanced} inert={!showAdvanced || undefined}>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="grid grid-cols-2 gap-x-3 gap-y-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
                <div>
                  <label className={fieldLabel}>{txt.fieldBudget}</label>
                  <select
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    className={pillSelect}
                  >
                    <option value="All">{txt.budAll}</option>
                    {DIRECTORY_BUDGET_CAPS.map((cap) => (
                      <option key={cap} value={String(cap)}>
                        {txt.budUpTo} {formatEuro(cap, lang)}
                      </option>
                    ))}
                    <option value="Unlimited">{txt.budUnlimited}</option>
                  </select>
                </div>

                <div>
                  <label className={fieldLabel}>{txt.fieldFollowers}</label>
                  <select
                    value={followerRange}
                    onChange={(e) => setFollowerRange(e.target.value)}
                    className={pillSelect}
                  >
                    <option value="All">{txt.follAll}</option>
                    <option value="Nano">{txt.follNano}</option>
                    <option value="Micro">{txt.follMicro}</option>
                    <option value="Macro">{txt.follMacro}</option>
                  </select>
                </div>

                <div>
                  <label className={fieldLabel}>{txt.fieldEngagement}</label>
                  <select
                    value={minEngagement}
                    onChange={(e) => setMinEngagement(e.target.value)}
                    className={pillSelect}
                  >
                    <option value="All">{txt.engAll}</option>
                    <option value="1">
                      {txt.engMin} 1%
                    </option>
                    <option value="3">
                      {txt.engMin} 3% ({txt.engGood})
                    </option>
                    <option value="5">
                      {txt.engMin} 5% ({txt.engHigh})
                    </option>
                  </select>
                </div>

                <div>
                  <label className={fieldLabel}>{txt.fieldSkills}</label>
                  <MultiFilterDropdown
                    ariaLabel={txt.fieldSkills}
                    placeholder={txt.skillsAll}
                    selected={skillFilter}
                    options={SKILLS.map((key) => ({ value: key, label: skillLabel(key, lang) || key }))}
                    onChange={(next) => {
                      setSkillFilter(next);
                      setPage(1);
                      replaceUrlParams((params) => {
                        if (!next.length) params.delete("skills");
                        else params.set("skills", next.join(","));
                        params.delete("page");
                      });
                    }}
                  />
                </div>

                <div>
                  <label className={fieldLabel}>{txt.fieldLanguage}</label>
                  <MultiFilterDropdown
                    ariaLabel={txt.fieldLanguage}
                    placeholder={txt.langAll}
                    selected={languageFilter}
                    options={LANGUAGES.map((item) => ({ value: item.code, label: item[lang] }))}
                    onChange={(next) => {
                      setLanguageFilter(next);
                      setPage(1);
                      replaceUrlParams((params) => {
                        if (!next.length) params.delete("language");
                        else params.set("language", next.join(","));
                        params.delete("page");
                      });
                    }}
                  />
                </div>

                <div>
                  <label className={fieldLabel}>{txt.fieldGender}</label>
                  <select
                    value={genderFilter}
                    onChange={(e) => setGenderFilter(e.target.value)}
                    className={pillSelect}
                  >
                    <option value="All">{txt.genAll}</option>
                    <option value="Female">{txt.genFem}</option>
                    <option value="Male">{txt.genMal}</option>
                    <option value="AI">{txt.genAi}</option>
                  </select>
                </div>

                <div className="col-span-1">
                  <label className={fieldLabel}>{txt.fieldAge}</label>
                  <div className="flex h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 transition-colors hover:border-slate-300 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/20">
                    <input
                      type="number"
                      min={18}
                      max={99}
                      placeholder={txt.ageFrom}
                      value={ageMin}
                      onChange={(e) => setAgeMin(e.target.value)}
                      className="h-full w-full min-w-0 bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
                      aria-label={txt.ageFrom}
                    />
                    <span className="shrink-0 text-slate-300" aria-hidden>
                      –
                    </span>
                    <input
                      type="number"
                      min={18}
                      max={99}
                      placeholder={txt.ageTo}
                      value={ageMax}
                      onChange={(e) => setAgeMax(e.target.value)}
                      className="h-full w-full min-w-0 bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
                      aria-label={txt.ageTo}
                    />
                  </div>
                </div>

                <div>
                  <label className={fieldLabel}>{txt.fieldRating}</label>
                  <select
                    value={minRating}
                    onChange={(e) => setMinRating(e.target.value)}
                    className={pillSelect}
                  >
                    <option value="All">{txt.ratingAll}</option>
                    <option value="3">
                      {txt.ratingMin} 3★
                    </option>
                    <option value="4">
                      {txt.ratingMin} 4★
                    </option>
                    <option value="4.5">
                      {txt.ratingMin} 4.5★
                    </option>
                  </select>
                </div>

                <div>
                  <label className={fieldLabel}>{txt.fieldAvailability}</label>
                  <select
                    value={availabilityFilter}
                    onChange={(e) =>
                      setAvailabilityFilter(e.target.value as "All" | "available" | "unavailable")
                    }
                    className={pillSelect}
                  >
                    <option value="All">{txt.availAll}</option>
                    <option value="available">{txt.availYes}</option>
                    <option value="unavailable">{txt.availNo}</option>
                  </select>
                </div>

                <div>
                  <label className={fieldLabel}>{txt.fieldBadges}</label>
                  <select
                    value={badgeFilter}
                    onChange={(e) => setBadgeFilter(e.target.value as BadgeType | "All")}
                    className={pillSelect}
                  >
                    <option value="All">{txt.badgeAll}</option>
                    {BADGE_FILTER_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {getBadgeFilterLabel(type, lang)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {relaxedMax != null && maxPackagePrice.trim() ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {lang === "el"
            ? `Δεν βρέθηκε ακριβώς έως ${formatEuro(Number(maxPackagePrice), "el")}. Δείχνουμε σχετικά, έως ${formatEuro(relaxedMax, "el")}.`
            : `Nothing matched up to ${formatEuro(Number(maxPackagePrice), "en")}. Showing close matches up to ${formatEuro(relaxedMax, "en")}.`}
        </p>
      ) : null}

      {loading ? (
        <div className={cardGridClass}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[4/5] rounded-2xl bg-slate-200" />
              <div className="mt-3 space-y-2">
                <div className="h-4 w-3/4 rounded bg-slate-200" />
                <div className="h-3 w-1/2 rounded bg-slate-200" />
                <div className="h-3 w-full rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      ) : influencers.length > 0 ? (
        <>
          <div className={cardGridClass}>
            {displayedInfluencers.map((inf) => {
              const badges = badgesForInfluencer(inf, lang);

              return (
                <Link
                  href={publicProfilePath(inf.profile_slug, inf.id)}
                  key={inf.id}
                  className="block group min-w-0"
                  onClick={() => {
                    fetch("/api/analytics/track", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        influencerId: inf.id,
                        eventType: "profile_click",
                        visitorId: getVisitorId(),
                        metadata: { source: isHomePreview ? "home_directory" : "directory" },
                      }),
                      keepalive: true,
                    }).catch(() => {});
                  }}
                >
                  <InfluencerCard
                    {...inf}
                    badges={badges}
                    lang={lang}
                    trustChips={trustChipsFromAccounts(inf.accounts)}
                    availabilityStatus={inf.availability_status}
                    location={displayLocation(inf.location, lang) || inf.location}
                    from_price={inf.from_price}
                  />
                </Link>
              );
            })}
          </div>

          {isHomePreview ? (
            <div className="mt-10 flex justify-center">
              <a
                href={fullDirectoryHref}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-8 py-3.5 text-base font-semibold text-white shadow-md transition-colors hover:bg-slate-800 hover:shadow-lg"
              >
                {txt.seeFullDirectory}
              </a>
            </div>
          ) : totalPages > 1 ? (
            <nav
              className="mt-10 flex flex-wrap items-center justify-center gap-2"
              aria-label={lang === "el" ? "Σελιδοποίηση" : "Pagination"}
            >
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPageAndUrl(safePage - 1)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {txt.pagePrev}
              </button>
              {pageButtons.map((p, idx) => {
                const prev = pageButtons[idx - 1];
                const showEllipsis = prev != null && p - prev > 1;
                return (
                  <span key={p} className="contents">
                    {showEllipsis && (
                      <span className="px-1 text-slate-400" aria-hidden>
                        …
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setPageAndUrl(p)}
                      aria-current={p === safePage ? "page" : undefined}
                      className={`min-w-10 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                        p === safePage
                          ? "bg-slate-900 text-white"
                          : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      {p}
                    </button>
                  </span>
                );
              })}
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPageAndUrl(safePage + 1)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {txt.pageNext}
              </button>
            </nav>
          ) : null}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-20 text-center">
          <h3 className="text-xl font-bold text-slate-900">{txt.noResults}</h3>
          <p className="mb-4 text-slate-500">{txt.adjust}</p>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-bold text-white"
          >
            {txt.reset}
          </button>
        </div>
      )}
    </div>
  );
}
