"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import BrandCard from "./BrandCard";

interface Brand {
  id: string;
  brand_name: string;
  contact_email: string;
  contact_person: string | null;
  website: string | null;
  industry: string | null;
  logo_url: string | null;
  verified: boolean;
  created_at: string;
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
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .eq("verified", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[BrandsDirectory] Error fetching brands:", error);
        throw error;
      }

      console.log(`[BrandsDirectory] Fetched ${data?.length || 0} verified brands`);
      if (data && data.length > 0) {
        console.log('[BrandsDirectory] First brand logo_url:', data[0].logo_url);
        console.log('[BrandsDirectory] Sample brands:', data.map(b => ({ name: b.brand_name, logo_url: b.logo_url })));
      }
      setBrands(data || []);
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
          b.contact_email.toLowerCase().includes(query) ||
          (b.contact_person && b.contact_person.toLowerCase().includes(query)) ||
          (b.industry && b.industry.toLowerCase().includes(query))
      );
    }

    // Industry filter
    if (selectedIndustry !== "all") {
      filtered = filtered.filter(
        (b) => b.industry && b.industry.toLowerCase() === selectedIndustry.toLowerCase()
      );
    }

    setFilteredBrands(filtered);
  };

  const industries = Array.from(
    new Set(brands.map((b) => b.industry).filter((i): i is string => !!i))
  ).sort();

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
                  {industry}
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

