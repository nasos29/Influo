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
}

const dummyInfluencers: Influencer[] = [
  {
    id: 1,
    name: "Μαρία Παπαδοπούλου",
    bio: "Beauty & lifestyle creator από Αθήνα.",
    avatar: "/avatar1.jpg",
    verified: true,
    socials: { instagram: "maria_pap", tiktok: "maria.tok" },
    followers: { instagram: 12000, tiktok: 54000 },
    categories: ["Beauty", "Lifestyle"],
    platform: "Instagram",
  },
  {
    id: 2,
    name: "Nikos Tech",
    bio: "Tech reviewer, gadgets & unboxing.",
    avatar: "/avatar2.jpg",
    verified: true,
    socials: { instagram: "nikos.tech" },
    followers: { instagram: 8700 },
    categories: ["Tech"],
    platform: "Instagram",
  },
  {
    id: 3,
    name: "Ελένη Fitness",
    bio: "Fitness coach & nutrition tips.",
    avatar: "/avatar3.jpg",
    verified: false,
    socials: { instagram: "eleni_fit", tiktok: "eleni.tok" },
    followers: { instagram: 15000, tiktok: 32000 },
    categories: ["Fitness", "Lifestyle"],
    platform: "TikTok",
  },
  {
    id: 4,
    name: "Γιώργος Travel",
    bio: "Travel vlogger, κόσμος & εμπειρίες.",
    avatar: "/avatar4.jpg",
    verified: true,
    socials: { instagram: "george_travel" },
    followers: { instagram: 22000 },
    categories: ["Travel"],
    platform: "Instagram",
  },
  {
    id: 5,
    name: "Anna Foodie",
    bio: "Food blogger & συνταγές.",
    avatar: "/avatar5.jpg",
    verified: false,
    socials: { instagram: "anna_foodie" },
    followers: { instagram: 17000 },
    categories: ["Food", "Lifestyle"],
    platform: "Instagram",
  },
  {
    id: 6,
    name: "Katerina Gaming",
    bio: "Gaming highlights & live streams.",
    avatar: "/avatar6.jpg",
    verified: true,
    socials: { twitch: "kat_gamer", youtube: "katerina_gaming" },
    followers: { twitch: 32000, youtube: 9000 },
    categories: ["Gaming"],
    platform: "YouTube",
  },
  {
    id: 7,
    name: "Theo Fitness",
    bio: "Personal trainer & motivation.",
    avatar: "/avatar7.jpg",
    verified: false,
    socials: { instagram: "theo_fit" },
    followers: { instagram: 11000 },
    categories: ["Fitness"],
    platform: "Instagram",
  },
  {
    id: 8,
    name: "Sofia Beauty",
    bio: "Skincare tips & tutorials.",
    avatar: "/avatar8.jpg",
    verified: true,
    socials: { instagram: "sofia_beauty" },
    followers: { instagram: 28000 },
    categories: ["Beauty"],
    platform: "Instagram",
  },
];

export default function Directory() {
  const [platformFilter, setPlatformFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  const filtered = dummyInfluencers.filter((inf) => {
    const platformMatch =
      platformFilter === "All" || inf.platform === platformFilter;

    const categoryMatch =
      categoryFilter === "All" || inf.categories.includes(categoryFilter);

    return platformMatch && categoryMatch;
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex gap-4 mb-8 justify-center flex-wrap">
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="border rounded px-3 py-2 text-gray-700"
        >
          <option value="All">Όλες οι πλατφόρμες</option>
          <option value="Instagram">Instagram</option>
          <option value="TikTok">TikTok</option>
          <option value="YouTube">YouTube</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border rounded px-3 py-2 text-gray-700"
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filtered.map((inf) => (
          <InfluencerCard key={inf.id} {...inf} />
        ))}
      </div>
    </div>
  );
}












