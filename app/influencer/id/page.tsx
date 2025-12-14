"use client";

import { useEffect, useState, use } from "react"; // Προσθήκη use για Next.js 15/16 params
import Image from "next/image";
// Προσαρμογή paths: Πάμε 3 φακέλους πίσω (../../..) για να βγούμε από το app και να βρούμε το components
import { supabase } from "../../../lib/supabaseClient"; 
import { dummyInfluencers, Influencer } from "../../../components/Directory"; 

// Next.js 16 params type definition
type Params = Promise<{ id: string }>;

export default function InfluencerProfile(props: { params: Params }) {
  // Στο Next.js 15+ τα params είναι Promise, τα κάνουμε unwrap με το hook use()
  const params = use(props.params);
  const id = params.id;

  const [profile, setProfile] = useState<Influencer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) return;

      // 1. Έλεγχος αν είναι Dummy ID (ξεκινάει με 'dummy-')
      if (id.startsWith('dummy-')) {
        const found = dummyInfluencers.find((d) => String(d.id) === id);
        setProfile(found || null);
        setLoading(false);
        return;
      }

      // 2. Αν δεν είναι dummy, ψάχνουμε στη Supabase
      const { data, error } = await supabase
        .from("influencers")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        console.error("Not found", error);
        setLoading(false);
        return;
      }

      // Μετατροπή Supabase data -> Influencer Interface
      const socialsObj: { [key: string]: string } = {};
      if (Array.isArray(data.accounts)) {
        data.accounts.forEach((acc: any) => {
            if (acc.platform && acc.username) socialsObj[acc.platform.toLowerCase()] = acc.username;
        });
      }

      setProfile({
        id: data.id,
        name: data.display_name,
        bio: data.bio || "",
        avatar: data.avatar_url || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=400&q=80",
        verified: data.verified,
        socials: socialsObj,
        followers: {},
        categories: ["General"], 
        platform: "Instagram",
        gender: data.gender,
        videos: Array.isArray(data.videos) ? data.videos : []
      });
      setLoading(false);
    };

    fetchProfile();
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading Profile...</div>;
  if (!profile) return <div className="min-h-screen flex items-center justify-center text-slate-500">Influencer not found.</div>;

  return (
    <div className="bg-slate-50 min-h-screen pb-20 font-sans">
      {/* 1. COVER PHOTO */}
      <div className="h-64 md:h-80 w-full relative bg-slate-900">
         <Image 
            src="https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1500&q=80"
            alt="Cover"
            fill
            className="object-cover opacity-60"
         />
         <div className="absolute top-6 left-6">
             <a href="/" className="text-white bg-black/30 hover:bg-black/50 px-4 py-2 rounded-lg backdrop-blur-sm transition-all font-medium">
                ← Πίσω
             </a>
         </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 relative -mt-20 z-10">
        <div className="flex flex-col md:flex-row gap-8">
          
          {/* 2. SIDEBAR */}
          <div className="w-full md:w-1/3 flex flex-col gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                <div className="relative w-40 h-40 mx-auto rounded-full border-4 border-white shadow-lg overflow-hidden mb-4 bg-slate-100">
                  <Image src={profile.avatar} alt={profile.name} fill className="object-cover" />
                </div>
                <h1 className="text-2xl font-extrabold text-slate-900 flex items-center justify-center gap-2 mb-1">
                  {profile.name} 
                  {profile.verified && <span className="text-blue-500 text-xl" title="Verified">✔️</span>}
                </h1>
                <p className="text-slate-500 font-medium mb-6 text-sm uppercase tracking-wide">{profile.gender} • {profile.categories.join(", ")}</p>
                
                <div className="flex flex-wrap justify-center gap-3 mb-8">
                   {Object.entries(profile.socials).map(([plat, user]) => (
                     <a 
                        key={plat} 
                        href={`https://${plat}.com/${user}`} 
                        target="_blank"
                        className="bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 px-4 py-2 rounded-lg font-bold capitalize transition-colors flex items-center gap-2 text-sm border border-slate-200"
                     >
                       {plat} ↗
                     </a>
                   ))}
                </div>
                
                <button className="w-full bg-slate-900 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:-translate-y-1">
                  Συνεργασία
                </button>
            </div>

            {/* Stats Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-900 mb-4 uppercase text-xs tracking-wider">Analytics Snapshot</h3>
                <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                        <span className="text-slate-500 text-sm">Main Platform</span>
                        <span className="font-bold text-slate-900 capitalize">{profile.platform}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                        <span className="text-slate-500 text-sm">Followers</span>
                        <span className="font-bold text-slate-900">
                             {/* Απλή λογική για εμφάνιση followers αν υπάρχουν στα dummy */}
                             {profile.followers?.instagram ? (profile.followers.instagram / 1000).toFixed(1) + 'k' : 'N/A'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center pb-2">
                        <span className="text-slate-500 text-sm">Engagement</span>
                        <span className="font-bold text-green-600">High</span>
                    </div>
                </div>
            </div>
          </div>

          {/* 3. MAIN CONTENT */}
          <div className="w-full md:w-2/3 flex flex-col gap-8 mt-4 md:mt-20">
             
             {/* Bio */}
             <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <h2 className="text-xl font-bold text-slate-900 mb-4">About Creator</h2>
                <p className="text-slate-600 leading-relaxed text-lg">
                    {profile.bio || "Δεν έχει προστεθεί βιογραφικό."}
                </p>
             </div>

             {/* Videos */}
             <div>
                <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                    Portfolio / Highlights
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        {profile.videos?.length || 0}
                    </span>
                </h2>
                
                {profile.videos && profile.videos.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {profile.videos.map((vid, i) => (
                        <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
                            <div className="h-48 bg-slate-100 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                                <span className="text-5xl opacity-20 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 duration-300">▶</span>
                                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-20 transition-opacity"></div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400 uppercase">Video {i + 1}</span>
                                <a href={vid} target="_blank" className="text-blue-600 text-sm font-bold hover:underline">
                                    Watch ↗
                                </a>
                            </div>
                        </div>
                     ))}
                  </div>
                ) : (
                    <div className="bg-white rounded-xl p-12 text-center border border-dashed border-slate-300">
                        <p className="text-slate-400 font-medium">Ο influencer δεν έχει ανεβάσει βίντεο ακόμα.</p>
                    </div>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}