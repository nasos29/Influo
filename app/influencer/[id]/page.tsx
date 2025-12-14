"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import { dummyInfluencers, Influencer } from "../../../components/Directory"; 
import { supabase } from "../../../lib/supabaseClient";

type Params = Promise<{ id: string }>;

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

  // --- MODAL STATE ---
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalType, setProposalType] = useState("Instagram Story");
  const [brandName, setBrandName] = useState("");
  const [brandEmail, setBrandEmail] = useState(""); // ΝΕΟ
  const [budget, setBudget] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false); // Loading state για αποστολή

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) return;

      // 1. DUMMY CHECK
      if (id.toString().includes("dummy")) {
        const found = dummyInfluencers.find((d) => String(d.id) === id);
        if (found) {
          setProfile({
            ...found,
            engagement_rate: found.engagement_rate || "5.2%",
            avg_likes: found.avg_likes || "3.2k",
            audience_data: { male: 35, female: 65, top_age: "18-34" },
            rate_card: { story: "80€", post: "150€", reel: "250€" },
            past_brands: ["Zara", "Vodafone", "e-Food"]
          });
          setLoading(false);
          return;
        }
      }

      // 2. REAL CHECK
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
            followers: {},
            categories: ["Creator"],
            platform: "Instagram",
            gender: data.gender,
            location: data.location,
            languages: data.languages,
            min_rate: data.min_rate,
            videos: Array.isArray(data.videos) ? data.videos : [],
            engagement_rate: data.engagement_rate || "-",
            avg_likes: data.avg_likes || "-",
            audience_data: data.audience_data || { male: 50, female: 50, top_age: "?" },
            rate_card: data.rate_card || { story: "Ask", post: "Ask", reel: "Ask" },
            past_brands: data.past_brands || []
          });
        }
      }
      setLoading(false);
    };
    fetchProfile();
  }, [id]);

  const handleSendProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    // Αν είναι Real Influencer (έχει νούμερο για ID), σώσε στη βάση
    const isNumeric = /^\d+$/.test(id);
    if (isNumeric) {
        const { error } = await supabase.from("proposals").insert([{
            influencer_id: parseInt(id),
            brand_name: brandName,
            brand_email: brandEmail,
            service_type: proposalType,
            budget: budget,
            message: message,
            status: 'pending'
        }]);
        
        if (error) {
            console.error(error);
            alert("Something went wrong. Please try again.");
            setSending(false);
            return;
        }
    }

    // Αν είναι Dummy ή πέτυχε η εγγραφή
    setTimeout(() => {
        setSent(true);
        setSending(false);
    }, 1000);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading Profile...</div>;
  if (!profile) return <div className="min-h-screen flex items-center justify-center">Influencer not found.</div>;

  return (
    <div className="bg-slate-50 min-h-screen pb-20 font-sans relative">
      
      {/* --- PROPOSAL MODAL --- */}
      {showProposalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative">
                <button 
                    onClick={() => { setShowProposalModal(false); setSent(false); }}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-xl z-10"
                >✕</button>

                {!sent ? (
                    <div className="p-8">
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">Work with {profile.name}</h3>
                        <p className="text-slate-500 text-sm mb-6">Send a proposal. We'll notify them instantly.</p>
                        
                        <form onSubmit={handleSendProposal} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Service</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['Instagram Story', 'Instagram Post', 'Reel / TikTok'].map((type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setProposalType(type)}
                                            className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all ${proposalType === type ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200 hover:border-blue-300'}`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Brand Name</label>
                                    <input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. Nike" value={brandName} onChange={e => setBrandName(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Brand Email</label>
                                    <input required type="email" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="contact@brand.com" value={brandEmail} onChange={e => setBrandEmail(e.target.value)} />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Your Budget (€)</label>
                                <input required type="number" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. 200" value={budget} onChange={e => setBudget(e.target.value)} />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Details</label>
                                <textarea required rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Describe your campaign..." value={message} onChange={e => setMessage(e.target.value)}></textarea>
                            </div>

                            <button type="submit" disabled={sending} className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3 rounded-xl transition-all shadow-lg disabled:opacity-50">
                                {sending ? "Sending..." : "Send Proposal"}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">🚀</div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Proposal Sent!</h3>
                        <p className="text-slate-500 mb-6">
                            This request has been logged in our system. You will receive an update at <strong>{brandEmail}</strong> soon.
                        </p>
                        <button onClick={() => { setShowProposalModal(false); setSent(false); }} className="text-blue-600 font-bold hover:underline">
                            Close Window
                        </button>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* --- COVER & HEADER (ΙΔΙΑ ΜΕ ΠΡΙΝ) --- */}
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
                <button 
                    onClick={() => setShowProposalModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-transform hover:-translate-y-1 flex items-center gap-2"
                >
                    <span>⚡</span> Contact for Work
                </button>
            </div>
        </div>

        {/* --- TABS --- */}
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

        {/* --- CONTENT --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
            <div className="lg:col-span-2 space-y-8">
                {activeTab === "overview" && (
                    <>
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                            <h2 className="text-xl font-bold text-slate-900 mb-4">About</h2>
                            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{profile.bio || "No bio available."}</p>
                        </div>
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
                        <button onClick={() => setShowProposalModal(true)} className="w-full mt-6 bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-black transition-colors">
                            Request Custom Quote
                        </button>
                     </div>
                )}
            </div>
            <div className="space-y-6">
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