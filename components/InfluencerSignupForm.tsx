"use client";

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Account = { platform: string; username: string };

export default function InfluencerSignupForm() {
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState("Female");
  const [accounts, setAccounts] = useState<Account[]>([{ platform: "Instagram", username: "" }]);
  const [bio, setBio] = useState("");
  const [videos, setVideos] = useState<string[]>([""]);
  const [email, setEmail] = useState("");
  const [lang, setLang] = useState<"el" | "en">("el");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAccountChange = (i: number, field: keyof Account, value: string) => {
    const copy = [...accounts];
    copy[i][field] = value;
    setAccounts(copy);
  };
  const removeAccount = (i: number) => {
    const copy = [...accounts];
    copy.splice(i, 1);
    setAccounts(copy);
  };
  const addAccount = () => setAccounts([...accounts, { platform: "Instagram", username: "" }]);
  
  const handleVideoChange = (i: number, val: string) => {
    const copy = [...videos];
    copy[i] = val;
    setVideos(copy);
  };
  const removeVideo = (i: number) => {
    const copy = [...videos];
    copy.splice(i, 1);
    setVideos(copy);
  };
  const addVideo = () => setVideos([...videos, ""]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("influencers").insert([
      { display_name: displayName, gender, accounts, bio, videos, contact_email: email }
    ]);
    setLoading(false);
    if (error) setMessage(error.message);
    else setMessage(lang === "el" ? "Επιτυχία! Το προφίλ ελέγχεται." : "Success! Profile under review.");
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[85vh] md:h-[800px]">
      
      {/* Left Side - Visual & Promo */}
      <div className="hidden md:flex md:w-1/3 bg-slate-900 text-white p-10 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80')] bg-cover bg-center mix-blend-overlay"></div>
        <div className="relative z-10">
            <h3 className="text-3xl font-bold mb-4">Join Influo</h3>
            <p className="text-slate-300">Η #1 πλατφόρμα για δημιουργούς περιεχομένου στην Ελλάδα.</p>
        </div>
        <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">✓</div>
                <span className="font-medium">Πρόσβαση σε top brands</span>
            </div>
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">✓</div>
                <span className="font-medium">Γρήγορες πληρωμές</span>
            </div>
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">✓</div>
                <span className="font-medium">Community events</span>
            </div>
        </div>
      </div>

      {/* Right Side - The Form */}
      <div className="flex-1 p-8 md:p-12 overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                {lang === "el" ? "Δημιουργία Προφίλ" : "Create Profile"}
            </h2>
            <select
                value={lang}
                onChange={(e) => setLang(e.target.value as "el" | "en")}
                className="text-sm border-none bg-slate-100 rounded-md px-3 py-1 text-slate-600 cursor-pointer hover:bg-slate-200"
            >
                <option value="el">🇬🇷 EL</option>
                <option value="en">🇬🇧 EN</option>
            </select>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
            {/* Grid for Name & Gender */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">{lang === "el" ? "Ονοματεπώνυμο" : "Full Name"}</label>
                    <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        placeholder="π.χ. Μαρία Παππά"
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">{lang === "el" ? "Φύλο" : "Gender"}</label>
                    <div className="relative">
                        <select
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                        >
                            <option value="Female">Γυναίκα</option>
                            <option value="Male">Άνδρας</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Email */}
            <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-2">{lang === "el" ? "Email Επικοινωνίας" : "Contact Email"}</label>
                 <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="name@example.com"
                  />
            </div>

            {/* Bio */}
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Bio</label>
                <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Πες μας λίγα λόγια για εσένα..."
                />
            </div>

            <hr className="border-slate-100" />

            {/* Social Accounts */}
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">{lang === "el" ? "Social Media" : "Social Media"}</label>
                <div className="space-y-3">
                    {accounts.map((acc, i) => (
                        <div key={i} className="flex gap-3">
                            <select
                                value={acc.platform}
                                onChange={(e) => handleAccountChange(i, "platform", e.target.value)}
                                className="w-1/3 bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-700 focus:ring-2 focus:ring-blue-500"
                            >
                                <option>Instagram</option>
                                <option>TikTok</option>
                                <option>YouTube</option>
                            </select>
                            <div className="flex-1 relative">
                                <span className="absolute left-3 top-2.5 text-slate-400">@</span>
                                <input
                                    type="text"
                                    value={acc.username}
                                    onChange={(e) => handleAccountChange(i, "username", e.target.value)}
                                    className="w-full pl-8 bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="username"
                                />
                            </div>
                            {accounts.length > 1 && (
                                <button type="button" onClick={() => removeAccount(i)} className="text-slate-400 hover:text-red-500 px-2">
                                    ✕
                                </button>
                            )}
                        </div>
                    ))}
                    <button type="button" onClick={addAccount} className="text-sm text-blue-600 font-semibold hover:text-blue-700 flex items-center gap-1">
                        + Προσθήκη λογαριασμού
                    </button>
                </div>
            </div>

            {/* Videos */}
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">{lang === "el" ? "Video Highlights" : "Video Highlights"}</label>
                 <div className="space-y-3">
                    {videos.map((vid, i) => (
                        <div key={i} className="flex gap-3">
                             <input
                                type="text"
                                placeholder="https://youtube.com/..."
                                value={vid}
                                onChange={(e) => handleVideoChange(i, e.target.value)}
                                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              {videos.length > 1 && (
                                <button type="button" onClick={() => removeVideo(i)} className="text-slate-400 hover:text-red-500 px-2">
                                    ✕
                                </button>
                              )}
                        </div>
                    ))}
                    <button type="button" onClick={addVideo} className="text-sm text-blue-600 font-semibold hover:text-blue-700 flex items-center gap-1">
                        + Προσθήκη video
                    </button>
                 </div>
            </div>

            <div className="pt-4">
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? "Processing..." : (lang === "el" ? "Ολοκλήρωση Εγγραφής" : "Complete Signup")}
                </button>
                {message && (
                    <div className={`mt-4 p-4 rounded-lg text-center font-medium ${message.includes("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
                        {message}
                    </div>
                )}
            </div>
        </form>
      </div>
    </div>
  );
}







