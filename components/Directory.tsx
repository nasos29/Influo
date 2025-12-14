"use client";

import { useState } from "react";
import InfluencerCard from "./InfluencerCard";

interface Influencer {
  id: number;
  name: string;
  bio: string;
  avatar: string;
  verified: boolean;
  socials: { [key: string]: string | undefined };
  followers: { [key: string]: number | undefined };
  categories: string[];
  platform: string;
  gender: "Male" | "Female";
}

const dummyInfluencers: Influencer[] = [
  {
    id: 1,
    name: "Μαρία Παπαδοπούλου",
    bio: "Beauty & lifestyle creator. Λατρεύω τα ταξίδια και το skincare.",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
    verified: true,
    socials: { instagram: "maria_pap", tiktok: "maria.tok" },
    followers: { instagram: 12000, tiktok: 54000 },
    categories: ["Beauty", "Lifestyle"],
    platform: "Instagram",
    gender: "Female",
  },
  {
    id: 2,
    name: "Nikos Tech",
    bio: "Tech reviewer, gadgets & unboxing. Όλα για την τεχνολογία.",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80",
    verified: true,
    socials: { instagram: "nikos.tech", youtube: "nikostech" },
    followers: { instagram: 8700, youtube: 150000 },
    categories: ["Tech"],
    platform: "YouTube",
    gender: "Male",
  },
  {
    id: 3,
    name: "Ελένη Fitness",
    bio: "Certified personal trainer. Fitness tips & υγιεινή διατροφή.",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
    verified: false,
    socials: { instagram: "eleni_fit", tiktok: "eleni.tok" },
    followers: { instagram: 15000, tiktok: 32000 },
    categories: ["Fitness", "Lifestyle"],
    platform: "TikTok",
    gender: "Female",
  },
  {
    id: 4,
    name: "Γιώργος Travel",
    bio: "Γυρίζω τον κόσμο με ένα backpack. Travel vlogger.",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80",
    verified: true,
    socials: { instagram: "george_travel", youtube: "gtravel" },
    followers: { instagram: 22000, youtube: 45000 },
    categories: ["Travel"],
    platform: "Instagram",
    gender: "Male",
  },
  {
    id: 5,
    name: "Anna Foodie",
    bio: "Εύκολες και γρήγορες συνταγές για φοιτητές.",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80",
    verified: false,
    socials: { instagram: "anna_foodie" },
    followers: { instagram: 17000 },
    categories: ["Food", "Lifestyle"],
    platform: "Instagram",
    gender: "Female",
  },
  {
    id: 6,
    name: "Katerina Gaming",
    bio: "Pro gamer & streamer. LoL & Valorant highlights.",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80",
    verified: true,
    socials: { twitch: "kat_gamer", youtube: "katerina_gaming" },
    followers: { twitch: 32000, youtube: 9000 },
    categories: ["Gaming"],
    platform: "YouTube",
    gender: "Female",
  },
  {
    id: 7,
    name: "Theo Fitness",
    bio: "Crossfit athlete. Προπονήσεις υψηλής έντασης.",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
    verified: false,
    socials: { instagram: "theo_fit" },
    followers: { instagram: 11000 },
    categories: ["Fitness"],
    platform: "Instagram",
    gender: "Male",
  },
  {
    id: 8,
    name: "Sofia Beauty",
    bio: "Makeup artist. Tutorials για βραδινό μακιγιάζ.",
    avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=150&q=80",
    verified: true,
    socials: { instagram: "sofia_beauty", tiktok: "sofia_b" },
    followers: { instagram: 28000, tiktok: 120000 },
    categories: ["Beauty"],
    platform: "Instagram",
    gender: "Female",
  },
];

export default function Directory() {
  const [platformFilter, setPlatformFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [genderFilter, setGenderFilter] = useState<string>("All");

  const filtered = dummyInfluencers.filter((inf) => {
    const platformMatch = platformFilter === "All" || inf.platform === platformFilter;
    const categoryMatch = categoryFilter === "All" || inf.categories.includes(categoryFilter);
    const genderMatch = genderFilter === "All" || inf.gender === genderFilter;
    return platformMatch && categoryMatch && genderMatch;
  });

  return (
    <div>
      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-8 flex flex-wrap gap-4 justify-center md:justify-start">
        <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Φίλτρα:</span>
        </div>
        
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="bg-slate-50 border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
        >
          <option value="All">Όλες οι πλατφόρμες</option>
          <option value="Instagram">Instagram</option>
          <option value="TikTok">TikTok</option>
          <option value="YouTube">YouTube</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-slate-50 border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
        >
          <option value="All">Όλες οι κατηγορίες</option>
          <option value="Beauty">Beauty</option>
          <option value="Lifestyle">Lifestyle</option>
          <option value="Tech">Tech</option>
          <option value="Fitness">Fitness</option>
          <option value="Gaming">Gaming</option>
          <option value="Food">Food</option>
          <option value="Travel">Travel</option>
        </select>

        <select
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          className="bg-slate-50 border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
        >
          <option value="All">Όλα τα φύλα</option>
          <option value="Female">Γυναίκες</option>
          <option value="Male">Άνδρες</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {filtered.map((inf) => (
          <InfluencerCard key={inf.id} {...inf} />
        ))}
      </div>
    </div>
  );
}












