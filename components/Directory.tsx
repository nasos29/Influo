"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import InfluencerCard from "./InfluencerCard";
import { getBadges, BADGE_FILTER_TYPES, getBadgeFilterLabel, type BadgeType } from "../lib/badges";
import { getVisitorId } from "../lib/visitorId";
import { normalizeGender, type GenderValue } from "../lib/gender";
import { isAvailableStatus, trustChipsFromAccounts } from "@/lib/trustSignals";
import { publicProfilePath } from "@/lib/profileSlug";
import { CATEGORIES, categoriesMatchFilter, categoryTranslations, parseStoredCategories } from "@/lib/categories";
import {
  badgeMinRateFromTier,
  budgetTierMatches,
  DIRECTORY_BUDGET_CAPS,
} from "@/lib/publicInfluencer";
import { resolveCompletionRate } from "@/lib/completionRate";

const CATEGORY_KEYS = new Set<string>(CATEGORIES);
const PAGE_SIZE = 40;

function categoryFromSearchParam(raw: string | null): string {
  if (!raw) return "All";
  return CATEGORY_KEYS.has(raw) ? raw : "All";
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
  avg_likes?: string | { [key: string]: string };
  engagement_rate?: string | { [key: string]: string };
  /** Server-side bracket. Exact prices stay off this public payload. */
  price_tier?: string | null;
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

const t = {
  el: {
    searchPlace: "Αναζήτηση ονόματος...",
    locPlace: "Τοποθεσία (π.χ. Αθήνα)",
    results: "Αποτελέσματα",
    clear: "Καθαρισμός",
    filters: "Φίλτρα",
    platAll: "Πλατφόρμα: Όλες",
    catAll: "Κατηγορία: Όλες",
    genAll: "Φύλο: Όλα",
    genFem: "Γυναίκα",
    genMal: "Άνδρας",
    genAi: "AI (Artificial Intelligence)",
    follAll: "Ακόλουθοι: Όλοι",
    follNano: "Nano (1k-10k)",
    follMicro: "Micro (10k-100k)",
    follMacro: "Macro (100k+)",
    budAll: "Προϋπολογισμός: Όλα",
    budUpTo: "Έως",
    budUnlimited: "5000€+ (VIP)",
    engAll: "Αλληλεπίδραση: Όλα",
    engMin: "Ελάχ.",
    engGood: "Καλό",
    engHigh: "Υψηλό",
    langAll: "Γλώσσα: Όλες",
    ratingAll: "Αξιολόγηση: Όλες",
    ratingMin: "Ελάχ.",
    badgeAll: "Badge: Όλα",
    ageAll: "Ηλικία: Όλες",
    ageRange: "Ηλικία",
    ageFrom: "Από",
    ageTo: "Έως",
    availAll: "Διαθεσιμότητα: Όλες",
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
    searchPlace: "Search name...",
    locPlace: "Location (e.g. Athens)",
    results: "Results",
    clear: "Clear",
    filters: "Filters",
    platAll: "Platform: All",
    catAll: "Category: All",
    genAll: "Gender: Any",
    genFem: "Female",
    genMal: "Male",
    genAi: "AI (Artificial Intelligence)",
    follAll: "Followers: Any",
    follNano: "Nano (1k-10k)",
    follMicro: "Micro (10k-100k)",
    follMacro: "Macro (100k+)",
    budAll: "Budget: Any",
    budUpTo: "Up to",
    budUnlimited: "5000€+ (VIP)",
    engAll: "Engage: Any",
    engMin: "Min",
    engGood: "Good",
    engHigh: "High",
    langAll: "Language: All",
    ratingAll: "Rating: Any",
    ratingMin: "Min",
    badgeAll: "Badge: Any",
    ageAll: "Age: All",
    ageRange: "Age",
    ageFrom: "From",
    ageTo: "To",
    availAll: "Availability: Any",
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

const parseEngagement = (rate?: string | { [key: string]: string }) => {
  if (!rate) return 0;
  if (typeof rate === "object" && rate !== null && !Array.isArray(rate)) {
    const rates = Object.values(rate).filter((v) => v && v !== "-");
    if (rates.length === 0) return 0;
    const parsedRates = rates.map((r) => parseFloat(r.replace("%", "").replace(",", ".")) || 0);
    return parsedRates.reduce((acc, val) => acc + val, 0) / parsedRates.length;
  }
  if (typeof rate === "string") {
    return parseFloat(rate.replace("%", "").replace(",", ".")) || 0;
  }
  return 0;
};

const getMaxFollowers = (followers: { [key: string]: number | undefined }) => {
  const values = Object.values(followers).filter((v): v is number => v !== undefined);
  return values.length ? Math.max(...values) : 0;
};

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

const normalizeLocation = (s: string): string => {
  if (!s || typeof s !== "string") return "";
  const lower = s.toLowerCase().trim();
  return lower
    .replace(/ά/g, "α")
    .replace(/έ/g, "ε")
    .replace(/ή/g, "η")
    .replace(/ί/g, "ι")
    .replace(/ό/g, "ο")
    .replace(/ύ/g, "υ")
    .replace(/ώ/g, "ω")
    .replace(/ϊ/g, "ι")
    .replace(/ϋ/g, "υ");
};

const pillSelect =
  "w-full appearance-none rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 cursor-pointer";
const pillInput =
  "w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900";

export default function Directory({
  lang = "el",
  initialInfluencers = [],
  homeLimit,
  onDisplayedIdsChange,
}: {
  lang?: "el" | "en";
  initialInfluencers?: Influencer[];
  /** Homepage preview: show only this many cards, no pagination. */
  homeLimit?: number;
  /** Fired when the visible preview card ids change (home preview). */
  onDisplayedIdsChange?: (ids: string[]) => void;
}) {
  const [influencers, setInfluencers] = useState<Influencer[]>(initialInfluencers);
  const txt = t[lang];
  const isMountedRef = useRef(true);
  const router = useRouter();
  const pathname = usePathname() || "/directory";
  const searchParams = useSearchParams();
  const skipPageResetRef = useRef(true);
  const isHomePreview = typeof homeLimit === "number" && homeLimit > 0;

  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState(() =>
    categoryFromSearchParam(searchParams.get("category"))
  );
  const [genderFilter, setGenderFilter] = useState("All");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [followerRange, setFollowerRange] = useState("All");
  const [budgetMax, setBudgetMax] = useState("All");
  const [minEngagement, setMinEngagement] = useState("All");
  const [languageFilter, setLanguageFilter] = useState("All");
  const [minRating, setMinRating] = useState("All");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [badgeFilter, setBadgeFilter] = useState<BadgeType | "All">("All");
  const [availabilityFilter, setAvailabilityFilter] = useState<"All" | "available" | "unavailable">(
    "available"
  );
  const [loading, setLoading] = useState(initialInfluencers.length === 0);
  const [page, setPage] = useState(() => pageFromSearchParam(searchParams.get("page")));

  const sortInfluencers = (influencersList: Influencer[]): Influencer[] => {
    return [...influencersList].sort((a, b) => {
      const aAge = a.created_at
        ? Math.floor((new Date().getTime() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      const bAge = b.created_at
        ? Math.floor((new Date().getTime() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      const aIsNew = aAge < 30;
      const bIsNew = bAge < 30;

      if (aIsNew && !bIsNew) return -1;
      if (!aIsNew && bIsNew) return 1;

      if (a.created_at && b.created_at) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (a.created_at) return -1;
      if (b.created_at) return 1;
      return 0;
    });
  };

  useEffect(() => {
    isMountedRef.current = true;

    const fetchReal = async () => {
      try {
        const response = await fetch("/api/influencers/public");
        const result = await response.json();

        if (!isMountedRef.current) return;

        if (!response.ok || result.error) {
          if (isMountedRef.current) {
            setInfluencers([]);
            setLoading(false);
          }
          return;
        }

        const data = result.data || [];

        if (data.length > 0) {
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
              platform: "Instagram",
              gender: normalizeGender(inf.gender),
              location: inf.location,
              price_tier: inf.price_tier || "0",
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

          if (isMountedRef.current) {
            setInfluencers(sortInfluencers(realInfluencers));
          }
        } else if (isMountedRef.current) {
          setInfluencers([]);
        }
      } catch (_err) {
        if (isMountedRef.current) {
          setInfluencers([]);
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchReal();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const filtered = influencers.filter((inf) => {
    const searchMatch =
      inf.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inf.bio.toLowerCase().includes(searchQuery.toLowerCase());
    const locationMatch =
      locationQuery === "" ||
      (inf.location && normalizeLocation(inf.location).includes(normalizeLocation(locationQuery)));

    const platformMatch =
      platformFilter === "All" ||
      (inf.socials && inf.socials[platformFilter.toLowerCase()] !== undefined);
    const categoryMatch = categoriesMatchFilter(inf.categories, categoryFilter);
    const genderMatch = genderFilter === "All" || inf.gender === genderFilter;

    let followerMatch = true;
    const maxFollowers = getMaxFollowers(inf.followers);
    if (followerRange === "Nano") followerMatch = maxFollowers > 1000 && maxFollowers < 10000;
    if (followerRange === "Micro") followerMatch = maxFollowers >= 10000 && maxFollowers < 100000;
    if (followerRange === "Macro") followerMatch = maxFollowers >= 100000;

    const budgetMatch = budgetTierMatches(inf.price_tier, budgetMax);

    let engageMatch = true;
    if (minEngagement !== "All") {
      const min = parseFloat(minEngagement);
      const rate = parseEngagement(inf.engagement_rate);
      if (rate < min) engageMatch = false;
    }

    let languageMatch = true;
    if (languageFilter !== "All") {
      if (!inf.languages || !Array.isArray(inf.languages) || inf.languages.length === 0) {
        languageMatch = false;
      } else {
        const selectedLang = LANGUAGES.find((l) => l.code === languageFilter);
        if (!selectedLang) {
          languageMatch = false;
        } else {
          const matches = inf.languages.some((langItem) => {
            const langStr = langItem.toString().toLowerCase().trim();
            const selectedEl = selectedLang.el.toLowerCase();
            const selectedEn = selectedLang.en.toLowerCase();
            const selectedCode = selectedLang.code.toLowerCase();
            return (
              langStr === selectedCode ||
              langStr === selectedEl ||
              langStr === selectedEn ||
              langStr.includes(selectedEl) ||
              langStr.includes(selectedEn) ||
              selectedEl.includes(langStr) ||
              selectedEn.includes(langStr)
            );
          });
          if (!matches) languageMatch = false;
        }
      }
    }

    let ratingMatch = true;
    if (minRating !== "All") {
      const min = parseFloat(minRating);
      const rating = (inf as any).avg_rating || 0;
      if (rating < min) ratingMatch = false;
    }

    let ageMatch = true;
    const age = typeof inf.age === "number" ? inf.age : null;
    if (ageMin !== "" || ageMax !== "") {
      const min = ageMin !== "" ? parseInt(ageMin, 10) : 0;
      const max = ageMax !== "" ? parseInt(ageMax, 10) : 999;
      if (age === null) ageMatch = false;
      else if (age < min || age > max) ageMatch = false;
    }

    const badgeMatch =
      badgeFilter === "All" || badgesForInfluencer(inf, lang).some((b) => b.type === badgeFilter);

    let availabilityMatch = true;
    if (availabilityFilter === "available") {
      availabilityMatch = isAvailableStatus(inf.availability_status);
    } else if (availabilityFilter === "unavailable") {
      availabilityMatch = !isAvailableStatus(inf.availability_status);
    }

    return (
      searchMatch &&
      locationMatch &&
      platformMatch &&
      categoryMatch &&
      genderMatch &&
      followerMatch &&
      budgetMatch &&
      engageMatch &&
      languageMatch &&
      ratingMatch &&
      ageMatch &&
      badgeMatch &&
      availabilityMatch
    );
  });

  const replaceUrlParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
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
    [pathname, router, searchParams]
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
    const fromUrlCat = categoryFromSearchParam(searchParams.get("category"));
    setCategoryFilter((prev) => (prev === fromUrlCat ? prev : fromUrlCat));
    const fromUrlPage = pageFromSearchParam(searchParams.get("page"));
    setPage((prev) => (prev === fromUrlPage ? prev : fromUrlPage));
  }, [searchParams]);

  const clearFilters = () => {
    setSearchQuery("");
    setLocationQuery("");
    setPlatformFilter("All");
    setCategoryFilterAndUrl("All");
    setGenderFilter("All");
    setFollowerRange("All");
    setBudgetMax("All");
    setMinEngagement("All");
    setLanguageFilter("All");
    setMinRating("All");
    setAgeMin("");
    setAgeMax("");
    setBadgeFilter("All");
    setAvailabilityFilter("available");
    setPage(1);
  };

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
    minRating,
    ageMin,
    ageMax,
    badgeFilter,
    availabilityFilter,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const displayedInfluencers = isHomePreview
    ? filtered.slice(0, homeLimit)
    : filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[140px] flex-1 sm:min-w-[160px] sm:flex-none sm:w-44">
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className={pillSelect}
            >
              <option value="All">{txt.platAll}</option>
              <option value="Instagram">Instagram</option>
              <option value="TikTok">TikTok</option>
              <option value="YouTube">YouTube</option>
            </select>
          </div>
          <div className="min-w-[140px] flex-1 sm:min-w-[160px] sm:flex-none sm:w-52">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilterAndUrl(e.target.value)}
              className={pillSelect}
            >
              <option value="All">{txt.catAll}</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {categoryTranslations[cat] ? categoryTranslations[cat][lang] : cat}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors ${
              showAdvanced
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            <FilterIcon /> {txt.filters} <ChevronDown />
          </button>
          <span className="ml-auto hidden text-xs font-medium text-slate-400 sm:inline">
            {filtered.length} {txt.results}
          </span>
        </div>

        <div
          className={`overflow-hidden transition-all duration-300 ${
            showAdvanced ? "max-h-[720px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6 pt-1">
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

            <select
              value={budgetMax}
              onChange={(e) => setBudgetMax(e.target.value)}
              className={pillSelect}
            >
              <option value="All">{txt.budAll}</option>
              {DIRECTORY_BUDGET_CAPS.map((cap) => (
                <option key={cap} value={String(cap)}>
                  {txt.budUpTo} {cap}€
                </option>
              ))}
              <option value="Unlimited">{txt.budUnlimited}</option>
            </select>

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

            <select
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
              className={pillSelect}
            >
              <option value="All">{txt.langAll}</option>
              {LANGUAGES.map((langItem) => (
                <option key={langItem.code} value={langItem.code}>
                  {langItem[lang]}
                </option>
              ))}
            </select>

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

            <div className="col-span-2 flex items-center gap-2 md:col-span-2 lg:col-span-2">
              <span className="shrink-0 text-xs font-semibold text-slate-500">{txt.ageRange}</span>
              <input
                type="number"
                min={18}
                max={99}
                placeholder={txt.ageFrom}
                value={ageMin}
                onChange={(e) => setAgeMin(e.target.value)}
                className={`${pillSelect} !py-2`}
              />
              <span className="text-slate-300">–</span>
              <input
                type="number"
                min={18}
                max={99}
                placeholder={txt.ageTo}
                value={ageMax}
                onChange={(e) => setAgeMax(e.target.value)}
                className={`${pillSelect} !py-2`}
              />
            </div>

            <div className="relative col-span-2 md:col-span-1 lg:col-span-2">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <LocationIcon />
              </div>
              <input
                type="text"
                placeholder={txt.locPlace}
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                className={pillInput}
              />
            </div>

            <div className="relative col-span-2 md:col-span-1 lg:col-span-2">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <SearchIcon />
              </div>
              <input
                type="text"
                placeholder={txt.searchPlace}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={pillInput}
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-slate-400 sm:hidden">
              {filtered.length} {txt.results}
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
            >
              {txt.clear}
            </button>
          </div>
        </div>
      </div>

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
      ) : filtered.length > 0 ? (
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
                    location={inf.location}
                    price_tier={inf.price_tier}
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
