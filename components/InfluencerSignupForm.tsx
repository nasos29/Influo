"use client";

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Image from "next/image";

type Account = { platform: string; username: string };

export default function InfluencerSignupForm() {
  // Basic Info
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState("Female");
  const [location, setLocation] = useState("Athens, Greece"); // ΝΕΟ
  const [languages, setLanguages] = useState("Greek, English"); // ΝΕΟ
  const [minRate, setMinRate] = useState(""); // ΝΕΟ
  
  // Media & Contact
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  
  // Lists
  const [accounts, setAccounts] = useState<Account[]>([{ platform: "Instagram", username: "" }]);
  const [videos, setVideos] = useState<string[]>([""]);
  
  // System
  const [lang, setLang] = useState<"el" | "en">("el");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // --- HANDLERS ---

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleAccountChange = (i: number, field: keyof Account, value: string) => {
    const copy = [...accounts];
    copy[i][field] = value;
    setAccounts(copy);
  };
  const addAccount = () => setAccounts([...accounts, { platform: "Instagram", username: "" }]);
  const removeAccount = (i: number) => { const copy = [...accounts]; copy.splice(i, 1); setAccounts(copy); };

  const handleVideoChange = (i: number, val: string) => { const copy = [...videos]; copy[i] = val; setVideos(copy); };
  const addVideo = () => setVideos([...videos, ""]);
  const removeVideo = (i: number) => { const copy = [...videos]; copy.splice(i, 1); setVideos(copy); };

  // --- SUBMIT LOGIC ---

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      let avatarUrl = "";

      // 1. Upload Image to Supabase Storage
      if (avatarFile) {
        const fileName = `${Date.now()}-${avatarFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("avatars") // Σιγουρέψου ότι έφτιαξες το bucket 'avatars'
          .upload(fileName, avatarFile);

        if (uploadError) throw uploadError;
        
        // Get Public URL
        const { data: publicUrlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(fileName);
          
        avatarUrl = publicUrlData.publicUrl;
      }

      // 2. Insert Data to Database
      const { error } = await supabase.from("influencers").insert([
        { 
          display_name: displayName, 
          gender, 
          location,      // ΝΕΟ
          languages,     // ΝΕΟ
          min_rate: minRate, // ΝΕΟ
          contact_email: email,
          bio, 
          accounts, 
          videos, 
          avatar_url: avatarUrl // ΝΕΟ
        }
      ]);

      if (error) throw error;

      setMessage(lang === "el" ? "Επιτυχία! Το προφίλ ελέγχεται." : "Success! Profile under review.");
      // Reset form (optional)
      setDisplayName("");
      setAvatarFile(null);
      setAvatarPreview(null);
      
    } catch (err: any) {
      console.error(err);
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[90vh] md:h-[850px]">
      
      {/* Left Side - Visual */}
      <div className="hidden md:flex md:w-1/3 bg-slate-900 text-white p-10 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-30 bg-[url('https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=800&q=80')] bg-cover bg-center"></div>
        <div className="relative z-10">
            <h3 className="text-3xl font-bold mb-4">Professional Profile</h3>
            <p className="text-slate-300">Συμπλήρωσε τα επαγγελματικά σου στοιχεία για να προσελκύσεις B2B συνεργασίες.</p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 p-8 md:p-12 overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Δημιουργία Προφίλ</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
            
            {/* 1. PHOTO UPLOAD */}
            <div className="flex items-center gap-6">
                <div className="relative w-24 h-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden group hover:border-blue-500 transition-colors">
                    {avatarPreview ? (
                        <Image src={avatarPreview} alt="Preview" fill className="object-cover" />
                    ) : (
                        <span className="text-2xl text-slate-400">📷</span>
                    )}
                    <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileChange} 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                    />
                </div>
                <div>
                    <p className="font-semibold text-slate-900">Φωτογραφία Προφίλ</p>
                    <p className="text-xs text-slate-500">Πάτησε για ανέβασμα (JPG, PNG)</p>
                </div>
            </div>

            {/* 2. BASIC DETAILS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Ονοματεπώνυμο</label>
                    <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Φύλο</label>
                    <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="Female">Γυναίκα</option>
                        <option value="Male">Άνδρας</option>
                    </select>
                </div>
            </div>

            {/* 3. PRO DETAILS (Location, Langs, Rates) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Τοποθεσία</label>
                    <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="π.χ. Athens, Greece"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Starting Budget (€)</label>
                    <input
                        type="text"
                        value={minRate}
                        onChange={(e) => setMinRate(e.target.value)}
                        placeholder="π.χ. 150"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>
            
             <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Γλώσσες (χωρισμένες με κόμμα)</label>
                <input
                    type="text"
                    value={languages}
                    onChange={(e) => setLanguages(e.target.value)}
                    placeholder="π.χ. Greek, English, French"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </div>


            {/* 4. BIO & EMAIL */}
            <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-2">Email Επικοινωνίας</label>
                 <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
            </div>

            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Bio</label>
                <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </div>

            <hr className="border-slate-100" />

            {/* 5. SOCIALS */}
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Social Media Accounts</label>
                <div className="space-y-3">
                    {accounts.map((acc, i) => (
                        <div key={i} className="flex gap-3">
                            <select
                                value={acc.platform}
                                onChange={(e) => handleAccountChange(i, "platform", e.target.value)}
                                className="w-1/3 bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-700"
                            >
                                <option>Instagram</option>
                                <option>TikTok</option>
                                <option>YouTube</option>
                            </select>
                            <input
                                type="text"
                                value={acc.username}
                                onChange={(e) => handleAccountChange(i, "username", e.target.value)}
                                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="username"
                            />
                            <button type="button" onClick={() => removeAccount(i)} className="text-slate-400 hover:text-red-500 font-bold px-2">✕</button>
                        </div>
                    ))}
                    <button type="button" onClick={addAccount} className="text-sm text-blue-600 font-bold hover:underline">+ Add Account</button>
                </div>
            </div>

            {/* SUBMIT */}
            <div className="pt-4 pb-10">
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg transition-all disabled:opacity-50"
                >
                    {loading ? "Ανέβασμα..." : "Ολοκλήρωση Εγγραφής"}
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







