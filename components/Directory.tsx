"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import InfluencerCard from "./InfluencerCard";
import { getBadges } from "../lib/badges";

export interface Influencer {
  id: string | number;
  name: string;
  bio: string;
  bio_en?: string | null; // English bio translation
  avatar: string;
  verified: boolean;
  socials: { [key: string]: string | undefined };
  followers: { [key: string]: number | undefined };
  categories: string[];
  platform: string;
  gender: "Male" | "Female";
  videos?: string[];
  location?: string;
  languages?: string[];
  min_rate?: string;
  avg_likes?: string | { [key: string]: string }; // Can be per-platform object or legacy string
  engagement_rate?: string | { [key: string]: string }; // Can be per-platform object or legacy string
  rate_card?: { story?: string; post?: string; reel?: string; facebook?: string };
  past_brands?: any[] | number;
  total_reviews?: number;
  avg_rating?: number;
  created_at?: string;
  birth_date?: string | null;
}

// --- FULL CATEGORY LIST ---
const CATEGORIES = [
  "Γενικά", "Lifestyle", "Fashion & Style", "Beauty & Makeup", "Travel", "Food & Drink",
  "Health & Fitness", "Tech & Gadgets", "Business & Finance", "Gaming & Esports",
  "Parenting & Family", "Home & Decor", "Pets & Animals", "Comedy & Entertainment",
  "Art & Photography", "Music & Dance", "Education & Coaching", "Sports & Athletes",
  "DIY & Crafts", "Sustainability & Eco", "Cars & Automotive"
];

// Languages list
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
  { code: "bg", el: "Βουλγαρικά", en: "Bulgarian" }
];

// Category translations
const categoryTranslations: { [key: string]: { el: string; en: string } } = {
  "Lifestyle": { el: "Lifestyle", en: "Lifestyle" },
  "Fashion & Style": { el: "Μόδα & Στυλ", en: "Fashion & Style" },
  "Beauty & Makeup": { el: "Ομορφιά & Μακιγιάζ", en: "Beauty & Makeup" },
  "Travel": { el: "Ταξίδια", en: "Travel" },
  "Food & Drink": { el: "Φαγητό & Ποτά", en: "Food & Drink" },
  "Health & Fitness": { el: "Υγεία & Fitness", en: "Health & Fitness" },
  "Tech & Gadgets": { el: "Τεχνολογία & Gadgets", en: "Tech & Gadgets" },
  "Business & Finance": { el: "Επιχειρήσεις & Οικονομικά", en: "Business & Finance" },
  "Gaming & Esports": { el: "Gaming & Esports", en: "Gaming & Esports" },
  "Parenting & Family": { el: "Οικογένεια & Παιδιά", en: "Parenting & Family" },
  "Home & Decor": { el: "Σπίτι & Διακόσμηση", en: "Home & Decor" },
  "Pets & Animals": { el: "Κατοικίδια & Ζώα", en: "Pets & Animals" },
  "Comedy & Entertainment": { el: "Κωμωδία & Ψυχαγωγία", en: "Comedy & Entertainment" },
  "Art & Photography": { el: "Τέχνη & Φωτογραφία", en: "Art & Photography" },
  "Music & Dance": { el: "Μουσική & Χορός", en: "Music & Dance" },
  "Education & Coaching": { el: "Εκπαίδευση & Coaching", en: "Education & Coaching" },
  "Sports & Athletes": { el: "Αθλήματα & Αθλητές", en: "Sports & Athletes" },
  "DIY & Crafts": { el: "DIY & Χειροτεχνίες", en: "DIY & Crafts" },
  "Sustainability & Eco": { el: "Βιωσιμότητα & Οικολογία", en: "Sustainability & Eco" },
  "Cars & Automotive": { el: "Αυτοκίνητα", en: "Cars & Automotive" },
  "Γενικά": { el: "Γενικά", en: "General" },
};

// --- FULL TRANSLATIONS ---
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
    ageAll: "Ηλικία: Όλες",
    ageRange: "Ηλικία",
    ageFrom: "Από",
    ageTo: "Έως",
    noResults: "Δεν βρέθηκαν influencers",
    adjust: "Δοκίμασε διαφορετικά φίλτρα.",
    reset: "Επαναφορά",
    seeMore: "Δείτε Περισσότερους"
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
    ageAll: "Age: All",
    ageRange: "Age",
    ageFrom: "From",
    ageTo: "To",
    noResults: "No influencers found",
    adjust: "Try adjusting your filters.",
    reset: "Reset Filters",
    seeMore: "See More"
  }
};

// --- ICONS ---
const SearchIcon = () => <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>;
const LocationIcon = () => <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>;
const FilterIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>;
const ChevronDown = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>;

// --- HELPERS ---
const parsePrice = (price?: string) => price ? parseFloat(price.replace(/[^0-9.]/g, '')) : 0;
const parseEngagement = (rate?: string | { [key: string]: string }) => {
  if (!rate) return 0;
  
  // If it's an object (per-platform), calculate average or use first available
  if (typeof rate === 'object' && rate !== null && !Array.isArray(rate)) {
    const rates = Object.values(rate).filter(v => v && v !== '-');
    if (rates.length === 0) return 0;
    
    // Parse all rates and calculate average
    const parsedRates = rates.map(r => parseFloat(r.replace('%', '').replace(',', '.')) || 0);
    const sum = parsedRates.reduce((acc, val) => acc + val, 0);
    return sum / parsedRates.length;
  }
  
  // Legacy string format - rate is guaranteed to be string here
  if (typeof rate === 'string') {
    return parseFloat(rate.replace('%', '').replace(',', '.')) || 0;
  }
  
  return 0;
};
const getMaxFollowers = (followers: any) => {
    const values = Object.values(followers).filter((v): v is number => v !== undefined);
    return values.length ? Math.max(...values as number[]) : 0;
};
const parseFollowerString = (str: string) => {
    if (!str) return 0;
    const clean = str.toLowerCase().replace(/,/g, '').trim();
    if (clean.includes('k')) return parseFloat(clean) * 1000;
    if (clean.includes('m')) return parseFloat(clean) * 1000000;
    return parseFloat(clean) || 0;
};
const getAgeFromBirthDate = (birthDate?: string | null): number | null => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
};

/** Κανονικοποίηση για σύγκριση τοποθεσίας: lowercase + αφαίρεση τόνων (αθήνα = αθηνα = Αθήνα) */
const normalizeLocation = (s: string): string => {
  if (!s || typeof s !== 'string') return '';
  const lower = s.toLowerCase().trim();
  const noAccent = lower
    .replace(/ά/g, 'α').replace(/έ/g, 'ε').replace(/ή/g, 'η').replace(/ί/g, 'ι')
    .replace(/ό/g, 'ο').replace(/ύ/g, 'υ').replace(/ώ/g, 'ω')
    .replace(/ϊ/g, 'ι').replace(/ϋ/g, 'υ');
  return noAccent;
};

export default function Directory({ lang = "el" }: { lang?: "el" | "en" }) {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const txt = t[lang];
  const isMountedRef = useRef(true);

  // FILTERS
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [genderFilter, setGenderFilter] = useState("All");
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [followerRange, setFollowerRange] = useState("All");
  const [budgetMax, setBudgetMax] = useState("All");
  const [minEngagement, setMinEngagement] = useState("All");
  const [languageFilter, setLanguageFilter] = useState("All");
  const [minRating, setMinRating] = useState("All");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(20);
  const PAGE_SIZE = 20;

  // Sort function: "New" influencers first, then by created_at descending
  const sortInfluencers = (influencersList: Influencer[]): Influencer[] => {
    return [...influencersList].sort((a, b) => {
      const aAge = a.created_at ? Math.floor((new Date().getTime() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 999;
      const bAge = b.created_at ? Math.floor((new Date().getTime() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 999;
      
      const aIsNew = aAge < 30;
      const bIsNew = bAge < 30;
      
      // If one is "New" and the other isn't, prioritize the "New" one
      if (aIsNew && !bIsNew) return -1;
      if (!aIsNew && bIsNew) return 1;
      
      // If both are "New" or both are not "New", sort by created_at descending (newest first)
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
    setLoading(true);

    const fetchReal = async () => {
      try {
        const response = await fetch('/api/influencers/public');
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
                    // Store engagement rate per platform if available
                    if (acc.engagement_rate) {
                      engagementRatesObj[key] = acc.engagement_rate;
                    }
                }
              });
            }

            // Parse languages from comma-separated string to array
            const languagesArray = inf.languages 
              ? (typeof inf.languages === 'string' && inf.languages.includes(',') 
                ? inf.languages.split(',').map((l: string) => l.trim()) 
                : (typeof inf.languages === 'string' ? [inf.languages.trim()] : (Array.isArray(inf.languages) ? inf.languages : [])))
              : [];

            return {
              id: inf.id,
              name: inf.display_name,
              bio: inf.bio || "",
              bio_en: inf.bio_en || null,
              avatar: inf.avatar_url || null,
              verified: inf.analytics_verified || false, // Use analytics_verified for verified badge (not approved)
              socials: socialsObj,
              followers: followersObj,
              categories: inf.category 
                ? (inf.category.includes(',') ? inf.category.split(',').map((c: string) => c.trim()) : [inf.category])
                : ["New"],
              languages: languagesArray,
              platform: "Instagram",
              gender: inf.gender || "Female",
              location: inf.location,
              min_rate: inf.min_rate,
              avg_likes: inf.avg_likes,
              engagement_rate: Object.keys(engagementRatesObj).length > 0 ? engagementRatesObj : (inf.engagement_rate || undefined),
              videos: Array.isArray(inf.videos) ? inf.videos : [],
              avg_rating: inf.avg_rating || 0,
              total_reviews: inf.total_reviews || 0,
              avg_response_time: inf.avg_response_time || 24,
              completion_rate: inf.completion_rate || 100,
              past_brands: inf.past_brands || 0,
              created_at: inf.created_at,
              birth_date: inf.birth_date || null,
            };
          });

          if (isMountedRef.current) {
            setInfluencers(sortInfluencers(realInfluencers));
          }
        } else {
          if (isMountedRef.current) {
            setInfluencers([]);
          }
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
    const searchMatch = inf.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        inf.bio.toLowerCase().includes(searchQuery.toLowerCase());
    const locationMatch = locationQuery === "" ||
                          (inf.location && normalizeLocation(inf.location).includes(normalizeLocation(locationQuery)));
    
    const platformMatch = platformFilter === "All" || (inf.socials && inf.socials[platformFilter.toLowerCase()] !== undefined);
    const categoryMatch = categoryFilter === "All" || inf.categories.includes(categoryFilter);
    const genderMatch = genderFilter === "All" || inf.gender === genderFilter;

    let followerMatch = true;
    const maxFollowers = getMaxFollowers(inf.followers);
    if (followerRange === "Nano") followerMatch = maxFollowers > 1000 && maxFollowers < 10000;
    if (followerRange === "Micro") followerMatch = maxFollowers >= 10000 && maxFollowers < 100000;
    if (followerRange === "Macro") followerMatch = maxFollowers >= 100000;

    let budgetMatch = true;
    if (budgetMax !== "All") {
        const rate = parsePrice(inf.min_rate);
        if (budgetMax === "Unlimited") {
            budgetMatch = rate >= 5000;
        } else {
            const max = parseInt(budgetMax);
            if (rate > max) budgetMatch = false;
        }
    }

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
            // Find the selected language object
            const selectedLang = LANGUAGES.find(l => l.code === languageFilter);
            if (!selectedLang) {
                languageMatch = false;
            } else {
                // Check if any language in the influencer's languages matches (by code, Greek name, or English name)
                const matches = inf.languages.some(lang => {
                    const langStr = lang.toString().toLowerCase().trim();
                    const selectedEl = selectedLang.el.toLowerCase();
                    const selectedEn = selectedLang.en.toLowerCase();
                    const selectedCode = selectedLang.code.toLowerCase();
                    
                    // Check if it matches the language code, Greek name, or English name
                    return langStr === selectedCode || 
                           langStr === selectedEl || 
                           langStr === selectedEn ||
                           langStr.includes(selectedEl) ||
                           langStr.includes(selectedEn) ||
                           selectedEl.includes(langStr) ||
                           selectedEn.includes(langStr);
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
    const age = getAgeFromBirthDate(inf.birth_date);
    if (ageMin !== "" || ageMax !== "") {
        const min = ageMin !== "" ? parseInt(ageMin, 10) : 0;
        const max = ageMax !== "" ? parseInt(ageMax, 10) : 999;
        if (age === null) ageMatch = false;
        else if (age < min || age > max) ageMatch = false;
    }

    return searchMatch && locationMatch && platformMatch && categoryMatch && genderMatch && followerMatch && budgetMatch && engageMatch && languageMatch && ratingMatch && ageMatch;
  });

  const clearFilters = () => {
    setSearchQuery(""); setLocationQuery(""); setPlatformFilter("All");
    setCategoryFilter("All"); setGenderFilter("All"); setFollowerRange("All");
    setBudgetMax("All"); setMinEngagement("All"); setLanguageFilter("All"); setMinRating("All");
    setAgeMin(""); setAgeMax("");
    setVisibleCount(PAGE_SIZE);
  };

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, locationQuery, platformFilter, categoryFilter, genderFilter, followerRange, budgetMax, minEngagement, languageFilter, minRating, ageMin, ageMax]);

  const displayedInfluencers = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  const selectClass = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer";

  return (
    <div>
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 mb-10 transition-all duration-300 hover:shadow-xl hover:border-blue-200">
        
        {/* Search Row - Platform and Category Dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
            <div className="md:col-span-5">
                <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-sm font-medium">
                    <option value="All">{txt.platAll}</option>
                    <option value="Instagram">Instagram</option>
                    <option value="TikTok">TikTok</option>
                    <option value="YouTube">YouTube</option>
                </select>
            </div>
            <div className="md:col-span-4">
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-sm font-medium">
                    <option value="All">{txt.catAll}</option>
                    {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>
                            {categoryTranslations[cat] ? categoryTranslations[cat][lang] : cat}
                        </option>
                    ))}
                </select>
            </div>
            <div className="md:col-span-3 flex items-center justify-end gap-3">
                <button onClick={() => setShowAdvanced(!showAdvanced)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${showAdvanced ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <FilterIcon /> {txt.filters} <ChevronDown />
                </button>
            </div>
        </div>

        {/* Filters Panel */}
        <div className={`overflow-hidden transition-all duration-300 ${showAdvanced ? 'max-h-[500px] opacity-100 mt-4 pt-4 border-t border-slate-100' : 'max-h-0 opacity-0'}`}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                
                <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} className={selectClass}>
                    <option value="All">{txt.genAll}</option>
                    <option value="Female">{txt.genFem}</option>
                    <option value="Male">{txt.genMal}</option>
                </select>

                <select value={followerRange} onChange={(e) => setFollowerRange(e.target.value)} className={`${selectClass} !bg-blue-50 !border-blue-100 !text-blue-800`}>
                    <option value="All">{txt.follAll}</option>
                    <option value="Nano">{txt.follNano}</option>
                    <option value="Micro">{txt.follMicro}</option>
                    <option value="Macro">{txt.follMacro}</option>
                </select>

                <select value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} className={`${selectClass} !bg-green-50 !border-green-100 !text-green-800`}>
                    <option value="All">{txt.budAll}</option>
                    <option value="100">{txt.budUpTo} 100€</option>
                    <option value="200">{txt.budUpTo} 200€</option>
                    <option value="500">{txt.budUpTo} 500€</option>
                    <option value="1000">{txt.budUpTo} 1000€</option>
                    <option value="1500">{txt.budUpTo} 1500€</option>
                    <option value="2000">{txt.budUpTo} 2000€</option>
                    <option value="2500">{txt.budUpTo} 2500€</option>
                    <option value="3000">{txt.budUpTo} 3000€</option>
                    <option value="3500">{txt.budUpTo} 3500€</option>
                    <option value="4000">{txt.budUpTo} 4000€</option>
                    <option value="4500">{txt.budUpTo} 4500€</option>
                    <option value="5000">{txt.budUpTo} 5000€</option>
                    <option value="Unlimited">{txt.budUnlimited}</option>
                </select>

                <select value={minEngagement} onChange={(e) => setMinEngagement(e.target.value)} className={`${selectClass} !bg-purple-50 !border-purple-100 !text-purple-800`}>
                    <option value="All">{txt.engAll}</option>
                    <option value="1">{txt.engMin} 1%</option>
                    <option value="3">{txt.engMin} 3% ({txt.engGood})</option>
                    <option value="5">{txt.engMin} 5% ({txt.engHigh})</option>
                </select>

                <select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)} className={`${selectClass} !bg-indigo-50 !border-indigo-100 !text-indigo-800`}>
                    <option value="All">{txt.langAll}</option>
                    {LANGUAGES.map(langItem => (
                        <option key={langItem.code} value={langItem.code}>
                            {langItem[lang]}
                        </option>
                    ))}
                </select>
                
                <select value={minRating} onChange={(e) => setMinRating(e.target.value)} className={`${selectClass} !bg-amber-50 !border-amber-100 !text-amber-800`}>
                    <option value="All">{txt.ratingAll}</option>
                    <option value="3">{txt.ratingMin} 3★</option>
                    <option value="4">{txt.ratingMin} 4★</option>
                    <option value="4.5">{txt.ratingMin} 4.5★</option>
                </select>

                {/* Age filter (from birth_date) */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 whitespace-nowrap">{txt.ageRange}:</span>
                    <input type="number" min={18} max={99} placeholder={txt.ageFrom} value={ageMin} onChange={(e) => setAgeMin(e.target.value)} className={`${selectClass} !py-2`} />
                    <span className="text-slate-400">-</span>
                    <input type="number" min={18} max={99} placeholder={txt.ageTo} value={ageMax} onChange={(e) => setAgeMax(e.target.value)} className={`${selectClass} !py-2`} />
                </div>
                
                {/* Location Filter - Second to Last */}
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><LocationIcon /></div>
                    <input 
                        type="text" 
                        placeholder={txt.locPlace} 
                        value={locationQuery} 
                        onChange={(e) => setLocationQuery(e.target.value)} 
                        className={`${selectClass} pl-10`}
                    />
                </div>
                
                {/* Name Search Filter - Last */}
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                    <input 
                        type="text" 
                        placeholder={txt.searchPlace} 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                        className={`${selectClass} pl-10`}
                    />
                </div>
            </div>
            
            <div className="mt-4 flex justify-between items-center">
                <p className="text-xs text-slate-400">{filtered.length} {txt.results}</p>
                <button onClick={clearFilters} className="text-sm text-red-500 hover:text-red-700 font-medium underline">{txt.clear}</button>
            </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-slate-100 rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-[4/3] bg-slate-200" />
              <div className="p-4 space-y-3">
                <div className="h-5 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-200 rounded w-full" />
                <div className="h-3 bg-slate-200 rounded w-5/6" />
                <div className="flex gap-2 mt-3">
                  <div className="h-6 bg-slate-200 rounded-full w-16" />
                  <div className="h-6 bg-slate-200 rounded-full w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {displayedInfluencers.map((inf) => {
              // Calculate badges
              const accountAgeDays = inf.created_at ? Math.floor((new Date().getTime() - new Date(inf.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 999;
              const badges = getBadges({
                verified: inf.verified,
                followers: inf.followers,
                engagement_rate: inf.engagement_rate,
                total_reviews: inf.total_reviews || 0,
                avg_rating: (inf as any).avg_rating || 0,
                past_brands: inf.past_brands || 0,
                account_created_days: accountAgeDays,
                min_rate: inf.min_rate,
              }, lang);
              
              return (
                <Link 
                  href={`/influencer/${inf.id}`} 
                  key={inf.id} 
                  className="block h-full group"
                  onClick={async () => {
                    // Track profile_click
                    try {
                      await fetch('/api/analytics/track', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          influencerId: inf.id,
                          eventType: 'profile_click',
                          metadata: { source: 'directory' }
                        })
                      }).catch(() => {}); // Fail silently
                    } catch (err) {
                      // Fail silently
                    }
                  }}
                >
                  <InfluencerCard {...inf} badges={badges} lang={lang} />
                </Link>
              );
            })}
        </div>
        {hasMore && (
          <div className="flex justify-center mt-10">
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="px-8 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
            >
              {txt.seeMore}
            </button>
          </div>
        )}
        </>
      ) : (
        <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
          <h3 className="text-xl font-bold text-slate-900">{txt.noResults}</h3>
          <p className="text-slate-500 mb-4">{txt.adjust}</p>
          <button onClick={clearFilters} className="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold">{txt.reset}</button>
        </div>
      )}
    </div>
  );
}