"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
// Πηγαίνουμε 3 φακέλους πίσω: [id] -> influencer -> app -> root -> components
import { dummyInfluencers, Influencer } from "../../../components/Directory"; 
import { supabase } from "../../../lib/supabaseClient";

// Για Next.js 15/16
type Params = Promise<{ id: string }>;

export default function InfluencerProfile(props: { params: Params }) {
  const params = use(props.params);
  const id = params.id; // Αυτό είναι string, π.χ. "dummy-1" ή "15"

  const [profile, setProfile] = useState<Influencer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) return;

      console.log("Checking ID:", id); // Για debugging

      // 1. ΕΛΕΓΧΟΣ ΓΙΑ DUMMY DATA
      // Αν το ID περιέχει τη λέξη "dummy", ψάχνουμε ΜΟΝΟ στα τοπικά δεδομένα
      if (id.toString().includes("dummy")) {
        const found = dummyInfluencers.find((d) => String(d.id) === id);
        if (found) {
          setProfile(found);
          setLoading(false);
          return; // Σταματάμε εδώ, δεν ρωτάμε τη βάση
        }
      }

      // 2. ΕΛΕΓΧΟΣ ΓΙΑ REAL DATA (SUPABASE)
      // Ρωτάμε τη βάση ΜΟΝΟ αν το ID είναι καθαρός αριθμός (για να αποφύγουμε το 400 Error)
      const isNumeric = /^\d+$/.test(id);
      
      if (isNumeric) {
        const { data, error } = await supabase
          .from("influencers")
          .select("*")
          .eq("id", id)
          .single();

        if (error) {
          console.error("Supabase Error:", error);
        } else if (data) {
          // Μετατροπή δεδομένων βάσης
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
            categories: ["New"], 
            platform: "Instagram",
            gender: data.gender,
            location: data.location,
            languages: data.languages,
            min_rate: data.min_rate,
            videos: Array.isArray(data.videos) ? data.videos : []
          });
          setLoading(false);
          return;
        }
      }

      // Αν δεν βρέθηκε πουθενά
      setLoading(false);
    };

    fetchProfile();
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!profile) return <div className="min-h-screen flex items-center justify-center">Influencer not found (ID: {id})</div>;

  return (
    <div className="bg-slate-50 min-h-screen pb-20 font-sans">
      {/* Cover Photo */}
      <div className="h-64 md:h-80 w-full relative bg-slate-900">
         <Image 
            src="https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1500&q=80"
            alt="Cover"
            fill
            className="object-cover opacity-60"
         />
         <div className="absolute top-6 left-6 z-20">
             <a href="/" className="text-white bg-black/30 hover:bg-black/50 px-4 py-2 rounded-lg backdrop-blur-sm transition-all font-medium border border-white/20">
                ← Επιστροφή
             </a>
         </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 relative -mt-20 z-10">
        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Sidebar */}
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
                <p className="text-slate-500 font-medium mb-2 text-sm uppercase tracking-wide">
                  {profile.location || "Greece"}
                </p>
                
                {/* Info Pills */}
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                   <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{profile.gender === "Male" ? "Άνδρας" : "Γυναίκα"}</span>
                   {profile.min_rate && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">From {profile.min_rate}</span>}
                </div>

                <div className="flex flex-wrap justify-center gap-3 mb-8">
                   {Object.entries(profile.socials).map(([plat, user]) => (
                     <a key={plat} href={`https://${plat}.com/${user}`} target="_blank" className="bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 px-4 py-2 rounded-lg font-bold capitalize transition-colors flex items-center gap-2 text-sm border border-slate-200">
                       {plat} ↗
                     </a>
                   ))}
                </div>
                
                <button className="w-full bg-slate-900 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all">
                  Συνεργασία
                </button>
            </div>

            {/* Additional Info */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-900 mb-4 uppercase text-xs tracking-wider">Details</h3>
                <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                        <span className="text-slate-500 text-sm">Languages</span>
                        <span className="font-medium text-slate-900 text-right">{profile.languages || "-"}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                        <span className="text-slate-500 text-sm">Followers</span>
                        <span className="font-bold text-slate-900">
                            {profile.followers?.instagram ? (profile.followers.instagram / 1000).toFixed(1) + 'k' : 'N/A'}
                        </span>
                    </div>
                </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="w-full md:w-2/3 flex flex-col gap-8 mt-4 md:mt-20">
             <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <h2 className="text-xl font-bold text-slate-900 mb-4">About Creator</h2>
                <p className="text-slate-600 leading-relaxed text-lg whitespace-pre-wrap">
                    {profile.bio || "Δεν έχει προστεθεί βιογραφικό."}
                </p>
             </div>

             <div>
                <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                    Portfolio / Highlights
                </h2>
                {profile.videos && profile.videos.length > 0 && profile.videos[0] !== "" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {profile.videos.map((vid, i) => (
                        <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                            <div className="h-40 bg-slate-100 rounded-lg mb-3 flex items-center justify-center text-slate-400">
                                🎬 Video {i+1}
                            </div>
                            <a href={vid} target="_blank" className="text-blue-600 text-sm font-bold hover:underline block truncate">
                                {vid}
                            </a>
                        </div>
                     ))}
                  </div>
                ) : (
                    <div className="bg-white rounded-xl p-12 text-center border border-dashed border-slate-300 text-slate-400">
                        No videos uploaded yet.
                    </div>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}