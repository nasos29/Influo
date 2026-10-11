"use client";

import { CATEGORIES, categoryLabel } from "@/lib/categories";

interface DirectoryFilterProps {
  onFilterChange: React.Dispatch<
    React.SetStateAction<{
      name: string;
      platform: string;
      category: string;
    }>
  >;
  lang?: "el" | "en";
}

export default function DirectoryFilter({ onFilterChange, lang = "el" }: DirectoryFilterProps) {
  return (
    <div className="flex gap-4 mb-8 justify-center flex-wrap">
      <input
        type="text"
        placeholder="Αναζήτηση με όνομα"
        className="border rounded px-3 py-2 text-gray-700"
        onChange={(e) =>
          onFilterChange((prev) => ({ ...prev, name: e.target.value }))
        }
      />

      <select
        className="border rounded px-3 py-2 text-gray-700"
        onChange={(e) =>
          onFilterChange((prev) => ({ ...prev, platform: e.target.value }))
        }
      >
        <option value="">Όλες οι πλατφόρμες</option>
        <option value="Instagram">Instagram</option>
        <option value="TikTok">TikTok</option>
        <option value="YouTube">YouTube</option>
      </select>

      <select
        className="border rounded px-3 py-2 text-gray-700"
        onChange={(e) =>
          onFilterChange((prev) => ({ ...prev, category: e.target.value }))
        }
      >
        <option value="">Όλες οι κατηγορίες</option>
        {CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {categoryLabel(cat, lang)}
          </option>
        ))}
      </select>
    </div>
  );
}
