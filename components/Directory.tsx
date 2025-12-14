"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import InfluencerCard from "./InfluencerCard";

// --- TYPES ---
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
}

// --- DUMMY DATA (8+ Εγγραφές για να δείχνει γεμάτο) ---
export const dummyInfluencers: Influencer[] = [
  {
    id: "dummy-1",
    name: "Μαρία Παπαδοπούλου",
    bio: "Beauty & lifestyle creator. Λατρεύω τα ταξίδια.",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
    verified: true,
    socials: { instagram: "maria_pap", tiktok: "maria.tok" },
    followers: { instagram: 12000, tiktok: 54000 },
    categories: ["Beauty", "Lifestyle"],
    platform: "Instagram",
    gender: "Female",
    location: "Athens, Greece",
    min_rate: "150€",
    engagement_rate: "4.5%",
    avg_likes: "2.5k"
  },
  {
    id: "dummy-2",
    name: "Nikos Tech",
    bio: "Tech reviewer, gadgets & unboxing.",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
    verified: true,
    socials: { instagram: "nikos.tech", youtube: "nikostech" },
    followers: { instagram: 8700, youtube: 150000 },
    categories: ["Tech"],
    platform: "YouTube",
    gender: "Male",
    location: "Thessaloniki, Greece",
    min_rate: "300€",
    engagement_rate: "2.1%",
    avg_likes: "15k"
  },
  {
    id: "dummy-3",
    name: "Ελένη Fitness",
    bio: "Fitness coach & nutrition tips.",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    verified: false,
    socials: { instagram: "eleni_fit" },
    followers: { instagram: 15000 },
    categories: ["Fitness"],
    platform: "Instagram",
    gender: "Female",
    location: "Athens, Greece",
    min_rate: "100€",
    engagement_rate: "6.8%",
    avg_likes: "1.2k"
  },
  {
    id: "dummy-4",
    name: "Γιώργος Travel",
    bio: "Travel vlogger, κόσμος & εμπειρίες.",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
    verified: true,
    socials: { youtube: "gtravel" },
    followers: { youtube: 45000 },
    categories: ["Travel"],
    platform: "YouTube",
    gender: "Male",
    location: "Remote",
    min_rate: "500€",
    engagement_rate: "3.2%",
    avg_likes: "5k"
  },
   {
    id: "dummy-5",
    name: "Sofia Fashion",
    bio: "Fashion model & OOTD inspiration.",
    avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80",
    verified: true,
    socials: { tiktok: "sofia_fash" },
    followers: { tiktok: 100000 },
    categories: ["Lifestyle", "Beauty"],
    platform: "TikTok",
    gender: "Female",
    location: "Athens, GR",
    min_rate: "250€",
    engagement_rate: "5.5%",
    avg_likes: "12k"
  },
  {
    id: "dummy-6",
    name: "Katerina Gaming",
    bio: "Pro gamer & streamer. LoL & Valorant.",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80",
    verified: true,
    socials: { twitch: "kat_gamer", youtube: "katerina_gaming" },
    followers: { twitch: 32000, youtube: 9000 },
    categories: ["Gaming"],
    platform: "YouTube",
    gender: "Female",
    location: "Athens, GR",
    min_rate: "200€",
    engagement_rate: "4.1%",
    avg_likes: "3k"
  },
  {
    id: "dummy-7",
    name: "Dimitris Crypto",
    bio: "Crypto analysis & web3 news.",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
    verified: true,
    socials: { twitter: "jim_crypto", youtube: "dimitris_btc" },
    followers: { youtube: 12000 },
    categories: ["Tech", "Business"],
    platform: "YouTube",
    gender: "Male",
    location: "Cyprus",
    min_rate: "400€",
    engagement_rate: "8.5%",
    avg_likes: "1.5k"
  },
  {
    id: "dummy-8",
    name: "Elena VIP",
    bio: "TV Host & Celebrity Influencer.",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
    verified: true,
    socials: { instagram: "elena_vip" },
    followers: { instagram: 500000 },
    categories: ["Lifestyle", "Fashion"],
    platform: "Instagram",
    gender: "Female",
    location: "Athens, GR",
    min_rate: "1500€",
    engagement_rate: "3.5%",
    avg_likes: "45k"
  }
];

// --- ICONS ---
const SearchIcon = () => <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>;
const LocationIcon = () => <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>;
const FilterIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>;
const ChevronDown = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>;

// --- HELPERS ---
const parsePrice = (price?: string) => {
    if (!price) return 0;
    return parseFloat(price.replace(/[^0-9.]/g, ''));
};
const parseEngagement = (rate?: string) => {
    if (!rate) return 0;
    return parseFloat(rate.replace('%', ''));
};
const getMaxFollowers = (followers: { [key: string]: number | undefined }) => {
    const values = Object.values(followers).filter((v): v is number => v !== undefined);
    return values.length ? Math.max(...values) : 0;
};

export default function Directory() {
  const [influencers, setInfluencers] = useState<Influencer[]>(dummyInfluencers);
  
  // BASIC FILTERS
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  
  // DROPDOWN FILTERS
  const [platformFilter, setPlatformFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [genderFilter, setGenderFilter] = useState<string>("All");

  // ADVANCED FILTERS
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [followerRange, setFollowerRange] = useState<string>("All");
  const [budgetMax, setBudgetMax] = useState<string>("All");
  const [minEngagement, setMinEngagement] = useState<string>("All");

  useEffect(() => {
    const fetchRealInfluencers = async () => {
      const { data, error } = await supabase.from("influencers").select("*").eq('verified', true);
      if (error) { console.error(error); return; }

      if (data) {
        const realInfluencers: Influencer[] = data.map((inf: any) => {
          const socialsObj: { [key: string]: string } = {};
          if (Array.isArray(inf.accounts)) {
            inf.accounts.forEach((acc: any) => {
              if (acc.platform && acc.username) socialsObj[acc.platform.toLowerCase()] = acc.username;
            });
          }
          return {
            id: inf.id,
            name: inf.display_name,
            bio: inf.bio || "",
            avatar: inf.avatar_url || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=400&q=80",
            verified: inf.verified,
            socials: socialsObj,
            followers: {}, 
            categories: ["New"],
            platform: "Instagram",
            gender: inf.gender || "Female",
            location: inf.location,
            min_rate: inf.min_rate,
            avg_likes: inf.avg_likes,
            engagement_rate: inf.engagement_rate,
            videos: Array.isArray(inf.videos) ? inf.videos : []
          };
        });
        setInfluencers([...dummyInfluencers, ...realInfluencers]);
      }
    };
    fetchRealInfluencers();
  }, []);

  // --- LOGIC ---
  const filtered = influencers.filter((inf) => {
    const searchMatch = inf.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        inf.bio.toLowerCase().includes(searchQuery.toLowerCase());
    const locationMatch = locationQuery === "" || 
                          (inf.location && inf.location.toLowerCase().includes(locationQuery.toLowerCase()));

    const platformMatch = platformFilter === "All" || inf.platform === platformFilter;
    const categoryMatch = categoryFilter === "All" || inf.categories.includes(categoryFilter);
    const genderMatch = genderFilter === "All" || inf.gender === genderFilter;

    // Advanced Stats Logic
    let followerMatch = true;
    const maxFollowers = getMaxFollowers(inf.followers);
    if (followerRange === "Nano") followerMatch = maxFollowers > 1000 && maxFollowers < 10000;
    if (followerRange === "Micro") followerMatch = maxFollowers >= 10000 && maxFollowers < 100000;
    if (followerRange === "Macro") followerMatch = maxFollowers >= 100000;

    let budgetMatch = true;
    if (budgetMax !== "All") {
        const rate = parsePrice(inf.min_rate);
        if (budgetMax === "Unlimited") {
            // Αν ο πελάτης λέει "Unlimited (1000+)", θέλουμε αυτούς που είναι ακριβοί
            budgetMatch = rate >= 1000;
        } else {
            // Αλλιώς, θέλουμε αυτούς που είναι φθηνότεροι από το Budget του πελάτη
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

    return searchMatch && locationMatch && platformMatch && categoryMatch && genderMatch && followerMatch && budgetMatch && engageMatch;
  });

  const clearFilters = () => {
    setSearchQuery("");
    setLocationQuery("");
    setPlatformFilter("All");
    setCategoryFilter("All");
    setGenderFilter("All");
    setFollowerRange("All");
    setBudgetMax("All");
    setMinEngagement("All");
  };

  return (
    <div>
      {/* --- CONTROL BAR --- */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 mb-10 transition-all duration-300">
        
        {/* Row 1: Search & Location */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
            <div className="md:col-span-5 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                <input type="text" placeholder="Search name or bio..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="md:col-span-4 relative">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><LocationIcon /></div>
                <input type="text" placeholder="Location (e.g. Athens)" value={locationQuery} onChange={(e) => setLocationQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="md:col-span-3 flex items-center justify-end gap-3">
                 <button onClick={() => setShowAdvanced(!showAdvanced)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${showAdvanced ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <FilterIcon /> Filters <ChevronDown />
                 </button>
            </div>
        </div>

        {/* Row 2: Advanced Filters */}
        <div className={`overflow-hidden transition-all duration-300 ${showAdvanced ? 'max-h-[500px] opacity-100 mt-4 pt-4 border-t border-slate-100' : 'max-h-0 opacity-0'}`}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                
                <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="filter-select">
                    <option value="All">Platform: All</option>
                    <option value="Instagram">Instagram</option>
                    <option value="TikTok">TikTok</option>
                    <option value="YouTube">YouTube</option>
                </select>

                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="filter-select">
                    <option value="All">Category: All</option>
                    <option value="Beauty">Beauty</option>
                    <option value="Lifestyle">Lifestyle</option>
                    <option value="Tech">Tech</option>
                    <option value="Fitness">Fitness</option>
                    <option value="Gaming">Gaming</option>
                    <option value="Travel">Travel</option>
                    <option value="Business">Business</option>
                </select>

                <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} className="filter-select">
                    <option value="All">Gender: Any</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                </select>

                <select value={followerRange} onChange={(e) => setFollowerRange(e.target.value)} className="filter-select bg-blue-50/50 border-blue-100 text-blue-800">
                    <option value="All">Followers: Any</option>
                    <option value="Nano">Nano (1k-10k)</option>
                    <option value="Micro">Micro (10k-100k)</option>
                    <option value="Macro">Macro (100k+)</option>
                </select>

                <select value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} className="filter-select bg-green-50/50 border-green-100 text-green-800">
                    <option value="All">Budget: Any</option>
                    <option value="100">Up to 100€</option>
                    <option value="200">Up to 200€</option>
                    <option value="500">Up to 500€</option>
                    <option value="1000">Up to 1000€</option>
                    <option value="2000">Up to 2000€</option>
                    <option value="Unlimited">5000€+ (VIP)</option>
                </select>

                <select value={minEngagement} onChange={(e) => setMinEngagement(e.target.value)} className="filter-select bg-purple-50/50 border-purple-100 text-purple-800">
                    <option value="All">Engage: Any</option>
                    <option value="1">Min 1%</option>
                    <option value="3">Min 3% (Good)</option>
                    <option value="5">Min 5% (High)</option>
                </select>
            </div>
            
            <div className="mt-4 flex justify-between items-center">
                <p className="text-xs text-slate-400">Showing {filtered.length} influencers matching criteria.</p>
                <button onClick={clearFilters} className="text-sm text-red-500 hover:text-red-700 font-medium underline">Clear All</button>
            </div>
        </div>
      </div>

      {/* --- GRID --- */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {filtered.map((inf) => (
            <Link href={`/influencer/${inf.id}`} key={inf.id} className="block h-full group">
                <InfluencerCard {...inf} />
            </Link>
            ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
            <h3 className="text-xl font-bold text-slate-900">No influencers found</h3>
            <p className="text-slate-500 mb-4">Adjust your filters to see more results.</p>
            <button onClick={clearFilters} className="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold">Reset Filters</button>
        </div>
      )}

      <style jsx>{`
        .filter-select {
            @apply w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer;
        }
      `}</style>
    </div>
  );
}