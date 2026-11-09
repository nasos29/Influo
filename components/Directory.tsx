"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import InfluencerCard from "./InfluencerCard";
import { getBadges, getBadgeFilterLabel, type BadgeType } from "../lib/badges";
import { getVisitorId } from "../lib/visitorId";
import { normalizeGender, type GenderValue } from "../lib/gender";
import { trustChipsFromAccounts } from "@/lib/trustSignals";
import { publicProfilePath } from "@/lib/profileSlug";
import { CATEGORIES, categoryTranslations, parseStoredCategories } from "@/lib/categories";
import { formatEuro } from "@/lib/formatEuro";
import { parseDirectoryPhrase } from "@/lib/directoryPhrase";
import { useDirectoryTypewriter } from "@/components/directoryTypewriter";
import { badgeMinRateFromTier } from "@/lib/publicInfluencer";
import { resolveCompletionRate } from "@/lib/completionRate";
import { displayLocation } from "@/lib/displayLocation";
import { sanitizeSkills, skillLabel } from "@/lib/skills";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { filterUiVariantFromSetting } from "@/lib/siteSettings";
import DirectoryFilters from "@/components/DirectoryFilters";

const CATEGORY_KEYS = new Set<string>(CATEGORIES);
const PAGE_SIZE = 40;

function categoryFromSearchParam(raw: string | null): string {
  if (!raw || raw === "All") return "All";
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length > 0 && parts.every((part) => CATEGORY_KEYS.has(part))) return parts.join(",");
  return "All";
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
  extra_badges?: string[];
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

const t = {
  el: {
    searchAria: "Αναζήτηση",
    locPlace: "Τοποθεσία",
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
    searchAria: "Search",
    locPlace: "Location",
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

const parseFollowerString = (str: string) => {
  if (!str) return 0;
  const clean = str.toLowerCase().replace(/,/g, "").trim();
  if (clean.includes("k")) return parseFloat(clean) * 1000;
  if (clean.includes("m")) return parseFloat(clean) * 1000000;
  return parseFloat(clean) || 0;
};

const badgesForInfluencer = (
  inf: Influencer,
  lang: "el" | "en",
  newBadgeMaxDays?: number
) => {
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
      extra_badges: inf.extra_badges,
    },
    lang,
    { newBadgeMaxDays }
  );
};

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
  const settings = useSiteSettings();
  const newBadgeMaxDays = settings.new_badge_max_days;
  const txt = t[lang];
  const isMountedRef = useRef(true);
  const router = useRouter();
  const pathname = usePathname() || "/directory";
  const searchParams = useSearchParams();
  const skipPageResetRef = useRef(true);
  const isHomePreview = typeof homeLimit === "number" && homeLimit > 0;

  const [searchQuery, setSearchQuery] = useState(() => (preset ? "" : (searchParams.get("q") || "").trim()));
  const [searchFocused, setSearchFocused] = useState(false);
  const searchFocusedRef = useRef(false);
  const [committedSearch, setCommittedSearch] = useState<{ raw: string; remainder: string } | null>(null);
  const apiQuery =
    committedSearch && committedSearch.raw === searchQuery.trim() ? committedSearch.remainder : searchQuery.trim();
  const searchPlaceholder = useDirectoryTypewriter(
    lang,
    !searchFocused && !searchQuery.trim(),
    influencers.map((inf) => inf.name)
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
    if (apiQuery) params.set("q", apiQuery);
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
              extra_badges: Array.isArray(inf.extra_badges) ? inf.extra_badges : undefined,
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
    apiQuery,
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
    if (!searchFocusedRef.current) {
      const fromUrlQuery = (searchParams.get("q") || "").trim();
      setSearchQuery((prev) => (prev === fromUrlQuery ? prev : fromUrlQuery));
    }
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

  const applyPhraseRef = useRef<(raw: string) => void>(() => {});
  applyPhraseRef.current = (raw: string) => {
    const parsed = parseDirectoryPhrase(raw);
    const trimmed = raw.trim();
    setCommittedSearch({ raw: trimmed, remainder: parsed.remainder });
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
      if (trimmed) params.set("q", trimmed);
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
    });
  };

  const phraseHydratedRef = useRef(false);
  useEffect(() => {
    const raw = searchQuery;
    const hydrate = !phraseHydratedRef.current;
    phraseHydratedRef.current = true;
    if (hydrate) {
      if (raw.trim()) applyPhraseRef.current(raw);
      return;
    }
    const timer = window.setTimeout(() => applyPhraseRef.current(raw), 600);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

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
    ? "grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-5 md:gap-x-6 md:gap-y-8 grid-creators-wide"
    : "grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-8 grid-creators-wide";

  const filterVariant = filterUiVariantFromSetting(settings.filter_ui_variant);
  const useSidebarLayout = filterVariant === "sidebar" && !isHomePreview;

  const filtersNode = (
    <DirectoryFilters
      variant={isHomePreview ? "chips" : filterVariant}
      lang={lang}
      txt={txt}
      total={total}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      searchPlaceholder={searchPlaceholder}
      onSearchEnter={() => applyPhraseRef.current(searchQuery)}
      onSearchFocus={() => {
        searchFocusedRef.current = true;
        setSearchFocused(true);
      }}
      onSearchBlur={() => {
        searchFocusedRef.current = false;
        setSearchFocused(false);
      }}
      platformFilter={platformFilter}
      setPlatformFilter={setPlatformFilter}
      categoryFilter={categoryFilter}
      setCategoryFilterAndUrl={setCategoryFilterAndUrl}
      locationQuery={locationQuery}
      setLocationQuery={setLocationQuery}
      showAdvanced={showAdvanced}
      setShowAdvanced={setShowAdvanced}
      extraFilterCount={extraFilterCount}
      activeChips={activeChips}
      clearFilters={clearFilters}
      budgetMax={budgetMax}
      setBudgetMax={setBudgetMax}
      followerRange={followerRange}
      setFollowerRange={setFollowerRange}
      minEngagement={minEngagement}
      setMinEngagement={setMinEngagement}
      skillFilter={skillFilter}
      onSkillFilterChange={(next) => {
        setSkillFilter(next);
        setPage(1);
        replaceUrlParams((params) => {
          if (!next.length) params.delete("skills");
          else params.set("skills", next.join(","));
          params.delete("page");
        });
      }}
      languageFilter={languageFilter}
      onLanguageFilterChange={(next) => {
        setLanguageFilter(next);
        setPage(1);
        replaceUrlParams((params) => {
          if (!next.length) params.delete("language");
          else params.set("language", next.join(","));
          params.delete("page");
        });
      }}
      genderFilter={genderFilter}
      setGenderFilter={setGenderFilter}
      ageMin={ageMin}
      setAgeMin={setAgeMin}
      ageMax={ageMax}
      setAgeMax={setAgeMax}
      minRating={minRating}
      setMinRating={setMinRating}
      availabilityFilter={availabilityFilter}
      setAvailabilityFilter={setAvailabilityFilter}
      badgeFilter={badgeFilter}
      setBadgeFilter={setBadgeFilter}
    />
  );

  const resultsNode = (
    <>
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
              const badges = badgesForInfluencer(inf, lang, newBadgeMaxDays);

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
    </>
  );

  return (
    <div className={useSidebarLayout ? "lg:flex lg:items-start lg:gap-8" : undefined}>
      {filtersNode}
      <div className={useSidebarLayout ? "min-w-0 flex-1" : undefined}>{resultsNode}</div>
    </div>
  );
}
