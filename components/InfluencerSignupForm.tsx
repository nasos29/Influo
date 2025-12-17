"use client";

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Image from "next/image";

type Account = { platform: string; username: string; followers: string };
type Lang = "el" | "en";

// --- FULL CATEGORY LIST ---
const CATEGORIES = [
  "Lifestyle", "Fashion & Style", "Beauty & Makeup", "Travel", "Food & Drink",
  "Health & Fitness", "Tech & Gadgets", "Business & Finance", "Gaming & Esports",
  "Parenting & Family", "Home & Decor", "Pets & Animals", "Comedy & Entertainment",
  "Art & Photography", "Music & Dance", "Education & Coaching", "Sports & Athletes",
  "DIY & Crafts", "Sustainability & Eco", "Cars & Automotive"
];

const t = {
  el: {
    headerTitle: "Γίνε μέλος του Creator Club",
    headerDesc: "Συμπλήρωσε το προφίλ σου για να συνδεθείς με κορυφαία Brands.",
    step1: "Βασικά Στοιχεία",
    step2: "Κανάλια & Κοινό",
    step3: "Portfolio & Insights",
    nameLabel: "Ονοματεπώνυμο",
    namePlace: "π.χ. Μαρία Παππά",
    genderLabel: "Φύλο",
    catLabel: "Κύρια Κατηγορία",
    male: "Άνδρας",
    female: "Γυναίκα",
    locationLabel: "Τοποθεσία",
    locationPlace: "π.χ. Αθήνα, Ελλάδα",
    emailLabel: "Email Επικοινωνίας",
    bioLabel: "Σύντομο Βιογραφικό",
    bioPlace: "Πες μας λίγα λόγια για το στυλ σου...",
    socialsTitle: "Τα Κανάλια σου",
    socialsDesc: "Πρόσθεσε τα δίκτυα που είσαι ενεργός/ή και τους followers.",
    platLabel: "Πλατφόρμα",
    userLabel: "Username (χωρίς @)",
    follLabel: "Followers (π.χ. 15k)",
    addAccount: "+ Προσθήκη Πλατφόρμας",
    langsLabel: "Γλώσσες Επικοινωνίας",
    langsPlace: "π.χ. Ελληνικά, Αγγλικά",
    photoLabel: "Φωτογραφία Προφίλ",
    uploadBtn: "Ανέβασμα Φωτογραφίας",
    insightsLabel: "Αποδεικτικά Insights (Screenshots)",
    insightsDesc: "Ανέβασε screenshots από τα στατιστικά σου για επαλήθευση.",
    uploadInsightsBtn: "Ανέβασμα Screenshots",
    videoLabel: "Video Highlights (Links)",
    videoDesc: "Επικόλλησε links από TikTok, Reels ή YouTube.",
    addVideo: "+ Προσθήκη Video Link",
    rateLabel: "Ελάχιστη Χρέωση / Budget (€)",
    next: "Επόμενο →",
    back: "← Πίσω",
    submit: "Ολοκλήρωση Εγγραφής",
    loading: "Ανέβασμα Δεδομένων...",
    successTitle: "Καλωσήρθες!",
    successDesc: "Το προφίλ σου δημιουργήθηκε. Θα λάβεις email επιβεβαίωσης και η ομάδα μας θα ελέγξει τα στοιχεία σου.",
    close: "Κλείσιμο"
  },
  en: {
    headerTitle: "Join the Creator Club",
    headerDesc: "Complete your profile to get matched with brands.",
    step1: "Basic Info",
    step2: "Channels & Audience",
    step3: "Portfolio & Insights",
    nameLabel: "Full Name",
    namePlace: "e.g. Maria Pappa",
    genderLabel: "Gender",
    catLabel: "Primary Category",
    male: "Male",
    female: "Female",
    locationLabel: "Location",
    locationPlace: "e.g. Athens, Greece",
    emailLabel: "Contact Email",
    bioLabel: "Short Bio",
    bioPlace: "Tell brands about your style...",
    socialsTitle: "Your Channels",
    socialsDesc: "Add your active networks and follower counts.",
    platLabel: "Platform",
    userLabel: "Username (no @)",
    follLabel: "Followers (e.g. 15k)",
    addAccount: "+ Add Platform",
    langsLabel: "Languages Spoken",
    langsPlace: "e.g. Greek, English",
    photoLabel: "Profile Photo",
    uploadBtn: "Upload Photo",
    insightsLabel: "Insights Proof (Screenshots)",
    insightsDesc: "Upload screenshots of your stats for verification.",
    uploadInsightsBtn: "Upload Screenshots",
    videoLabel: "Best Video Highlights (Links)",
    videoDesc: "Paste links from TikTok, Reels, or YouTube.",
    addVideo: "+ Add Video Link",
    rateLabel: "Minimum Rate / Budget (€)",
    next: "Next →",
    back: "← Back",
    submit: "Complete Signup",
    loading: "Uploading Data...",
    successTitle: "Welcome aboard!",
    successDesc: "Profile created. You will receive a confirmation email and our team will review your application.",
    close: "Close"
  }
};

export default function InfluencerSignupForm() {
  const [lang, setLang] = useState<Lang>("el"); 
  const [step, setStep] = useState(1); 
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Data States
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState("Female");
  const [category, setCategory] = useState("Lifestyle");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  
  const [accounts, setAccounts] = useState<Account[]>([{ platform: "Instagram", username: "", followers: "" }]);
  const [languages, setLanguages] = useState("");
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [insightFiles, setInsightFiles] = useState<File[]>([]); 
  const [videos, setVideos] = useState<string[]>([""]);
  const [minRate, setMinRate] = useState("");

  // Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleInsightsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        const files = Array.from(e.target.files);
        setInsightFiles(prev => [...prev, ...files]);
    }
  };

  const handleAccountChange = (i: number, field: keyof Account, value: string) => {
    const copy = [...accounts]; copy[i][field] = value; setAccounts(copy);
  };
  const addAccount = () => setAccounts([...accounts, { platform: "Instagram", username: "", followers: "" }]);
  const removeAccount = (i: number) => { const copy = [...accounts]; copy.splice(i, 1); setAccounts(copy); };

  const handleVideoChange = (i: number, val: string) => { const copy = [...videos]; copy[i] = val; setVideos(copy); };
  const addVideo = () => setVideos([...videos, ""]);
  const removeVideo = (i: number) => { const copy = [...videos]; copy.splice(i, 1); setVideos(copy); };

  // Submit Logic
  const handleSubmit = async () => {
    setLoading(true);
    try {
      // --- 1. NEW: DUPLICATE EMAIL CHECK ---
      const { data: existingUser, error: checkError } = await supabase
        .from('influencers')
        .select('id')
        .eq('contact_email', email)
        .maybeSingle(); // maybeSingle returns null if no user is found
        
      if (existingUser) {
        throw new Error(txt.el === t.el.headerTitle ? "Αυτό το Email είναι ήδη καταχωρημένο. Παρακαλώ χρησιμοποιήστε άλλο." : "This email is already registered. Please use a different one.");
      }
      if (checkError && checkError.code !== 'PGRST116' && checkError.code !== '42703') { // PGRST116 = No rows, 42703 = column "followers_count" does not exist
         // Αν υπάρχει άλλο σφάλμα στη βάση, το πετάμε
         throw new Error(checkError.message);
      }
      // ------------------------------------

      // 2. Uploads 
      let avatarUrl = "";
      if (avatarFile) {
        const fileName = `avatar-${Date.now()}-${avatarFile.name}`;
        const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, avatarFile);
        if (!uploadError) {
            const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
            avatarUrl = data.publicUrl;
        }
      }

      const insightUrls: string[] = [];
      if (insightFiles.length > 0) {
          await Promise.all(insightFiles.map(async (file) => {
              const fileName = `proof-${Date.now()}-${file.name}`;
              const { error } = await supabase.storage.from("avatars").upload(fileName, file);
              if (!error) {
                  const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
                  insightUrls.push(data.publicUrl);
              }
          }));
      }

      // 3. Database Insert
      const { error: insertError } = await supabase.from("influencers").insert([
        { 
          display_name: displayName, 
          gender, 
          category,
          location,
          languages,
          min_rate: minRate,
          contact_email: email,
          bio, 
          accounts, 
          videos: videos.filter(v => v !== ""),
          avatar_url: avatarUrl,
          insights_urls: insightUrls
        }
      ]);

      if (insertError) throw insertError;

      // 4. Send Emails (UPDATED)
      try {
        // Mail 1: Στον Influencer (Confirmation)
        await fetch('/api/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'signup_influencer', email: email, name: displayName })
        });
        
        // Mail 2: Στον Admin (Notification)
        await fetch('/api/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'signup_admin', email: email, name: displayName, location: location }) 
        });
      } catch (mailError) {
          console.error("Email sending failed:", mailError);
      }

      setStep(4);
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.message.includes("Email είναι ήδη καταχωρημένο") || err.message.includes("already registered") ? err.message : (lang === "el" ? "Σφάλμα: " : "Error: ") + err.message;
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // UI Helpers
  const txt = t[lang]; 
  const inputClass = "w-full px-4 py-3 !bg-white !text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-500";
  const labelClass = "block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1";

  const ProgressSteps = () => (
    <div className="flex justify-between mb-8 relative px-4">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-10"></div>
        {[1, 2, 3].map((s) => (
            <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors border-2 ${step >= s ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-500'}`}>
                {s}
            </div>
        ))}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh] md:h-[800px] max-w-4xl mx-auto border border-gray-200">
      
      {/* Header */}
      <div className="bg-slate-900 p-6 text-white flex justify-between items-start">
        <div className="text-center flex-1">
            <h3 className="text-2xl font-bold">{txt.headerTitle}</h3>
            <p className="text-slate-400 text-sm">{txt.headerDesc}</p>
        </div>
        <button 
            onClick={() => setLang(lang === "el" ? "en" : "el")}
            className="text-xs font-bold border border-slate-600 px-3 py-1 rounded hover:bg-slate-800 transition-colors"
        >
            {lang === "el" ? "🇬🇧 EN" : "🇬🇷 EL"}
        </button>
      </div>

      <div className="flex-1 p-8 overflow-y-auto bg-white">
        {step < 4 && <ProgressSteps />}

        {/* --- STEP 1 --- */}
        {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <h2 className="text-xl font-bold text-black border-b border-gray-200 pb-2">{txt.step1}</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>{txt.nameLabel}</label>
                        <input type="text" className={inputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={txt.namePlace} />
                    </div>
                    <div>
                        <label className={labelClass}>{txt.genderLabel}</label>
                        <select className={inputClass} value={gender} onChange={(e) => setGender(e.target.value)}>
                            <option value="Female">{txt.female}</option>
                            <option value="Male">{txt.male}</option>
                        </select>
                    </div>
                </div>

                {/* CATEGORY SELECT */}
                <div>
                    <label className={labelClass}>{txt.catLabel}</label>
                    <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                        {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className={labelClass}>{txt.locationLabel}</label>
                    <input type="text" className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder={txt.locationPlace} />
                </div>

                <div>
                    <label className={labelClass}>{txt.emailLabel}</label>
                    <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="brands@example.com" />
                </div>

                <div>
                    <label className={labelClass}>{txt.bioLabel}</label>
                    <textarea className={inputClass} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder={txt.bioPlace} />
                </div>

                <div className="pt-4">
                    <button onClick={() => setStep(2)} disabled={!displayName || !email} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg disabled:opacity-50">
                        {txt.next}
                    </button>
                </div>
            </div>
        )}

        {/* --- STEP 2 --- */}
        {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <h2 className="text-xl font-bold text-black border-b border-gray-200 pb-2">{txt.step2}</h2>
                
                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>{txt.socialsTitle}</label>
                        <p className="text-xs text-gray-500 mb-3">{txt.socialsDesc}</p>
                    </div>
                    
                    {accounts.map((acc, i) => (
                        <div key={i} className="flex flex-col md:flex-row gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 relative group">
                            {/* Platform */}
                            <div className="w-full md:w-1/4">
                                <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">{txt.platLabel}</label>
                                <select className={`${inputClass} !py-2 !text-sm`} value={acc.platform} onChange={(e) => handleAccountChange(i, "platform", e.target.value)}>
                                    <option>Instagram</option>
                                    <option>TikTok</option>
                                    <option>YouTube</option>
                                    <option>Facebook</option>
                                </select>
                            </div>
                            
                            {/* Username */}
                            <div className="w-full md:w-1/3">
                                <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">{txt.userLabel}</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-gray-500 text-sm">@</span>
                                    <input type="text" className={`${inputClass} !py-2 !pl-7 !text-sm`} value={acc.username} onChange={(e) => handleAccountChange(i, "username", e.target.value)} placeholder="username" />
                                </div>
                            </div>

                            {/* Followers */}
                            <div className="w-full md:w-1/3">
                                <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">{txt.follLabel}</label>
                                <input type="text" className={`${inputClass} !py-2 !text-sm`} value={acc.followers} onChange={(e) => handleAccountChange(i, "followers", e.target.value)} placeholder="15k" />
                            </div>

                            <button onClick={() => removeAccount(i)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-md hover:bg-red-600 transition-colors">✕</button>
                        </div>
                    ))}
                    
                    <button onClick={addAccount} className="text-blue-600 text-sm font-bold hover:underline flex items-center gap-1">
                        {txt.addAccount}
                    </button>
                </div>

                <div>
                    <label className={labelClass}>{txt.langsLabel}</label>
                    <input type="text" className={inputClass} value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder={txt.langsPlace} />
                </div>

                <div className="flex gap-4 pt-4">
                    <button onClick={() => setStep(1)} className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50">{txt.back}</button>
                    <button onClick={() => setStep(3)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg">{txt.next}</button>
                </div>
            </div>
        )}

        {/* --- STEP 3 --- */}
        {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <h2 className="text-xl font-bold text-black border-b border-gray-200 pb-2">{txt.step3}</h2>
                
                {/* Photo */}
                <div className="flex items-center gap-6 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <div className="relative w-20 h-20 rounded-full bg-white shadow-sm border border-gray-200 overflow-hidden flex items-center justify-center">
                        {avatarPreview ? <Image src={avatarPreview} alt="Preview" fill className="object-cover" /> : <span className="text-3xl">📸</span>}
                    </div>
                    <div>
                        <p className={`${labelClass} mb-1`}>{txt.photoLabel}</p>
                        <label className="bg-white border border-gray-300 text-gray-700 font-bold rounded-lg px-4 py-2 text-sm cursor-pointer hover:bg-gray-50 inline-block">
                            {txt.uploadBtn}
                            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                        </label>
                    </div>
                </div>

                {/* INSIGHTS */}
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <label className={labelClass}>{txt.insightsLabel}</label>
                    <p className="text-xs text-slate-500 mb-3">{txt.insightsDesc}</p>
                    <label className="bg-white border border-blue-300 text-blue-700 font-bold rounded-lg px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 inline-block shadow-sm">
                        {txt.uploadInsightsBtn}
                        <input type="file" multiple accept="image/*" onChange={handleInsightsChange} className="hidden" />
                    </label>
                    {insightFiles.length > 0 && (
                        <div className="mt-3 flex gap-2 flex-wrap">
                            {insightFiles.map((f, i) => (
                                <span key={i} className="text-xs bg-white px-2 py-1 rounded border border-gray-300 text-gray-700">📄 {f.name}</span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Videos */}
                <div className="space-y-3">
                    <label className={labelClass}>{txt.videoLabel}</label>
                    <p className="text-xs text-gray-500 mb-2">{txt.videoDesc}</p>
                    {videos.map((vid, i) => (
                        <div key={i} className="flex gap-3">
                            <input type="text" className={inputClass} value={vid} onChange={(e) => handleVideoChange(i, e.target.value)} placeholder="https://..." />
                            {videos.length > 1 && <button onClick={() => removeVideo(i)} className="text-red-500 font-bold px-2 hover:bg-red-50 rounded">✕</button>}
                        </div>
                    ))}
                    <button onClick={addVideo} className="text-blue-600 text-sm font-bold hover:underline">{txt.addVideo}</button>
                </div>

                {/* Rate */}
                <div>
                    <label className={labelClass}>{txt.rateLabel}</label>
                    <input type="number" className={inputClass} value={minRate} onChange={(e) => setMinRate(e.target.value)} placeholder="150" />
                </div>

                <div className="flex gap-4 pt-4">
                    <button onClick={() => setStep(2)} className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50">{txt.back}</button>
                    <button onClick={handleSubmit} disabled={loading} className="flex-1 bg-slate-900 hover:bg-black text-white font-bold py-3 rounded-lg">
                        {loading ? txt.loading : txt.submit}
                    </button>
                </div>
                {message && <p className="text-red-600 text-sm text-center mt-2 font-medium bg-red-50 p-2 rounded">{message}</p>}
            </div>
        )}

        {/* --- STEP 4 --- */}
        {step === 4 && (
            <div className="text-center py-20 animate-in zoom-in duration-300">
                <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-5xl mx-auto mb-6 shadow-sm">🎉</div>
                <h2 className="text-3xl font-bold text-black mb-4">{txt.successTitle}</h2>
                <p className="text-gray-600 max-w-md mx-auto mb-10 text-lg">
                    {txt.successDesc}
                </p>
                <button onClick={() => window.location.reload()} className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 w-full max-w-xs mx-auto">
                    {txt.close}
                </button>
            </div>
        )}

      </div>
    </div>
  );
}





