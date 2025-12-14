"use client";

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Image from "next/image";

type Account = { platform: string; username: string };

export default function InfluencerSignupForm() {
  const [step, setStep] = useState(1); // 1: Info, 2: Socials, 3: Portfolio/Rates
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // --- DATA STATES ---
  // Step 1: Basic
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState("Female");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  
  // Step 2: Socials
  const [accounts, setAccounts] = useState<Account[]>([{ platform: "Instagram", username: "" }]);
  const [languages, setLanguages] = useState("");
  
  // Step 3: Portfolio & Rates
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [videos, setVideos] = useState<string[]>([""]);
  const [minRate, setMinRate] = useState("");

  // --- HANDLERS ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleAccountChange = (i: number, field: keyof Account, value: string) => {
    const copy = [...accounts]; copy[i][field] = value; setAccounts(copy);
  };
  const addAccount = () => setAccounts([...accounts, { platform: "Instagram", username: "" }]);
  const removeAccount = (i: number) => { const copy = [...accounts]; copy.splice(i, 1); setAccounts(copy); };

  const handleVideoChange = (i: number, val: string) => { const copy = [...videos]; copy[i] = val; setVideos(copy); };
  const addVideo = () => setVideos([...videos, ""]);
  const removeVideo = (i: number) => { const copy = [...videos]; copy.splice(i, 1); setVideos(copy); };

  // --- SUBMIT ---
  const handleSubmit = async () => {
    setLoading(true);
    try {
      let avatarUrl = "";
      if (avatarFile) {
        const fileName = `${Date.now()}-${avatarFile.name}`;
        const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, avatarFile);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
        avatarUrl = publicUrlData.publicUrl;
      }

      const { error } = await supabase.from("influencers").insert([
        { 
          display_name: displayName, 
          gender, 
          location,
          languages,
          min_rate: minRate,
          contact_email: email,
          bio, 
          accounts, 
          videos: videos.filter(v => v !== ""), // Remove empty video links
          avatar_url: avatarUrl 
        }
      ]);

      if (error) throw error;
      setMessage("Success! Your profile is under review.");
      setStep(4); // Success Screen
    } catch (err: any) {
      console.error(err);
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- UI COMPONENTS ---
  const ProgressSteps = () => (
    <div className="flex justify-between mb-8 relative">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -z-10"></div>
        {[1, 2, 3].map((s) => (
            <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${step >= s ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                {s}
            </div>
        ))}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh] md:h-[800px] max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="bg-slate-900 p-6 text-white text-center">
        <h3 className="text-2xl font-bold">Join the Creator Club</h3>
        <p className="text-slate-400 text-sm">Complete your profile to get matched with brands.</p>
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        {step < 4 && <ProgressSteps />}

        {/* --- STEP 1: PERSONAL INFO --- */}
        {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <h2 className="text-xl font-bold text-slate-900">Let's start with the basics</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="label">Full Name</label>
                        <input type="text" className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Maria Pappa" />
                    </div>
                    <div>
                        <label className="label">Gender</label>
                        <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
                            <option value="Female">Female</option>
                            <option value="Male">Male</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="label">Location</label>
                    <input type="text" className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Athens, Greece" />
                </div>

                <div>
                    <label className="label">Contact Email</label>
                    <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="brands@example.com" />
                </div>

                <div>
                    <label className="label">Short Bio</label>
                    <textarea className="input" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell brands about your style..." />
                </div>

                <button onClick={() => setStep(2)} disabled={!displayName || !email} className="btn-primary">Next: Socials →</button>
            </div>
        )}

        {/* --- STEP 2: SOCIALS --- */}
        {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <h2 className="text-xl font-bold text-slate-900">Connect your channels</h2>
                
                <div className="space-y-3">
                    <label className="label">Social Accounts</label>
                    {accounts.map((acc, i) => (
                        <div key={i} className="flex gap-3">
                            <select className="input w-1/3" value={acc.platform} onChange={(e) => handleAccountChange(i, "platform", e.target.value)}>
                                <option>Instagram</option>
                                <option>TikTok</option>
                                <option>YouTube</option>
                            </select>
                            <div className="flex-1 relative">
                                <span className="absolute left-3 top-3 text-slate-400">@</span>
                                <input type="text" className="input pl-8" value={acc.username} onChange={(e) => handleAccountChange(i, "username", e.target.value)} placeholder="username" />
                            </div>
                            <button onClick={() => removeAccount(i)} className="text-red-500 font-bold px-2">✕</button>
                        </div>
                    ))}
                    <button onClick={addAccount} className="text-blue-600 text-sm font-bold">+ Add Another Platform</button>
                </div>

                <div>
                    <label className="label">Languages Spoken</label>
                    <input type="text" className="input" value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="e.g. Greek, English, Italian" />
                </div>

                <div className="flex gap-4">
                    <button onClick={() => setStep(1)} className="btn-secondary">← Back</button>
                    <button onClick={() => setStep(3)} className="btn-primary">Next: Portfolio →</button>
                </div>
            </div>
        )}

        {/* --- STEP 3: PORTFOLIO & RATES --- */}
        {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <h2 className="text-xl font-bold text-slate-900">Show off your work</h2>
                
                {/* Avatar Upload */}
                <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <div className="relative w-20 h-20 rounded-full bg-white shadow-sm overflow-hidden flex items-center justify-center">
                        {avatarPreview ? <Image src={avatarPreview} alt="Preview" fill className="object-cover" /> : <span className="text-2xl">📸</span>}
                    </div>
                    <div>
                        <label className="btn-secondary cursor-pointer block text-center text-sm">
                            Upload Profile Photo
                            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                        </label>
                    </div>
                </div>

                {/* Video Links */}
                <div className="space-y-3">
                    <label className="label">Best Video Highlights (Links)</label>
                    <p className="text-xs text-slate-500 mb-2">Paste links from TikTok, Reels, or YouTube.</p>
                    {videos.map((vid, i) => (
                        <div key={i} className="flex gap-3">
                            <input type="text" className="input" value={vid} onChange={(e) => handleVideoChange(i, e.target.value)} placeholder="https://..." />
                            {videos.length > 1 && <button onClick={() => removeVideo(i)} className="text-red-500 font-bold px-2">✕</button>}
                        </div>
                    ))}
                    <button onClick={addVideo} className="text-blue-600 text-sm font-bold">+ Add Video Link</button>
                </div>

                {/* Min Rate */}
                <div>
                    <label className="label">Minimum Rate / Starting Budget (€)</label>
                    <input type="number" className="input" value={minRate} onChange={(e) => setMinRate(e.target.value)} placeholder="e.g. 150" />
                </div>

                <div className="flex gap-4 pt-4">
                    <button onClick={() => setStep(2)} className="btn-secondary">← Back</button>
                    <button onClick={handleSubmit} disabled={loading} className="btn-primary bg-slate-900 text-white">
                        {loading ? "Creating Profile..." : "Complete Signup"}
                    </button>
                </div>
                {message && <p className="text-red-500 text-sm text-center mt-2">{message}</p>}
            </div>
        )}

        {/* --- SUCCESS STATE --- */}
        {step === 4 && (
            <div className="text-center py-20 animate-in zoom-in duration-300">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">🎉</div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Welcome aboard!</h2>
                <p className="text-slate-500 max-w-md mx-auto mb-8">
                    Your profile has been created successfully. Our team will verify your account within 24 hours.
                </p>
                <button onClick={() => window.location.reload()} className="btn-secondary">Close</button>
            </div>
        )}

      </div>

      <style jsx>{`
        .label { @apply block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1; }
        .input { @apply w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all; }
        .btn-primary { @apply flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed; }
        .btn-secondary { @apply px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors; }
      `}</style>
    </div>
  );
}







