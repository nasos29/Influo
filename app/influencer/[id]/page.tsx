"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import { dummyInfluencers, Influencer } from "../../../components/Directory"; 
import { supabase } from "../../../lib/supabaseClient";

type Params = Promise<{ id: string }>;

// Επέκταση του Interface για τα νέα Pro Fields
interface ProInfluencer extends Influencer {
  engagement_rate?: string;
  avg_likes?: string;
  audience_data?: { male: number; female: number; top_age: string };
  rate_card?: { story: string; post: string; reel: string };
  past_brands?: string[];
}

export default function InfluencerProfile(props: { params: Params }) {
  const params = use(props.params);
  const id = params.id;
  const [activeTab, setActiveTab] = useState("overview");
  const [profile, setProfile] = useState<ProInfluencer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) return;

      // 1. DUMMY DATA CHECK (Εμπλουτισμένα με ψεύτικα Pro Data)
      if (id.toString().includes("dummy")) {
        const found = dummyInfluencers.find((d) => String(d.id) === id);
        if (found) {
          setProfile({
            ...found,
            engagement_rate: "5.2%",
            avg_likes: "3.2k",
            audience_data: { male: 35, female: 65, top_age: "18-34" },
            rate_card: { story: "80€", post: "150€", reel: "250€" },
            past_brands: ["Zara", "Vodafone", "e-Food"]
          });
          setLoading(false);
          return;
        }
      }

      // 2. REAL DATA CHECK
      const isNumeric = /^\d+$/.test(id);
      if (isNumeric) {
        const { data, error } = await supabase.from("influencers").select("*").eq("id", id).single();
        
        if (data && !error) {
          const socialsObj: { [key: string]: string } = {};
          if (Array.isArray(data.accounts)) {
             data.accounts.forEach((acc: any) => { if(acc.platform) socialsObj[acc.platform.toLowerCase()] = acc.username; });
          }

          setProfile({
            id: data.id,
            name: data.display_name,
            bio: data.bio || "",
            avatar: data.avatar_url || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=400&q=80",
            verified: data.verified,
            socials: socialsObj,
            followers: { instagram: 0 }, // Θα μπορούσε να αποθηκευτεί στη βάση μελλοντικά
            categories: ["Creator"],
            platform: "Instagram",
            gender: data.gender,
            location: data.location,
            languages: data.languages,
            min_rate: data.min_rate,
            videos: Array.isArray(data.videos) ? data.videos : [],
            // New Pro Fields mapping
            engagement_rate: data.engagement_rate || "-",
            avg_likes: data.avg_likes || "-",
            audience_data: data.audience_data || { male: 50, female: 50, top_age: "?" },
            rate_card: data.rate_card || { story: "-", post: "-", reel: "-" },
            past_brands: data.past_brands || []
          });
        }
      }
      setLoading(false);
    };
    fetchProfile();
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading Profile...</div>;
  if (!profile) return <div className="min-h-screen flex items-center justify-center">Influencer not found.</div>;

  return (
    <div className="bg-slate-50 min-h-screen pb-20 font-sans">
      {/* --- COVER & HEADER --- */}
      <div className="h-72 w-full relative bg-slate-900">
         <Image src="https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1500&q=80" alt="Cover" fill className="object-cover opacity-50" />
         <div className="absolute top-6 left-6 z-20">
             <a href="/" className="text-white bg-white/20 backdrop-blur-md px-4 py-2 rounded-lg font-medium hover:bg-white/30 transition">← Back</a>
         </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 relative -mt-24 z-10">
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 flex flex-col md:flex-row items-center md:items-end gap-6">
            <div className="relative w-40 h-40 rounded-full border-4 border-white shadow-lg overflow-hidden bg-slate-200 -mt-20 md:mb-0">
                <Image src={profile.avatar} alt={profile.name} fill className="object-cover" />
            </div>
            <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold text-slate-900 flex items-center justify-center md:justify-start gap-2">
                    {profile.name} {profile.verified && <span className="text-blue-500 text-xl" title="Verified">✔️</span>}
                </h1>
                <p className="text-slate-500">{profile.location} • {profile.gender}</p>
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3">
                    {profile.languages?.split(",").map((l,i) => <span key={i} className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">{l.trim()}</span>)}
                </div>
            </div>
            <div className="flex gap-3">
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-transform hover:-translate-y-1">
                    Contact for Work
                </button>
            </div>
        </div>

        {/* --- NAVIGATION TABS --- */}
        <div className="mt-8 border-b border-slate-200">
            <nav className="flex gap-8">
                {["overview", "audience", "pricing"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`pb-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${
                            activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </nav>
        </div>

        {/* --- CONTENT AREA --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
            
            {/* LEFT COLUMN (Always visible) */}
            <div className="lg:col-span-2 space-y-8">
                
                {activeTab === "overview" && (
                    <>
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                            <h2 className="text-xl font-bold text-slate-900 mb-4">About</h2>
                            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{profile.bio || "No bio available."}</p>
                        </div>

                        {/* Social Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                             <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                                <p className="text-slate-400 text-xs font-bold uppercase">Engagement</p>
                                <p className="text-2xl font-extrabold text-blue-600">{profile.engagement_rate}</p>
                             </div>
                             <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                                <p className="text-slate-400 text-xs font-bold uppercase">Avg Likes</p>
                                <p className="text-2xl font-extrabold text-slate-800">{profile.avg_likes}</p>
                             </div>
                             <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                                <p className="text-slate-400 text-xs font-bold uppercase">Followers</p>
                                <p className="text-2xl font-extrabold text-slate-800">
                                    {profile.followers?.instagram ? (profile.followers.instagram / 1000).toFixed(1) + 'k' : 'N/A'}
                                </p>
                             </div>
                             <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                                <p className="text-slate-400 text-xs font-bold uppercase">Collabs</p>
                                <p className="text-2xl font-extrabold text-purple-600">{profile.past_brands?.length || 0}</p>
                             </div>
                        </div>

                        {/* Portfolio */}
                         <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-4">Content Portfolio</h3>
                            {profile.videos && profile.videos.length > 0 && profile.videos[0] !== "" ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {profile.videos.map((vid, i) => (
                                        <a key={i} href={vid} target="_blank" className="block group relative h-48 bg-slate-900 rounded-xl overflow-hidden shadow-md">
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-5xl opacity-80 group-hover:scale-110 transition-transform">▶️</span>
                                            </div>
                                            <div className="absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-black/80 to-transparent text-white text-sm font-medium">
                                                Watch Highlight #{i+1}
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400">No content uploaded.</div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === "audience" && (
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                        <h2 className="text-xl font-bold text-slate-900 mb-6">Audience Demographics</h2>
                        
                        {/* Gender Chart using CSS */}
                        <div className="mb-8">
                            <div className="flex justify-between mb-2 font-medium text-slate-700">
                                <span>Female ({profile.audience_data?.female}%)</span>
                                <span>Male ({profile.audience_data?.male}%)</span>
                            </div>
                            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex">
                                <div style={{ width: `${profile.audience_data?.female}%` }} className="bg-pink-400 h-full"></div>
                                <div style={{ width: `${profile.audience_data?.male}%` }} className="bg-blue-400 h-full"></div>
                            </div>
                        </div>

                        {/* Age Group */}
                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="bg-white p-3 rounded-full shadow-sm text-2xl">🎯</div>
                            <div>
                                <p className="text-slate-500 text-sm">Top Age Group</p>
                                <p className="text-xl font-bold text-slate-900">{profile.audience_data?.top_age} Years old</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "pricing" && (
                     <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                        <h2 className="text-xl font-bold text-slate-900 mb-6">Rate Card</h2>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-4 border-b border-slate-100">
                                <span className="font-medium text-slate-700">Instagram Story (24h)</span>
                                <span className="font-bold text-xl text-slate-900">{profile.rate_card?.story}</span>
                            </div>
                            <div className="flex justify-between items-center p-4 border-b border-slate-100">
                                <span className="font-medium text-slate-700">Instagram Post</span>
                                <span className="font-bold text-xl text-slate-900">{profile.rate_card?.post}</span>
                            </div>
                            <div className="flex justify-between items-center p-4 border-b border-slate-100">
                                <span className="font-medium text-slate-700">Reel / TikTok Video</span>
                                <span className="font-bold text-xl text-slate-900">{profile.rate_card?.reel}</span>
                            </div>
                        </div>
                        <p className="mt-6 text-xs text-slate-400 text-center">* Prices may vary depending on project scope.</p>
                     </div>
                )}

            </div>

            {/* RIGHT COLUMN (Sidebar Info) */}
            <div className="space-y-6">
                 {/* Social Links */}
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase">Connect</h3>
                    <div className="space-y-3">
                         {Object.entries(profile.socials).map(([plat, user]) => (
                            <a key={plat} href={`https://${plat}.com/${user}`} target="_blank" className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition border border-transparent hover:border-slate-200 group">
                                <span className="capitalize font-medium text-slate-700">{plat}</span>
                                <span className="text-slate-400 group-hover:text-blue-600">↗</span>
                            </a>
                        ))}
                    </div>
                 </div>

                 {/* Past Brands */}
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase">Brand Collabs</h3>
                    <div className="flex flex-wrap gap-2">
                        {profile.past_brands && profile.past_brands.length > 0 ? (
                            profile.past_brands.map((b, i) => (
                                <span key={i} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-200">
                                    {b}
                                </span>
                            ))
                        ) : (
                            <span className="text-slate-400 text-sm">No brands listed yet.</span>
                        )}
                    </div>
                 </div>
            </div>
        </div>
      </div>
    </div>
  );
}