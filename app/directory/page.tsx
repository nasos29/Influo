"use client";

import { useState, useEffect } from "react";

interface Influencer {
  id: string;
  display_name: string;
  username: string;
  platform: string;
  bio: string;
  videos: string[];
  followers: number;
}

export default function DirectoryPage() {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [platform, setPlatform] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const [minFollowers, setMinFollowers] = useState("");
  const [maxFollowers, setMaxFollowers] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchInfluencers = async (reset = false) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (platform) params.append("platform", platform);
    if (category) params.append("category", category);
    if (minFollowers) params.append("minFollowers", minFollowers);
    if (maxFollowers) params.append("maxFollowers", maxFollowers);
    if (sort) params.append("sort", sort);
    params.append("page", page.toString());
    params.append("limit", "12");

    const res = await fetch(`/api/get-influencers?${params.toString()}`);
    const data: Influencer[] = await res.json();

    if (reset) setInfluencers(data);
    else setInfluencers(prev => [...prev, ...data]);

    setHasMore(data.length === 12);
    setLoading(false);
  };

  useEffect(() => {
    setPage(1);
    fetchInfluencers(true);
  }, [platform, category, minFollowers, maxFollowers, sort]);

  useEffect(() => {
    if (page > 1) fetchInfluencers();
  }, [page]);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Influencer Directory</h1>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <select
          className="p-2 rounded border border-zinc-300 dark:border-zinc-700"
          value={platform}
          onChange={e => setPlatform(e.target.value)}
        >
          <option value="">All Platforms</option>
          <option value="Instagram">Instagram</option>
          <option value="TikTok">TikTok</option>
          <option value="YouTube">YouTube</option>
        </select>

        <input
          className="p-2 rounded border border-zinc-300 dark:border-zinc-700"
          placeholder="Category"
          value={category}
          onChange={e => setCategory(e.target.value)}
        />

        <input
          className="p-2 rounded border border-zinc-300 dark:border-zinc-700 w-24"
          placeholder="Min"
          value={minFollowers}
          onChange={e => setMinFollowers(e.target.value)}
          type="number"
        />
        <input
          className="p-2 rounded border border-zinc-300 dark:border-zinc-700 w-24"
          placeholder="Max"
          value={maxFollowers}
          onChange={e => setMaxFollowers(e.target.value)}
          type="number"
        />

        <select
          className="p-2 rounded border border-zinc-300 dark:border-zinc-700"
          value={sort}
          onChange={e => setSort(e.target.value)}
        >
          <option value="newest">Newest</option>
          <option value="followers">Most Followers</option>
        </select>
      </div>

      {/* Influencer Grid */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {influencers.map((inf) => (
            <div
              key={inf.id}
              className="bg-white dark:bg-zinc-800 p-4 rounded shadow hover:shadow-lg transition"
            >
              <h2 className="font-semibold text-lg">{inf.display_name}</h2>
              <p className="text-zinc-500 dark:text-zinc-300">@{inf.username}</p>
              <p className="text-sm mt-2">{inf.bio}</p>
              <p className="mt-2 font-medium">{inf.platform}</p>
              <p className="mt-1 text-zinc-500">{inf.followers} followers</p>

              {/* Videos */}
              <div className="mt-2 space-y-2">
                {inf.videos?.map((v, i) => (
                  <iframe
                    key={i}
                    src={v.replace("watch?v=", "embed/")}
                    title={`Video ${i + 1}`}
                    className="w-full h-40 rounded"
                    allowFullScreen
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <button
          onClick={() => setPage(prev => prev + 1)}
          className="mt-6 w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Load More
        </button>
      )}
    </div>
  );
}
