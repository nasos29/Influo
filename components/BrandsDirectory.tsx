"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import BrandCard from "./BrandCard";
import { CATEGORIES, categoriesMatchFilter, categoryLabel, formatCategoryLabels, parseStoredCategories } from "@/lib/categories";

interface Brand {
  id: string;
  brand_name: string;
  contact_person: string | null;
  website: string | null;
  industry: string | null;
  logo_url: string | null;
  verified: boolean;
  created_at: string;
  bio?: string | null;
  city?: string | null;
  instagram?: string | null;
}

const t = {
  el: {
    searchPlace: "Αναζήτηση επιχείρησης...",
    industryPlace: "Κλάδος...",
    results: "Αποτελέσματα",
    clear: "Καθαρισμός",
    filters: "Φίλτρα",
    industryAll: "Κλάδος: Όλοι",
    noResults: "Δεν βρέθηκαν επιχειρήσεις",
    adjust: "Δοκίμασε διαφορετικά φίλτρα.",
    reset: "Επαναφορά",
    loading: "Φόρτωση...",
  },
  en: {
    searchPlace: "Search company...",
    industryPlace: "Industry...",
    results: "Results",
    clear: "Clear",
    filters: "Filters",
    industryAll: "Industry: All",
    noResults: "No companies found",
    adjust: "Try different filters.",
    reset: "Reset",
    loading: "Loading...",
  },
};

export default function BrandsDirectory({ lang = "el" }: { lang?: "el" | "en" }) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [filteredBrands, setFilteredBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState<string>("all");

  useEffect(() => {
    fetchBrands();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [brands, searchQuery, selectedIndustry]);

  const fetchBrands = async () => {
    try {
      setLoading(true);
      console.log("[BrandsDirectory] Fetching verified brands...");
      let rows: Brand[] | null = null;
      const full = await supabase
        .from("brands")
        .select("id, brand_name, contact_person, website, industry, logo_url, verified, created_at, bio, city, instagram")
        .eq("verified", true)
        .order("created_at", { ascending: false });

      if (full.error && /column|schema cache/i.test(full.error.message || "")) {
        const fallback = await supabase
          .from("brands")
          .select("id, brand_name, contact_person, website, industry, logo_url, verified, created_at")
          .eq("verified", true)
          .order("created_at", { ascending: false });
        if (fallback.error) {
          console.error("[BrandsDirectory] Error fetching brands:", fallback.error);
          throw fallback.error;
        }
        rows = (fallback.data || []) as Brand[];
      } else if (full.error) {
        console.error("[BrandsDirectory] Error fetching brands:", full.error);
        throw full.error;
      } else {
        rows = (full.data || []) as Brand[];
      }

      console.log(`[BrandsDirectory] Fetched ${rows?.length || 0} verified brands`);
      if (rows && rows.length > 0) {
        console.log('[BrandsDirectory] First brand logo_url:', rows[0].logo_url);
        console.log('[BrandsDirectory] Sample brands:', rows.map(b => ({ name: b.brand_name, logo_url: b.logo_url })));
      }
      setBrands(rows || []);
    } catch (error) {
      console.error("Error fetching brands:", error);
      setBrands([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...brands];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.brand_name.toLowerCase().includes(query) ||
          (b.contact_person && b.contact_person.toLowerCase().includes(query)) ||
          (b.industry && (
            b.industry.toLowerCase().includes(query) ||
            formatCategoryLabels(b.industry, lang).toLowerCase().includes(query)
          ))
      );
    }

    // Industry filter
    if (selectedIndustry !== "all") {
      filtered = filtered.filter((b) => categoriesMatchFilter(b.industry, selectedIndustry));
    }

    setFilteredBrands(filtered);
  };

  const storedExtras = Array.from(
    new Set(brands.flatMap((b) => parseStoredCategories(b.industry)))
  ).filter((key) => !CATEGORIES.includes(key as (typeof CATEGORIES)[number]));
  const industries = [...CATEGORIES, ...storedExtras];

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedIndustry("all");
  };

  const txt = t[lang];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">{txt.filters}</h3>
          <button
            onClick={resetFilters}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {txt.reset}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {txt.searchPlace}
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={txt.searchPlace}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Industry */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {txt.industryAll}
            </label>
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">{txt.industryAll}</option>
              {industries.map((industry) => (
                <option key={industry} value={industry}>
                  {categoryLabel(industry, lang)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">
            {txt.results}: {filteredBrands.length}
          </h3>
          <button
            onClick={fetchBrands}
            disabled={loading}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? txt.loading : (lang === "el" ? "Ανανέωση" : "Refresh")}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">{txt.loading}</div>
        ) : filteredBrands.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-600 mb-2">{txt.noResults}</p>
            <p className="text-sm text-slate-500">{txt.adjust}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredBrands.map((brand) => (
              <BrandCard key={brand.id} {...brand} lang={lang} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

