"use client";

import { useState, useEffect } from "react";
import Link from "next/link"; // Import Link for navigation
import { supabase } from "../lib/supabaseClient";
import InfluencerCard from "./InfluencerCard";

// Τύπος δεδομένων (κοινός για dummy και real)
export interface Influencer {
  id: string | number; // Δέχεται και 'dummy-1' και 15
  name: string;
  bio: string;
  avatar: string;
  verified: boolean;
  socials: { [key: string]: string | undefined };
  followers: { [key: string]: number | undefined };
  categories: string[];
  platform: string;
  gender: "Male" | "Female";
  videos?: string[]; // Προσθήκη για να περνάμε τα video
}

// Dummy Data (με αλλαγμένα IDs για να μην τρακάρουν με τη βάση)
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
    videos: ["https://www.youtube.com/watch?v=LxR_f_1", "https://tiktok.com/@maria/video/1"]
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
    videos: []
  },
  {
    id: "dummy-3",
    name: "Ελένη Fitness",
    bio: "Certified personal trainer. Fitness tips & υγιεινή διατροφή.",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    verified: false,
    socials: { instagram: "eleni_fit", tiktok: "eleni.tok" },
    followers: { instagram: 15000, tiktok: 32000 },
    categories: ["Fitness", "Lifestyle"],
    platform: "TikTok",
    gender: "Female",
    videos: []
  },
  {
    id: "dummy-4",
    name: "Γιώργος Travel",
    bio: "Γυρίζω τον κόσμο με ένα backpack. Travel vlogger.",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
    verified: true,
    socials: { instagram: "george_travel", youtube: "gtravel" },
    followers: { instagram: 22000, youtube: 45000 },
    categories: ["Travel"],
    platform: "Instagram",
    gender: "Male",
    videos: []
  },
  {
    id: "dummy-5",
    name: "Anna Foodie",
    bio: "Εύκολες και γρήγορες συνταγές για φοιτητές.",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
    verified: false,
    socials: { instagram: "anna_foodie" },
    followers: { instagram: 17000 },
    categories: ["Food", "Lifestyle"],
    platform: "Instagram",
    gender: "Female",
    videos: []
  },
   {
    id: "dummy-6",
    name: "Katerina Gaming",
    bio: "Pro gamer & streamer. LoL & Valorant highlights.",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80",
    verified: true,
    socials: { twitch: "kat_gamer", youtube: "katerina_gaming" },
    followers: { twitch: 32000, youtube: 9000 },
    categories: ["Gaming"],
    platform: "YouTube",
    gender: "Female",
    videos: []
  },
];

export default function Directory() {
  const [influencers, setInfluencers] = useState<Influencer[]>(dummyInfluencers);
  const [platformFilter, setPlatformFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [genderFilter, setGenderFilter] = useState<string>("All");

  // Fetch Real Data from Supabase and merge
  useEffect(() => {
    const fetchRealInfluencers = async () => {
      // Φέρνουμε μόνο όσους έχεις κάνει 'verified: true' στο Supabase
      // Αν θες να τους βλέπεις όλους για test, βγάλε το .eq('verified', true)
      const { data, error } = await supabase
        .from("influencers")
        .select("*")
        .eq('verified', true); 

      if (error) {
        console.error("Error fetching:", error);
        return;
      }

      if (data) {
        // Μετατροπή των δεδομένων της βάσης στη μορφή που θέλει το UI
        const realInfluencers: Influencer[] = data.map((inf: any) => {
          
          // Μετατροπή του Accounts JSON σε αντικείμενο socials { instagram: 'user' }
          const socialsObj: { [key: string]: string } = {};
          if (Array.isArray(inf.accounts)) {
            inf.accounts.forEach((acc: any) => {
              if (acc.platform && acc.username) {
                socialsObj[acc.platform.toLowerCase()] = acc.username;
              }
            });
          }

          return {
            id: inf.id, // Αυτό είναι το Real ID (π.χ. 5)
            name: inf.display_name,
            bio: inf.bio || "",
            // Αν δεν έχει avatar, βάζουμε ένα τυχαίο placeholder
            avatar: inf.avatar_url || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=400&q=80",
            verified: inf.verified,
            socials: socialsObj,
            followers: {}, // Στη φόρμα δεν ζητάμε followers ακόμα, οπότε κενό
            categories: [], // Προς το παρόν κενό ή default
            platform: "Instagram", // Default
            gender: inf.gender || "Female",
            videos: Array.isArray(inf.videos) ? inf.videos : []
          };
        });

        // Προσθέτουμε τους Real ΜΕΤΑ τους Dummy
        setInfluencers([...dummyInfluencers, ...realInfluencers]);
      }
    };

    fetchRealInfluencers();
  }, []);

  const filtered = influencers.filter((inf) => {
    const platformMatch = platformFilter === "All" || inf.platform === platformFilter;
    const categoryMatch = categoryFilter === "All" || inf.categories.includes(categoryFilter);
    const genderMatch = genderFilter === "All" || inf.gender === genderFilter;
    return platformMatch && categoryMatch && genderMatch;
  });

  return (
    <div>
      {/* Filters Bar (Ίδιο με πριν) */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-8 flex flex-wrap gap-4 justify-center md:justify-start">
         <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider self-center">Φίλτρα:</span>
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="bg-slate-50 border border-slate-300 text-slate-700 text-sm rounded-lg p-2.5"
        >
          <option value="All">Όλες οι πλατφόρμες</option>
          <option value="Instagram">Instagram</option>
          <option value="TikTok">TikTok</option>
          <option value="YouTube">YouTube</option>
        </select>
         <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-slate-50 border border-slate-300 text-slate-700 text-sm rounded-lg p-2.5"
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
          className="bg-slate-50 border border-slate-300 text-slate-700 text-sm rounded-lg p-2.5"
        >
          <option value="All">Όλα τα φύλα</option>
          <option value="Female">Γυναίκες</option>
          <option value="Male">Άνδρες</option>
        </select>
      </div>

      {/* Grid Cards Wrapped in Link */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {filtered.map((inf) => (
          <Link href={`/influencer/${inf.id}`} key={inf.id} className="block h-full">
             <InfluencerCard {...inf} />
          </Link>
        ))}
      </div>
    </div>
  );
}












