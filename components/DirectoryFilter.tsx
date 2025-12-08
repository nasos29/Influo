"use client";

import { useState } from "react";

type Filters = {
  name: string;
  platform: string;
  category: string;
};

type Props = {
  onFilterChange: (filters: Filters) => void;
};

export default function DirectoryFilter({ onFilterChange }: Props) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("All");
  const [category, setCategory] = useState("All");

  // Κάθε φορά που αλλάζει κάτι, ενημέρωσε τον parent
  const updateFilters = (newFilters: Partial<Filters>) => {
    const updated = { name, platform, category, ...newFilters };
    onFilterChange({
      name: updated.name,
      platform: updated.platform === "All" ? "" : updated.platform,
      category: updated.category === "All" ? "" : updated.category,
    });
  };

  return (
    <div className="flex gap-4 mb-8 justify-center flex-wrap">
      <input
        type="text"
        placeholder="Αναζήτηση ονόματος"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          updateFilters({ name: e.target.value });
        }}
        className="border rounded px-3 py-2 text-gray-700"
      />

      <select
        value={platform}
        onChange={(e) => {
          setPlatform(e.target.value);
          updateFilters({ platform: e.target.value });
        }}
        className="border rounded px-3 py-2 text-gray-700"
      >
        <option value="All">Όλες οι πλατφόρμες</option>
        <option value="Instagram">Instagram</option>
        <option value="TikTok">TikTok</option>
        <option value="YouTube">YouTube</option>
      </select>

      <select
        value={category}
        onChange={(e) => {
          setCategory(e.target.value);
          updateFilters({ category: e.target.value });
        }}
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
  );
}



