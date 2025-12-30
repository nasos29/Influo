"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import InfluencerCard from "./InfluencerCard";
import { getBadges } from "../lib/badges";

export interface Influencer {
  id: string | number;
  name: string;
  bio: string;
  avatar: string;
  verified: boolean;
  socials: { [key: string]: string | undefined };
  followers: { [key: string]: number | undefined };
  categories: string[];
  platform: string;
  gender: "Male" | "Female";
  videos?: string[];
  location?: string;
  languages?: string;
  min_rate?: string;
  avg_likes?: string; 
  engagement_rate?: string;
  rate_card?: { story?: string; post?: string; reel?: string; facebook?: string };
  past_brands?: any[] | number;
  total_reviews?: number;
  avg_rating?: number;
  created_at?: string;
}

// --- FULL CATEGORY LIST ---
const CATEGORIES = [
  "Γενικά", "Lifestyle", "Fashion & Style", "Beauty & Makeup", "Travel", "Food & Drink",
  "Health & Fitness", "Tech & Gadgets", "Business & Finance", "Gaming & Esports",
  "Parenting & Family", "Home & Decor", "Pets & Animals", "Comedy & Entertainment",
  "Art & Photography", "Music & Dance", "Education & Coaching", "Sports & Athletes",
  "DIY & Crafts", "Sustainability & Eco", "Cars & Automotive"
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
    ratingAll: "Αξιολόγηση: Όλες",
    ratingMin: "Ελάχ.",
    noResults: "Δεν βρέθηκαν influencers",
    adjust: "Δοκίμασε διαφορετικά φίλτρα.",
    reset: "Επαναφορά"
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
    ratingAll: "Rating: Any",
    ratingMin: "Min",
    noResults: "No influencers found",
    adjust: "Try adjusting your filters.",
    reset: "Reset Filters"
  }
};

// --- FULL DUMMY DATA (8 PROFILES) ---
export const dummyInfluencers: Influencer[] = [
  {
    id: "dummy-1",
    name: "Μαρία Παπαδοπούλου",
    bio: "Beauty & lifestyle creator. Λατρεύω τα ταξίδια και το skincare.",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
    verified: true,
    socials: { instagram: "maria_pap", tiktok: "maria.tok" },
    followers: { instagram: 12000, tiktok: 54000 },
    categories: ["Beauty", "Lifestyle"],
    platform: "Instagram",
    gender: "Female",
    location: "Athens, Greece",
    min_rate: "150",
    rate_card: { story: "80€", post: "150€", reel: "200€", facebook: "120€" },
    engagement_rate: "4.5%",
    avg_likes: "2.5k",
    past_brands: 8,
    total_reviews: 12,
    avg_rating: 4.8,
    created_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(), // 120 days ago
  },
  {
    id: "dummy-2",
    name: "Nikos Tech",
    bio: "Tech reviewer, gadgets & unboxing. Όλα για την τεχνολογία.",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
    verified: true,
    socials: { instagram: "nikos.tech", youtube: "nikostech" },
    followers: { instagram: 8700, youtube: 150000 },
    categories: ["Tech"],
    platform: "YouTube",
    gender: "Male",
    location: "Thessaloniki, Greece",
    min_rate: "300",
    rate_card: { story: "200€", post: "300€", reel: "400€", facebook: "250€" },
    engagement_rate: "2.1%",
    avg_likes: "15k",
    past_brands: 15,
    total_reviews: 25,
    avg_rating: 4.6,
    created_at: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString(), // 300 days ago
  },
  {
    id: "dummy-3",
    name: "Ελένη Fitness",
    bio: "Fitness coach & nutrition tips. Υγιεινή διατροφή για όλους.",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    verified: false,
    socials: { instagram: "eleni_fit", tiktok: "eleni_tok" },
    followers: { instagram: 15000, tiktok: 32000 },
    categories: ["Fitness", "Lifestyle"],
    platform: "Instagram",
    gender: "Female",
    location: "Athens, Greece",
    min_rate: "100",
    rate_card: { story: "50€", post: "100€", reel: "150€", facebook: "80€" },
    engagement_rate: "6.8%",
    avg_likes: "1.2k",
    past_brands: 3,
    total_reviews: 5,
    avg_rating: 4.2,
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days ago - Rising
  },
  {
    id: "dummy-4",
    name: "Γιώργος Travel",
    bio: "Travel vlogger, κόσμος & εμπειρίες. Backpacking around the world.",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
    verified: true,
    socials: { youtube: "gtravel", instagram: "george_tr" },
    followers: { youtube: 45000, instagram: 22000 },
    categories: ["Travel"],
    platform: "YouTube",
    gender: "Male",
    location: "Remote",
    min_rate: "500",
    rate_card: { story: "300€", post: "500€", reel: "700€", facebook: "400€" },
    engagement_rate: "3.2%",
    avg_likes: "5k",
    past_brands: 22,
    total_reviews: 35,
    avg_rating: 4.7,
    created_at: new Date(Date.now() - 450 * 24 * 60 * 60 * 1000).toISOString(), // 450 days ago
  },
   {
    id: "dummy-5",
    name: "Sofia Fashion",
    bio: "Fashion model & OOTD inspiration. Zara & H&M Hauls.",
    avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80",
    verified: true,
    socials: { tiktok: "sofia_fash", instagram: "sofia_style" },
    followers: { tiktok: 100000, instagram: 45000 },
    categories: ["Lifestyle", "Beauty"],
    platform: "TikTok",
    gender: "Female",
    location: "Athens, GR",
    min_rate: "250",
    rate_card: { story: "150€", post: "250€", reel: "350€", facebook: "200€" },
    engagement_rate: "5.5%",
    avg_likes: "12k",
    past_brands: 6,
    total_reviews: 10,
    avg_rating: 4.5,
    created_at: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(), // 200 days ago
  },
  {
    id: "dummy-6",
    name: "Katerina Gaming",
    bio: "Pro gamer & streamer. LoL & Valorant highlights.",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80",
    verified: true,
    socials: { youtube: "katerina_gaming" }, 
    followers: { youtube: 32000 },
    categories: ["Gaming"],
    platform: "YouTube",
    gender: "Female",
    location: "Athens, GR",
    min_rate: "200",
    rate_card: { story: "120€", post: "200€", reel: "280€", facebook: "160€" },
    engagement_rate: "4.1%",
    avg_likes: "3k",
    past_brands: 4,
    total_reviews: 7,
    avg_rating: 4.3,
    created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(), // 180 days ago
  },
  {
    id: "dummy-7",
    name: "Dimitris Crypto",
    bio: "Crypto analysis & web3 news. Bitcoin daily updates.",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
    verified: true,
    socials: { youtube: "dimitris_btc" },
    followers: { youtube: 12000 },
    categories: ["Tech", "Business"],
    platform: "YouTube",
    gender: "Male",
    location: "Cyprus",
    min_rate: "400",
    rate_card: { story: "250€", post: "400€", reel: "550€", facebook: "320€" },
    engagement_rate: "8.5%",
    avg_likes: "1.5k",
    past_brands: 12,
    total_reviews: 18,
    avg_rating: 4.9,
    created_at: new Date(Date.now() - 250 * 24 * 60 * 60 * 1000).toISOString(), // 250 days ago
  },
  {
    id: "dummy-8",
    name: "Elena VIP",
    bio: "TV Host & Celebrity Influencer. Luxury Lifestyle.",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
    verified: true,
    socials: { instagram: "elena_vip" },
    followers: { instagram: 500000 },
    categories: ["Lifestyle", "Fashion"],
    platform: "Instagram",
    gender: "Female",
    location: "Athens, GR",
    min_rate: "1500",
    rate_card: { story: "800€", post: "1500€", reel: "2000€", facebook: "1000€" },
    engagement_rate: "3.5%",
    avg_likes: "45k",
    past_brands: 55,
    total_reviews: 85,
    avg_rating: 4.9,
    created_at: new Date(Date.now() - 600 * 24 * 60 * 60 * 1000).toISOString(), // 600 days ago - VIP
  }
];

// --- ICONS ---
const SearchIcon = () => <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>;
const LocationIcon = () => <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>;
const FilterIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>;
const ChevronDown = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>;

// --- HELPERS ---
const parsePrice = (price?: string) => price ? parseFloat(price.replace(/[^0-9.]/g, '')) : 0;
const parseEngagement = (rate?: string) => rate ? parseFloat(rate.replace('%', '')) : 0;
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

export default function Directory({ lang = "el" }: { lang?: "el" | "en" }) {
  const [influencers, setInfluencers] = useState<Influencer[]>(dummyInfluencers);
  const txt = t[lang];

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
  const [minRating, setMinRating] = useState("All");

  useEffect(() => {
    const fetchReal = async () => {
      const { data } = await supabase.from("influencers").select("*").eq('verified', true);
      if (data) {
         const realInfluencers: Influencer[] = data.map((inf: any) => {
          
          const socialsObj: { [key: string]: string } = {};
          const followersObj: { [key: string]: number } = {};

          if (Array.isArray(inf.accounts)) {
            inf.accounts.forEach((acc: any) => {
              if (acc.platform && acc.username) {
                  const key = acc.platform.toLowerCase();
                  socialsObj[key] = acc.username;
                  followersObj[key] = parseFollowerString(acc.followers);
              }
            });
          }

          return {
            id: inf.id,
            name: inf.display_name,
            bio: inf.bio || "",
            avatar: inf.avatar_url || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=400&q=80",
            verified: inf.verified,
            socials: socialsObj,
            followers: followersObj,
            categories: [inf.category || "New"], 
            platform: "Instagram",
            gender: inf.gender || "Female",
            location: inf.location,
            min_rate: inf.min_rate,
            avg_likes: inf.avg_likes,
            engagement_rate: inf.engagement_rate,
            videos: Array.isArray(inf.videos) ? inf.videos : [],
            avg_rating: inf.avg_rating || 0,
            total_reviews: inf.total_reviews || 0,
            avg_response_time: inf.avg_response_time || 24,
            completion_rate: inf.completion_rate || 100,
            past_brands: inf.past_brands || 0,
            created_at: inf.created_at,
          };
        });
        setInfluencers([...dummyInfluencers, ...realInfluencers]);
      }
    };
    fetchReal();
  }, []);

  const filtered = influencers.filter((inf) => {
    const searchMatch = inf.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        inf.bio.toLowerCase().includes(searchQuery.toLowerCase());
    const locationMatch = locationQuery === "" || 
                          (inf.location && inf.location.toLowerCase().includes(locationQuery.toLowerCase()));
    
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

    let ratingMatch = true;
    if (minRating !== "All") {
        const min = parseFloat(minRating);
        const rating = (inf as any).avg_rating || 0;
        if (rating < min) ratingMatch = false;
    }

    return searchMatch && locationMatch && platformMatch && categoryMatch && genderMatch && followerMatch && budgetMatch && engageMatch && ratingMatch;
  });

  const clearFilters = () => {
    setSearchQuery(""); setLocationQuery(""); setPlatformFilter("All");
    setCategoryFilter("All"); setGenderFilter("All"); setFollowerRange("All");
    setBudgetMax("All"); setMinEngagement("All"); setMinRating("All");
  };

  const selectClass = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer";

  return (
    <div>
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 mb-10 transition-all duration-300 hover:shadow-xl hover:border-blue-200">
        
        {/* Search Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
            <div className="md:col-span-5 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                <input type="text" placeholder={txt.searchPlace} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-4 relative">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><LocationIcon /></div>
                <input type="text" placeholder={txt.locPlace} value={locationQuery} onChange={(e) => setLocationQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:ring-2 focus:ring-blue-500" />
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
                
                <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className={selectClass}>
                    <option value="All">{txt.platAll}</option>
                    <option value="Instagram">Instagram</option>
                    <option value="TikTok">TikTok</option>
                    <option value="YouTube">YouTube</option>
                </select>

                {/* FULL CATEGORY LIST USED HERE */}
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectClass}>
                    <option value="All">{txt.catAll}</option>
                    {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>
                            {categoryTranslations[cat] ? categoryTranslations[cat][lang] : cat}
                        </option>
                    ))}
                </select>

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
                
                <select value={minRating} onChange={(e) => setMinRating(e.target.value)} className={`${selectClass} !bg-amber-50 !border-amber-100 !text-amber-800`}>
                    <option value="All">{txt.ratingAll}</option>
                    <option value="3">{txt.ratingMin} 3★</option>
                    <option value="4">{txt.ratingMin} 4★</option>
                    <option value="4.5">{txt.ratingMin} 4.5★</option>
                </select>
            </div>
            
            <div className="mt-4 flex justify-between items-center">
                <p className="text-xs text-slate-400">{filtered.length} {txt.results}</p>
                <button onClick={clearFilters} className="text-sm text-red-500 hover:text-red-700 font-medium underline">{txt.clear}</button>
            </div>
        </div>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {filtered.map((inf) => {
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
                <Link href={`/influencer/${inf.id}`} key={inf.id} className="block h-full group">
                  <InfluencerCard {...inf} badges={badges} lang={lang} />
                </Link>
              );
            })}
        </div>
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