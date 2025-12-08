"use client";

import { useState } from "react";
import InfluencerCard from "./InfluencerCard";

// Dummy influencers
const dummyInfluencers = [
  { name: "Μαρία Παπαδοπούλου", bio: "Beauty & lifestyle creator από Αθήνα.", avatar: "/avatar1.jpg", verified: true, socials: { instagram: "maria_pap", tiktok: "maria.tok" }, followers: { instagram: 12000, tiktok: 54000 }, categories: ["Beauty", "Lifestyle"], platform: "Instagram" },
  { name: "Nikos Tech", bio: "Tech reviewer, gadgets & unboxing.", avatar: "/avatar2.jpg", verified: true, socials: { instagram: "nikos.tech" }, followers: { instagram: 8700 }, categories: ["Tech"], platform: "Instagram" },
  { name: "Ελένη Fitness", bio: "Fitness coach & nutrition tips.", avatar: "/avatar3.jpg", verified: false, socials: { instagram: "eleni_fit", tiktok: "eleni.tok" }, followers: { instagram: 15000, tiktok: 32000 }, categories: ["Fitness", "Lifestyle"], platform: "TikTok" },
  { name: "Gaming Guru", bio: "Gaming & streaming.", avatar: "/avatar4.jpg", verified: true, socials: { tiktok: "gamingguru" }, followers: { tiktok: 20000 }, categories: ["Gaming"], platform: "TikTok" },
  { name: "Foodie Anna", bio: "Cooking & recipes.", avatar: "/avatar5.jpg", verified: true, socials: { instagram: "foodie_anna" }, followers: { instagram: 14000 }, categories: ["Food"], platform: "Instagram" },
  { name: "Travel With Tom", bio: "Travel vlogs & tips.", avatar: "/avatar6.jpg", verified: false, socials: { instagram: "traveltom" }, followers: { instagram: 9000 }, categories: ["Travel"], platform: "Instagram" },
];

export default function Directory() {
  const [platformFilter, setPlatformFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  const filtered = dummyInfluencers.filter(influencer => {
    const platformMatch = platformFilter === "All" || influencer.platform === platformFilter;
    const categoryMatch = categoryFilter === "All" || influencer.categories.includes(categoryFilter);
    return platformMatch && categoryMatch;
  });

  return (
    <div className="max-w-6xl mx-auto">
      {/* Filters */}
      <div className="flex gap-4 mb-8 justify-center flex-wrap">
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400"
        >
          <option value="All">Όλες οι πλατφόρμες</option>
          <option value="Instagram">Instagram</option>
          <option value="TikTok">TikTok</option>
          <option value="YouTube">YouTube</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border rounded px-3 py-2 text-gray-900 placeholder-gray-400"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        {filtered.map((inf, i) => (
          <InfluencerCard
            key={i}
            name={inf.name}
            bio={inf.bio}
            avatar={inf.avatar}
            verified={inf.verified}
            socials={inf.socials}
            followers={inf.followers}
            categories={inf.categories || []} // Πάντα array για να μην σκάει το map
          />
        ))}
      </div>
    </div>
  );
}









