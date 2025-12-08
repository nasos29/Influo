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

// Dummy data
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
];

export default function Directory() {
  const [platformFilter, setPlatformFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  const filtered = dummyInfluencers.filter((inf) => {
    const platformMatch = platformFilter === "All" || inf.platform === platformFilter;
    const categoryMatch =
      categoryFilter === "All" || inf.categories.includes(categoryFilter);
    return platformMatch && categoryMatch;
  });

  return (
    <div className="max-w-6xl mx-auto">
      {/* Filters */}
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

      {/* Influencer Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filtered.map((inf) => (
          <InfluencerCard key={inf.id} {...inf} />
        ))}
      </div>
    </div>
  );
}











