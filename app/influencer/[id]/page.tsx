"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import { dummyInfluencers, Influencer } from "@/components/Directory"; 
import { supabase } from "@/lib/supabaseClient";
import { getVideoThumbnail, isVideoUrl } from "@/lib/videoThumbnail";

type Params = Promise<{ id: string }>;

interface ProInfluencer extends Influencer {
  engagement_rate?: string;
  avg_likes?: string;
  audience_data?: { male: number; female: number; top_age: string };
  rate_card?: { story: string; post: string; reel: string };
  past_brands?: string[];
}

const t = {
  el: {
    back: "← Επιστροφή",
    contact: "Συνεργασία",
    contact_btn: "Ζήτησε Προσφορά",
    verified: "Επαληθευμένος",
    male: "Άνδρας",
    female: "Γυναίκα",
    lang: "Γλώσσες",
    foll: "Followers",
    about: "Σχετικά",
    portfolio: "Portfolio / Highlights",
    connect: "Σύνδεση",
    collabs: "Συνεργασίες",
    no_bio: "Δεν υπάρχει βιογραφικό.",
    no_vid: "Δεν έχουν ανέβει βίντεο.",
    tab_over: "Επισκοπηση",
    tab_aud: "Κοινο",
    tab_price: "Τιμες",
    stat_eng: "Αλληλεπίδραση",
    stat_likes: "Μ.Ο. Likes",
    aud_gen: "Φύλο Κοινού",
    aud_age: "Ηλικιακό Group",
    price_story: "Instagram Story (24h)",
    price_post: "Instagram Post",
    price_reel: "Reel / TikTok",
    price_note: "* Οι τιμές ενδέχεται να αλλάξουν ανάλογα το project.",
    modal_title: "Συνεργασία με",
    modal_sub: "Στείλε την πρότασή σου. Θα ειδοποιηθούν άμεσα.",
    modal_srv: "Επιλογή Υπηρεσίας",
    modal_brand: "Όνομα Brand",
    modal_email: "Email Brand",
    modal_bud: "Budget (€)",
    modal_desc: "Περιγραφή Project",
    modal_btn: "Αποστολή Πρότασης",
    modal_success: "Η πρόταση στάλθηκε!",
    modal_success_desc: "Η αίτησή σου καταχωρήθηκε. Θα λάβεις απάντηση στο email σου.",
    modal_close: "Κλείσιμο",
    modal_sending: "Αποστολή..."
  },
  en: {
    back: "← Back",
    contact: "Contact for Work",
    contact_btn: "Request Custom Quote",
    verified: "Verified",
    male: "Male",
    female: "Female",
    lang: "Languages",
    foll: "Followers",
    about: "About",
    portfolio: "Portfolio / Highlights",
    connect: "Connect",
    collabs: "Brand Collabs",
    no_bio: "No bio available.",
    no_vid: "No videos uploaded.",
    tab_over: "Overview",
    tab_aud: "Audience",
    tab_price: "Pricing",
    stat_eng: "Engagement",
    stat_likes: "Avg Likes",
    aud_gen: "Audience Gender",
    aud_age: "Top Age Group",
    price_story: "Instagram Story (24h)",
    price_post: "Instagram Post",
    price_reel: "Reel / TikTok",
    price_note: "* Prices may vary depending on project scope.",
    modal_title: "Work with",
    modal_sub: "Send a proposal. We'll notify them instantly.",
    modal_srv: "Select Service",
    modal_brand: "Brand Name",
    modal_email: "Brand Email",
    modal_bud: "Budget (€)",
    modal_desc: "Project Details",
    modal_btn: "Send Proposal",
    modal_success: "Proposal Sent!",
    modal_success_desc: "This request has been logged. You will receive an update via email.",
    modal_close: "Close Window",
    modal_sending: "Sending..."
  }
};

export default function InfluencerProfile(props: { params: Params }) {
  const params = use(props.params);
  const id = params.id;
  
  const [lang, setLang] = useState<"el" | "en">("el");
  const txt = t[lang];

  const [activeTab, setActiveTab] = useState("overview");
  const [profile, setProfile] = useState<ProInfluencer | null>(null);
  const [loading, setLoading] = useState(true);

  // MODAL STATE
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalType, setProposalType] = useState("Instagram Story");
  const [brandName, setBrandName] = useState("");
  const [brandEmail, setBrandEmail] = useState("");
  const [budget, setBudget] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) return;

      // 1. DUMMY CHECK (Keep the logic as is)
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

      // 2. REAL CHECK - Works with both UUIDs (new influencers) and numeric IDs (if any)
      // Try to fetch by id (works for both UUIDs and numeric IDs)
      const { data, error } = await supabase.from("influencers").select("*").eq("id", id).single();
      if (data && !error) {
        const socialsObj: { [key: string]: string } = {};
        if (Array.isArray(data.accounts)) {
           data.accounts.forEach((acc: any) => { if(acc.platform) socialsObj[acc.platform.toLowerCase()] = acc.username; });
        }
        
        // Build followers object from accounts
        const followersObj: { [key: string]: number } = {};
        if (Array.isArray(data.accounts)) {
          data.accounts.forEach((acc: any) => {
            if (acc.platform && acc.followers) {
              const platform = acc.platform.toLowerCase();
              // Parse followers string (e.g., "15k" -> 15000, "1.5M" -> 1500000)
              let followersNum = 0;
              const followersStr = acc.followers.toString().toLowerCase().replace(/\s/g, '');
              if (followersStr.includes('m')) {
                followersNum = parseFloat(followersStr) * 1000000;
              } else if (followersStr.includes('k')) {
                followersNum = parseFloat(followersStr) * 1000;
              } else {
                followersNum = parseFloat(followersStr) || 0;
              }
              followersObj[platform] = Math.round(followersNum);
            }
          });
        }
        
        setProfile({
          id: data.id,
          name: data.display_name,
          bio: data.bio || "",
          avatar: data.avatar_url || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=400&q=80",
          verified: data.verified,
          socials: socialsObj,
          followers: followersObj,
          categories: data.category ? [data.category] : ["Creator"],
          platform: "Instagram",
          gender: data.gender,
          location: data.location,
          languages: data.languages,
          min_rate: data.min_rate,
          videos: Array.isArray(data.videos) ? data.videos : [],
          engagement_rate: data.engagement_rate || "-",
          avg_likes: data.avg_likes || "-",
          audience_data: {
            male: data.audience_male_percent || 50,
            female: data.audience_female_percent || 50,
            top_age: data.audience_top_age || "?"
          },
          rate_card: data.rate_card || { story: "Ask", post: "Ask", reel: "Ask" },
          past_brands: data.past_brands || []
        });
      }
      setLoading(false);
    };
    fetchProfile();
  }, [id]);

  // --- HANDLER: SEND PROPOSAL (UPDATED) ---
  const handleSendProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
        // 1. Save Proposal in DB
        // Note: influencer_id should match the type in your proposals table
        // If it's UUID (string), use id directly; if it's integer, we need to handle differently
        const proposalData: any = {
            influencer_id: id, // Use id as-is (works for both UUID and numeric)
            brand_name: brandName,
            brand_email: brandEmail,
            service_type: proposalType,
            budget: budget,
            message: message,
            status: 'pending'
        };
        
        const { error } = await supabase.from("proposals").insert([proposalData]);
        
        if (error) {
            console.error(error);
            alert("Something went wrong. Please try again.");
            setSending(false);
            return;
        }

        // 2. Send Brand Confirmation Email
        try {
            await fetch('/api/emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    type: 'proposal_brand_confirmation', 
                    email: brandEmail,
                    brandName: brandName,
                    influencerName: profile?.name,
                    proposalType: proposalType
                })
            });
        } catch (mailError) {
             console.error("Brand Confirmation Email failed:", mailError);
        }

        // 3. Send Admin Notification Email
        try {
            await fetch('/api/emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    type: 'proposal_admin_notification', 
                    email: brandEmail,
                    brandName: brandName,
                    influencerName: profile?.name || 'Unknown',
                    influencerId: id,
                    proposalType: proposalType,
                    budget: budget,
                    message: message
                })
            });
        } catch (mailError) {
             console.error("Admin Notification Email failed:", mailError);
        }

        setSent(true);
    } catch (err) {
        console.error("Error sending proposal:", err);
        alert("Something went wrong. Please try again.");
    } finally {
        setSending(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading Profile...</div>;
  if (!profile) return <div className="min-h-screen flex items-center justify-center text-slate-500">Influencer not found.</div>;

  return (
    <div className="bg-white min-h-screen pb-20 font-sans relative text-slate-900">
      
      {/* LANG TOGGLE */}
      <div className="fixed top-6 right-6 z-50">
          <button onClick={() => setLang(lang === "el" ? "en" : "el")} className="bg-white/20 backdrop-blur text-white px-3 py-1 rounded font-bold border border-white/30 hover:bg-white/40 shadow-sm">
            {lang === "el" ? "🇬🇧 EN" : "🇬🇷 EL"}
          </button>
      </div>

      {/* PROPOSAL MODAL */}
      {showProposalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative">
                <button 
                    onClick={() => { setShowProposalModal(false); setSent(false); }}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-xl z-10"
                >✕</button>

                {!sent ? (
                    <div className="p-8">
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">{txt.modal_title} {profile.name}</h3>
                        <p className="text-slate-500 text-sm mb-6">{txt.modal_sub}</p>
                        
                        <form onSubmit={handleSendProposal} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{txt.modal_srv}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['Story', 'Post', 'Reel'].map((type) => (
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
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{txt.modal_brand}</label>
                                    <input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" placeholder="Brand" value={brandName} onChange={e => setBrandName(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{txt.modal_email}</label>
                                    <input required type="email" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" placeholder="Email" value={brandEmail} onChange={e => setBrandEmail(e.target.value)} />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{txt.modal_bud}</label>
                                <input required type="number" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" placeholder="200" value={budget} onChange={e => setBudget(e.target.value)} />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{txt.modal_desc}</label>
                                <textarea required rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" placeholder="..." value={message} onChange={e => setMessage(e.target.value)}></textarea>
                            </div>

                            <button type="submit" disabled={sending} className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3 rounded-xl transition-all shadow-lg disabled:opacity-50">
                                {sending ? txt.modal_sending : txt.modal_btn}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">🚀</div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">{txt.modal_success}</h3>
                        <p className="text-slate-500 mb-6">{txt.modal_success_desc}</p>
                        <button onClick={() => { setShowProposalModal(false); setSent(false); }} className="text-blue-600 font-bold hover:underline">
                            {txt.modal_close}
                        </button>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* COVER & HEADER (Keep the rest of the code as is) */}
      <div className="h-72 w-full relative bg-slate-900">
         <Image src="https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1500&q=80" alt="Cover" fill className="object-cover opacity-50" />
         <div className="absolute top-6 left-6 z-20">
             <a href="/" className="text-white bg-white/20 backdrop-blur-md px-4 py-2 rounded-lg font-medium hover:bg-white/30 transition">{txt.back}</a>
         </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 relative -mt-24 z-10">
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 flex flex-col md:flex-row items-center md:items-end gap-6">
            <div className="relative w-40 h-40 rounded-full border-4 border-white shadow-lg overflow-hidden bg-slate-200 -mt-20 md:mb-0">
                <Image src={profile.avatar} alt={profile.name} fill className="object-cover" />
            </div>
            <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold text-slate-900 flex items-center justify-center md:justify-start gap-2">
                    {profile.name} {profile.verified && <span className="text-blue-500 text-xl" title={txt.verified}>✔️</span>}
                </h1>
                <p className="text-slate-500">{profile.location} • {profile.gender === "Male" ? txt.male : txt.female}</p>
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3">
                    {profile.languages?.split(",").map((l,i) => <span key={i} className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">{l.trim()}</span>)}
                </div>
            </div>
            <div className="flex gap-3">
                <button onClick={() => setShowProposalModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-transform hover:-translate-y-1 flex items-center gap-2">
                    <span>⚡</span> {txt.contact}
                </button>
                <button 
                    onClick={() => {
                        const brandEmail = prompt("Enter your brand email to start messaging:");
                        const brandNameInput = prompt("Enter your brand name:");
                        if (brandEmail) {
                            window.location.href = `/messages?influencer=${id}&brandEmail=${encodeURIComponent(brandEmail)}&brandName=${encodeURIComponent(brandNameInput || brandEmail)}`;
                        }
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-transform hover:-translate-y-1 flex items-center gap-2"
                >
                    <span>💬</span> Message
                </button>
            </div>
        </div>

        {/* TABS */}
        <div className="mt-8 border-b border-slate-200">
            <nav className="flex gap-8">
                <button onClick={() => setActiveTab("overview")} className={`pb-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === "overview" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{txt.tab_over}</button>
                <button onClick={() => setActiveTab("audience")} className={`pb-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === "audience" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{txt.tab_aud}</button>
                <button onClick={() => setActiveTab("pricing")} className={`pb-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === "pricing" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{txt.tab_price}</button>
            </nav>
        </div>

        {/* CONTENT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
            <div className="lg:col-span-2 space-y-8">
                {activeTab === "overview" && (
                    <>
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                            <h2 className="text-xl font-bold text-slate-900 mb-4">{txt.about}</h2>
                            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{profile.bio || txt.no_bio}</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                             <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                                <p className="text-slate-400 text-xs font-bold uppercase">{txt.stat_eng}</p>
                                <p className="text-2xl font-extrabold text-blue-600">{profile.engagement_rate}</p>
                             </div>
                             <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                                <p className="text-slate-400 text-xs font-bold uppercase">{txt.stat_likes}</p>
                                <p className="text-2xl font-extrabold text-slate-800">{profile.avg_likes}</p>
                             </div>
                             <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                                <p className="text-slate-400 text-xs font-bold uppercase">{txt.foll}</p>
                                <p className="text-2xl font-extrabold text-slate-800">
                                    {profile.followers?.instagram ? (profile.followers.instagram / 1000).toFixed(1) + 'k' : 'N/A'}
                                </p>
                             </div>
                             <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                                <p className="text-slate-400 text-xs font-bold uppercase">{txt.collabs}</p>
                                <p className="text-2xl font-extrabold text-purple-600">{profile.past_brands?.length || 0}</p>
                             </div>
                        </div>
                         <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-4">{txt.portfolio}</h3>
                            {profile.videos && profile.videos.length > 0 && profile.videos[0] !== "" ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {profile.videos.map((vid, i) => {
                                        const thumbnail = getVideoThumbnail(vid);
                                        const isVideo = isVideoUrl(vid);
                                        const isImage = vid.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                                        return (
                                            <a key={i} href={vid} target="_blank" rel="noopener noreferrer" className="block group relative h-48 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                                                {thumbnail || isImage ? (
                                                    <>
                                                        <Image 
                                                            src={thumbnail || vid} 
                                                            alt={`Portfolio item ${i+1}`} 
                                                            fill 
                                                            className="object-cover" 
                                                            unoptimized
                                                        />
                                                        {isVideo && (
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                                                                <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                                                    <span className="text-3xl text-slate-900 ml-1">▶</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-black/80 to-transparent text-white text-sm font-medium">
                                                            {isVideo ? `Video ${i+1}` : `Photo ${i+1}`}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                                                        <div className="text-center">
                                                            <span className="text-5xl opacity-80 group-hover:scale-110 transition-transform block mb-2">▶</span>
                                                            <span className="text-white text-sm opacity-75">Video Link</span>
                                                        </div>
                                                        <div className="absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-black/80 to-transparent text-white text-sm font-medium">
                                                            Highlight #{i+1}
                                                        </div>
                                                    </div>
                                                )}
                                            </a>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400">{txt.no_vid}</div>
                            )}
                        </div>
                    </>
                )}
                {activeTab === "audience" && (
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                        <h2 className="text-xl font-bold text-slate-900 mb-6">{txt.aud_gen}</h2>
                        
                        {/* Gender Chart using CSS */}
                        <div className="mb-8">
                            <div className="flex justify-between mb-2 font-medium text-slate-700">
                                <span>{txt.female} ({profile.audience_data?.female}%)</span>
                                <span>{txt.male} ({profile.audience_data?.male}%)</span>
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
                                <p className="text-slate-500 text-sm">{txt.aud_age}</p>
                                <p className="text-xl font-bold text-slate-900">{profile.audience_data?.top_age}</p>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === "pricing" && (
                     <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                        <h2 className="text-xl font-bold text-slate-900 mb-6">{txt.tab_price}</h2>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-4 border-b border-slate-100">
                                <span className="font-medium text-slate-700">{txt.price_story}</span>
                                <span className="font-bold text-xl text-slate-900">{profile.rate_card?.story}</span>
                            </div>
                            <div className="flex justify-between items-center p-4 border-b border-slate-100">
                                <span className="font-medium text-slate-700">{txt.price_post}</span>
                                <span className="font-bold text-xl text-slate-900">{profile.rate_card?.post}</span>
                            </div>
                            <div className="flex justify-between items-center p-4 border-b border-slate-100">
                                <span className="font-medium text-slate-700">{txt.price_reel}</span>
                                <span className="font-bold text-xl text-slate-900">{profile.rate_card?.reel}</span>
                            </div>
                        </div>
                        <p className="mt-6 text-xs text-slate-400 text-center">{txt.price_note}</p>
                        <button onClick={() => setShowProposalModal(true)} className="w-full mt-6 bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-black transition-colors">
                            {txt.contact_btn}
                        </button>
                     </div>
                )}
            </div>
            <div className="space-y-6">
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase">{txt.connect}</h3>
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
                    <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase">{txt.collabs}</h3>
                    <div className="flex flex-wrap gap-2">
                        {profile.past_brands && profile.past_brands.length > 0 ? (
                            profile.past_brands.map((b, i) => <span key={i} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-200">{b}</span>)
                        ) : (
                            <span className="text-slate-400 text-sm">-</span>
                        )}
                    </div>
                 </div>
            </div>
        </div>
      </div>
    </div>
  );
}