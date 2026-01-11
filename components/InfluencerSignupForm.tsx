"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";

type Account = { platform: string; username: string; followers: string };
type Lang = "el" | "en";

// --- FULL CATEGORY LIST ---
const CATEGORIES = [
  "Γενικά", "Lifestyle", "Fashion & Style", "Beauty & Makeup", "Travel", "Food & Drink",
  "Health & Fitness", "Tech & Gadgets", "Business & Finance", "Gaming & Esports",
  "Parenting & Family", "Home & Decor", "Pets & Animals", "Comedy & Entertainment",
  "Art & Photography", "Music & Dance", "Education & Coaching", "Sports & Athletes",
  "DIY & Crafts", "Sustainability & Eco", "Cars & Automotive"
];

// --- LANGUAGES LIST ---
const LANGUAGES = [
  { code: "el", el: "Ελληνικά", en: "Greek" },
  { code: "en", el: "Αγγλικά", en: "English" },
  { code: "de", el: "Γερμανικά", en: "German" },
  { code: "fr", el: "Γαλλικά", en: "French" },
  { code: "es", el: "Ισπανικά", en: "Spanish" },
  { code: "it", el: "Ιταλικά", en: "Italian" },
  { code: "pt", el: "Πορτογαλικά", en: "Portuguese" },
  { code: "ru", el: "Ρωσικά", en: "Russian" },
  { code: "zh", el: "Κινεζικά", en: "Chinese" },
  { code: "ja", el: "Ιαπωνικά", en: "Japanese" }
];

// Category translations
const categoryTranslations: { [key: string]: { el: string; en: string } } = {
  "Γενικά": { el: "Γενικά", en: "General" },
  "Lifestyle": { el: "Lifestyle", en: "Lifestyle" },
  "Fashion & Style": { el: "Μόδα & Στυλ", en: "Fashion & Style" },
  "Beauty & Makeup": { el: "Ομορφιά & Μακιγιάζ", en: "Beauty & Makeup" },
  "Travel": { el: "Ταξίδια", en: "Travel" },
  "Food & Drink": { el: "Φαγητό & Ποτά", en: "Food & Drink" },
  "Health & Fitness": { el: "Υγεία & Fitness", en: "Health & Fitness" },
  "Tech & Gadgets": { el: "Τεχνολογία & Gadgets", en: "Tech & Gadgets" },
  "Business & Finance": { el: "Επιχειρήσεις & Οικονομικά", en: "Business & Finance" },
  "Gaming & Esports": { el: "Gaming & Esports", en: "Gaming & Esports" },
  "Parenting & Family": { el: "Οικογένεια & Παιδιά", en: "Parenting & Family" },
  "Home & Decor": { el: "Σπίτι & Διακόσμηση", en: "Home & Decor" },
  "Pets & Animals": { el: "Κατοικίδια & Ζώα", en: "Pets & Animals" },
  "Comedy & Entertainment": { el: "Κωμωδία & Ψυχαγωγία", en: "Comedy & Entertainment" },
  "Art & Photography": { el: "Τέχνη & Φωτογραφία", en: "Art & Photography" },
  "Music & Dance": { el: "Μουσική & Χορός", en: "Music & Dance" },
  "Education & Coaching": { el: "Εκπαίδευση & Coaching", en: "Education & Coaching" },
  "Sports & Athletes": { el: "Αθλήματα & Αθλητές", en: "Sports & Athletes" },
  "DIY & Crafts": { el: "DIY & Χειροτεχνίες", en: "DIY & Crafts" },
  "Sustainability & Eco": { el: "Βιωσιμότητα & Οικολογία", en: "Sustainability & Eco" },
  "Cars & Automotive": { el: "Αυτοκίνητα", en: "Cars & Automotive" },
};

const t = {
  el: {
    headerTitle: "Γίνε μέλος του Influo",
    headerDesc: "Συμπλήρωσε το προφίλ σου για να συνδεθείς με κορυφαία Brands.",
    step1: "Βασικά Στοιχεία",
    step2: "Κανάλια & Κοινό",
    step3: "Portfolio & Insights",
    nameLabel: "Ονοματεπώνυμο",
    namePlace: "π.χ. Μαρία Παππά",
    genderLabel: "Φύλο",
    catLabel: "Κατηγορίες *",
    catDesc: "Επιλέξτε μία ή περισσότερες κατηγορίες",
    catGeneral: "Γενικά (όλες οι κατηγορίες)",
    male: "Άνδρας",
    female: "Γυναίκα",
    locationLabel: "Τοποθεσία",
    locationPlace: "π.χ. Αθήνα, Ελλάδα",
    emailLabel: "Email Επικοινωνίας",
    passLabel: "Κωδικός (τουλάχιστον 6 χαρακτήρες)", 
    passShow: "Εμφάνιση",
    passHide: "Απόκρυψη",
    bioLabel: "Σύντομο Βιογραφικό",
    bioPlace: "Πες μας λίγα λόγια για το στυλ σου...",
    socialsTitle: "Τα Κανάλια σου",
    socialsDesc: "Πρόσθεσε τα δίκτυα που είσαι ενεργός/ή και τους followers.",
    platLabel: "Πλατφόρμα",
    userLabel: "Username (χωρίς @)",
    follLabel: "Followers (π.χ. 15k)",
    addAccount: "+ Προσθήκη Πλατφόρμας",
    langsLabel: "Γλώσσες Επικοινωνίας",
    langsDesc: "Επιλέξτε τις γλώσσες που μιλάτε",
    photoLabel: "Φωτογραφία Προφίλ",
    uploadBtn: "Ανέβασμα Φωτογραφίας",
    insightsLabel: "Αποδεικτικά Insights (Screenshots)",
    insightsDesc: "Ανέβασε screenshots από τα στατιστικά σου για επαλήθευση.",
    insightsTip: "Συμπεριλάβετε οθόνες που δείχνουν το Κοινό (Φύλο/Ηλικία) και το Engagement Rate των τελευταίων 30 ημερών. Απαραίτητο για έγκριση.",
    uploadInsightsBtn: "Ανέβασμα Screenshots",
    videoLabel: "Video Highlights (Links)",
    videoDesc: "Επικόλλησε links από TikTok, Reels ή YouTube. Μπορείτε επίσης να προσθέσετε links φωτογραφιών από δουλειές σας.",
    addVideo: "+ Προσθήκη Video Link / Φωτογραφίας",
    rateLabel: "Ελάχιστη Χρέωση / Budget (€)",
    engageRateLabel: "Engagement Rate (%)", 
    avgLikesLabel: "Μέσος Όρος Likes/Views", 
    aud_title: "Δηλώστε τα στοιχεία Κοινού",
    aud_male: "Άνδρες (%)",
    aud_female: "Γυναίκες (%)",
    aud_age_group: "Κορυφαία Ηλικιακή Ομάδα",
    aud_age_place: "Π.χ. 18-24",
    next: "Επόμενο →",
    back: "← Πίσω",
    submit: "Ολοκλήρωση Εγγραφής",
    loading: "Ανέβασμα Δεδομένων...",
    successTitle: "Καλωσήρθες!",
    successDesc: "Ο λογαριασμός σου δημιουργήθηκε. Μπορείς να συνδεθείς τώρα. Το προφίλ σου θα ελεγχθεί.",
    close: "Σύνδεση τώρα"
  },
  en: {
    headerTitle: "Join Influo",
    headerDesc: "Complete your profile to get matched with brands.",
    step1: "Basic Info",
    step2: "Channels & Audience",
    step3: "Portfolio & Insights",
    nameLabel: "Full Name",
    namePlace: "e.g. Maria Pappa",
    genderLabel: "Gender",
    catLabel: "Categories *",
    catDesc: "Select one or more categories",
    catGeneral: "General (all categories)",
    male: "Male",
    female: "Female",
    locationLabel: "Location",
    locationPlace: "e.g. Athens, Greece",
    emailLabel: "Contact Email",
    passLabel: "Password (min 6 characters)", 
    passShow: "Show",
    passHide: "Hide",
    bioLabel: "Short Bio",
    bioPlace: "Tell brands about your style...",
    socialsTitle: "Your Channels",
    socialsDesc: "Add your active networks and follower counts.",
    platLabel: "Platform",
    userLabel: "Username (no @)",
    follLabel: "Followers (e.g. 15k)",
    addAccount: "+ Add Platform",
    langsLabel: "Γλώσσες Επικοινωνίας",
    langsDesc: "Επιλέξτε τις γλώσσες που μιλάτε",
    photoLabel: "Profile Photo",
    uploadBtn: "Upload Photo",
    insightsLabel: "Insights Proof (Screenshots)",
    insightsDesc: "Upload screenshots of your stats for verification.",
    insightsTip: "Tip: Please include screenshots showing Audience Demographics (Age/Gender) and Engagement Rate for the last 30 days. Required for approval.",
    uploadInsightsBtn: "Upload Screenshots",
    videoLabel: "Best Video Highlights (Links)",
    videoDesc: "Paste links from TikTok, Reels, or YouTube. You can also add photo links from your work.",
    addVideo: "+ Add Video Link / Photo",
    rateLabel: "Minimum Rate / Budget (€)",
    engageRateLabel: "Engagement Rate (%)", 
    avgLikesLabel: "Avg Likes/Views", 
    aud_title: "Declare Audience Demographics",
    aud_male: "Male (%)",
    aud_female: "Female (%)",
    aud_age_group: "Top Age Group",
    aud_age_place: "E.g. 18-24",
    next: "Next →",
    back: "← Back",
    submit: "Complete Signup",
    loading: "Uploading Data...",
    successTitle: "Welcome aboard!",
    successDesc: "Your account has been created. You can log in now. Your profile will be reviewed.",
    close: "Log in now"
  }
};

export default function InfluencerSignupForm() {
  const [lang, setLang] = useState<Lang>("el"); 
  const [step, setStep] = useState(1); 
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(""); 
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [checkingEmail, setCheckingEmail] = useState(false);

  // Data States
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState("Female");
  const [categories, setCategories] = useState<string[]>(["Lifestyle"]);
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); 
  
  const [accounts, setAccounts] = useState<Account[]>([{ platform: "Instagram", username: "", followers: "" }]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [insightFiles, setInsightFiles] = useState<File[]>([]); 
  const [videos, setVideos] = useState<string[]>([""]);
  const [minRate, setMinRate] = useState("");
  const [engagementRate, setEngagementRate] = useState("");
  const [avgLikes, setAvgLikes] = useState("");

  // NEW AUDIENCE STATES
  const [malePercent, setMalePercent] = useState("");
  const [femalePercent, setFemalePercent] = useState("");
  const [topAge, setTopAge] = useState("");

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

  // Helper function to replace commas with dots in numeric inputs
  const replaceCommaWithDot = (value: string): string => {
    return value.replace(/,/g, '.');
  };

  const handleAccountChange = (i: number, field: keyof Account, value: string) => {
    const copy = [...accounts]; 
    // Replace comma with dot for followers field
    if (field === 'followers') {
      copy[i][field] = replaceCommaWithDot(value);
    } else {
      copy[i][field] = value;
    }
    setAccounts(copy);
  };
  const addAccount = () => setAccounts([...accounts, { platform: "Instagram", username: "", followers: "" }]);
  const removeAccount = (i: number) => { const copy = [...accounts]; copy.splice(i, 1); setAccounts(copy); };

  const handleVideoChange = (i: number, val: string) => { const copy = [...videos]; copy[i] = val; setVideos(copy); };
  const addVideo = () => setVideos([...videos, ""]);
  const removeVideo = (i: number) => { const copy = [...videos]; copy.splice(i, 1); setVideos(copy); };

  // --- NEW: AUDIENCE HANDLERS ---
  const handleMaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value) || 0;
      setMalePercent(val.toString());
      if (val >= 0 && val <= 100) setFemalePercent((100 - val).toString());
  };

  const handleFemaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value) || 0;
      setFemalePercent(val.toString());
      if (val >= 0 && val <= 100) setMalePercent((100 - val).toString());
  };

  // Email check on change (debounced)
  useEffect(() => {
    if (!email || step !== 1) {
      setEmailError("");
      return;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("");
      return;
    }

    // Debounce check
    const timeoutId = setTimeout(async () => {
      setCheckingEmail(true);
      setEmailError("");
      
      try {
        // Check if email exists in influencers table
        const { count, error: checkError } = await supabase
          .from('influencers')
          .select('id', { count: 'exact', head: true }) 
          .eq('contact_email', email);

        if (count && count > 0) {
          setEmailError(lang === "el" 
            ? "Αυτό το Email είναι ήδη καταχωρημένο. Παρακαλώ χρησιμοποιήστε άλλο." 
            : "This email is already registered. Please use a different one.");
        } else {
          setEmailError("");
        }
      } catch (err: any) {
        console.error('Email check error:', err);
        // Don't show error on network issues, only on duplicates
      } finally {
        setCheckingEmail(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [email, step, lang]);

  // --- EMAIL CHECK AND NEXT STEP (STEP 1) ---
  const handleCheckEmailAndNext = async () => {
      setMessage(""); 
      setLoading(true);

      try {
          if (password.length < 6) {
              throw new Error(lang === "el" ? "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες." : "Password must be at least 6 characters long.");
          }

          // Check if email error exists (from real-time check)
          if (emailError) {
              throw new Error(emailError);
          }

          // Double-check email (in case debounce didn't complete)
          const { count, error: checkError } = await supabase
              .from('influencers')
              .select('id', { count: 'exact', head: true }) 
              .eq('contact_email', email);

          if (count && count > 0) { 
              const errorMsg = lang === "el" 
                  ? "Αυτό το Email είναι ήδη καταχωρημένο. Παρακαλώ χρησιμοποιήστε άλλο." 
                  : "This email is already registered. Please use a different one.";
              setEmailError(errorMsg);
              throw new Error(errorMsg);
          }

          // Προ-έλεγχος: Προσπαθούμε να καθαρίσουμε orphaned auth users (αν υπάρχουν)
          // Αυτό βοηθάει αν κάποιος διαγράφηκε από influencers αλλά όχι από auth
          try {
              await fetch('/api/admin/cleanup-orphaned-auth', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email }),
              });
              // Αγνοούμε το response - είναι προληπτικός έλεγχος
          } catch (e) {
              // Αγνοούμε errors - προχωράμε
          }

          // Όλα ΟΚ: Προχωράμε στο επόμενο βήμα
          setStep(2);
      } catch (err: any) {
          console.error(err);
          
          // Αν το error είναι "Invalid login credentials", σημαίνει ότι το email υπάρχει στο auth
          // Προσφέρουμε cleanup option
          if (err.message?.includes("Invalid login") || err.message?.includes("invalid")) {
              const shouldCleanup = confirm(
                  lang === "el" 
                      ? "Το email υπάρχει στο σύστημα. Θέλετε να διαγραφεί ώστε να μπορέσετε να ξαναγραφτείτε?"
                      : "Email exists in system. Delete it to allow new registration?"
              );
              
              if (shouldCleanup) {
                  try {
                      const cleanupResponse = await fetch('/api/admin/cleanup-orphaned-auth', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email }),
                      });
                      
                      if (cleanupResponse.ok) {
                          setMessage(lang === "el" ? "Το email διαγράφηκε. Παρακαλώ δοκιμάστε ξανά." : "Email cleaned up. Please try again.");
                          return;
                      }
                  } catch (cleanupErr) {
                      console.error('Cleanup error:', cleanupErr);
                  }
              }
          }
          
          const errorMessage = err.message.includes("ήδη καταχωρημένο") || err.message.includes("already registered") || err.message.includes("6 χαρακτήρες") ? err.message : (lang === "el" ? "Σφάλμα: " : "Error: ") + err.message;
          setMessage(errorMessage); 
      } finally {
          setLoading(false);
      }
  };


  // Submit Logic (Final Step)
  const handleSubmit = async () => {
    setLoading(true);
    try {
      
      // 1. Auth: Δημιουργία Χρήστη (Sign Up)
      let authData: any;
      let authUser: any;

      const { data: initialAuthData, error: authError } = await supabase.auth.signUp({
          email: email,
          password: password,
      });

      if (authError) {
          if (
              authError.message.includes("already registered") ||
              authError.message.includes("User already registered") ||
              authError.message.includes("email")
          ) {
              // Προσπαθούμε να καθαρίσουμε orphaned auth user
              try {
                  const cleanupResponse = await fetch('/api/admin/cleanup-orphaned-auth', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email }),
                  });

                  const cleanupResult = await cleanupResponse.json();

                  if (cleanupResponse.ok && cleanupResult.deleted) {
                      // Retry signup after cleanup
                      const { data: retryAuthData, error: retryError } = await supabase.auth.signUp({
                          email: email,
                          password: password,
                      });

                      if (retryError || !retryAuthData?.user) {
                          setStep(1);
                          setMessage(lang === "el"
                              ? "Αυτό το email χρησιμοποιείται ήδη. Δοκιμάστε άλλο ή κάντε σύνδεση."
                              : "This email is already registered. Try another or log in.");
                          return;
                      }

                      // Success - use retryAuthData
                      authData = retryAuthData;
                      authUser = retryAuthData.user;
                  } else {
                      // Cleanup didn't work - show error
                      setStep(1);
                      setMessage(lang === "el"
                          ? "Αυτό το email χρησιμοποιείται ήδη. Δοκιμάστε άλλο ή κάντε σύνδεση."
                          : "This email is already registered. Try another or log in.");
                      return;
                  }
              } catch (cleanupErr) {
                  console.error('Cleanup attempt failed:', cleanupErr);
                  setStep(1);
                  setMessage(lang === "el"
                      ? "Αυτό το email χρησιμοποιείται ήδη. Δοκιμάστε άλλο ή κάντε σύνδεση."
                      : "This email is already registered. Try another or log in.");
                  return;
              }
          } else {
              throw new Error(authError.message);
          }
      } else {
          // Initial signup succeeded
          authData = initialAuthData;
          if (!authData?.user) {
              throw new Error("Δεν μπόρεσε να δημιουργηθεί ο χρήστης.");
          }
          authUser = authData.user;
      }

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

      // 3. Database Insert (Σύνδεση με το UUID)
      const { error: insertError } = await supabase.from("influencers").insert([
        { 
          id: authUser.id,
          display_name: displayName, 
          gender, 
          category: categories.length > 0 ? categories[0] : "Lifestyle", // Store primary category for compatibility (if single category column exists)
          // Note: If categories column exists as array, store all categories
          // Otherwise, categories are stored as comma-separated string in category field or first category
          location,
          languages: selectedLanguages.join(", "), // Store as comma-separated string
          min_rate: minRate,
          contact_email: email,
          bio, 
          accounts, 
          videos: videos.filter(v => v !== ""),
          avatar_url: avatarUrl || null,
          insights_urls: insightUrls,
          engagement_rate: engagementRate,
          avg_likes: avgLikes,
          audience_male_percent: parseInt(malePercent) || 0,
          audience_female_percent: parseInt(femalePercent) || 0,
          audience_top_age: topAge,
        }
      ]);

      if (insertError) {
          if (insertError.code === '23505') {
             const errorMsg = lang === "el" ? "Αυτό το Email είναι ήδη καταχωρημένο. Παρακαλώ χρησιμοποιήστε άλλο." : "This email is already registered. Please use a different one.";
             throw new Error(errorMsg);
          }
          throw insertError;
      }

      // 5. Send Emails
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
      const errorMessage = err.message.includes("already registered") || err.message.includes("23505") || err.message.includes("κωδικός") 
          ? err.message 
          : (lang === "el" ? "Σφάλμα: " : "Error: ") + err.message;
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // UI Helpers
  const txt = t[lang]; 
  const inputClass = "w-full px-4 py-3 !bg-white !text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 shadow-sm hover:border-slate-300";
  const labelClass = "block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2";

  const ProgressSteps = () => (
    <div className="flex justify-between mb-8 relative px-4">
        <div className="absolute top-1/2 left-0 w-full h-1.5 bg-slate-200 rounded-full -z-10"></div>
        <div className={`absolute top-1/2 left-4 h-1.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full transition-all duration-500 -z-10`} style={{ width: step >= 3 ? 'calc(100% - 2rem)' : step >= 2 ? 'calc(66.666% - 2rem)' : '0%' }}></div>
        {[1, 2, 3].map((s) => (
            <div key={s} className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm transition-all border-2 shadow-md ${step >= s ? 'bg-gradient-to-br from-blue-600 to-purple-600 border-blue-600 text-white scale-110' : 'bg-white border-slate-300 text-slate-500'}`}>
                {step > s ? '✓' : s}
            </div>
        ))}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] max-w-4xl mx-auto border border-slate-200">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-purple-900 p-6 text-white relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20"></div>
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center">
            <Image 
              src="/logo.svg" 
              alt="Influo.gr Logo" 
              width={140} 
              height={56} 
              className="h-10 w-auto"
            />
          </div>
          <div className="text-center flex-1">
              <h3 className="text-2xl md:text-3xl font-bold mb-2">{txt.headerTitle}</h3>
              <p className="text-slate-300 text-sm">{txt.headerDesc}</p>
          </div>
          <button 
              onClick={() => setLang(lang === "el" ? "en" : "el")}
              className="text-xs font-medium border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 text-slate-600 transition-colors bg-white"
              aria-label="Toggle language"
          >
              {lang === "el" ? "EN" : "EL"}
          </button>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto bg-white">
        {step < 4 && <ProgressSteps />}

        {/* --- STEP 1 --- (Basic Info & Password) */}
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

                {/* CATEGORIES MULTI-SELECT */}
                <div>
                    <label className={labelClass}>{txt.catLabel}</label>
                    <p className="text-xs text-slate-500 mb-3">{txt.catDesc}</p>
                    <div className="border-2 border-slate-200 rounded-xl p-4 bg-slate-50 max-h-64 overflow-y-auto">
                        <div className="space-y-2">
                            {CATEGORIES.map(cat => {
                                const isSelected = categories.includes(cat);
                                const displayName = lang === 'el' 
                                    ? (categoryTranslations[cat]?.el || cat) 
                                    : (categoryTranslations[cat]?.en || cat);
                                
                                return (
                                    <label 
                                        key={cat} 
                                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                            isSelected 
                                                ? 'bg-blue-100 border-2 border-blue-500' 
                                                : 'bg-white border-2 border-slate-200 hover:border-blue-300'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => {
                                                if (cat === "Γενικά" || cat === "General") {
                                                    // If "General" is selected, clear all others
                                                    if (e.target.checked) {
                                                        setCategories([cat]);
                                                    } else {
                                                        setCategories(["Lifestyle"]);
                                                    }
                                                } else {
                                                    // Remove "General" if selecting specific category
                                                    const newCats = e.target.checked
                                                        ? [...categories.filter(c => c !== "Γενικά" && c !== "General"), cat]
                                                        : categories.filter(c => c !== cat);
                                                    
                                                    // Ensure at least one category is selected
                                                    if (newCats.length === 0) {
                                                        setCategories(["Lifestyle"]);
                                                    } else {
                                                        setCategories(newCats);
                                                    }
                                                }
                                            }}
                                            className="w-5 h-5 text-blue-600 border-2 border-slate-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                        />
                                        <span className={`font-medium ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                                            {displayName}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                    {categories.length > 0 && (
                        <p className="text-xs text-slate-600 mt-2">
                            {lang === 'el' ? `Επιλέχθηκαν: ${categories.map(c => categoryTranslations[c]?.el || c).join(', ')}` : `Selected: ${categories.map(c => categoryTranslations[c]?.en || c).join(', ')}`}
                        </p>
                    )}
                </div>

                <div>
                    <label className={labelClass}>{txt.locationLabel}</label>
                    <input type="text" className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder={txt.locationPlace} />
                </div>

                {/* EMAIL & PASSWORD FIELDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>{txt.emailLabel}</label>
                        <div className="relative">
                          <input 
                            type="email" 
                            className={`${inputClass} ${emailError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`} 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            placeholder="brands@example.com" 
                          />
                          {checkingEmail && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            </div>
                          )}
                        </div>
                        {emailError && (
                          <p className="text-red-600 text-xs mt-1 font-medium">{emailError}</p>
                        )}
                    </div>
                    {/* PASSWORD FIELD WITH TOGGLE */}
                    <div className="relative">
                        <label className={labelClass}>{txt.passLabel}</label>
                        <input type={showPassword ? "text" : "password"} className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                        <button 
                            type="button" 
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 bottom-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                            {showPassword ? txt.passHide : txt.passShow}
                        </button>
                    </div>
                </div>
                
                {/* BIO */}
                <div>
                    <label className={labelClass}>{txt.bioLabel}</label>
                    <textarea className={inputClass} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder={txt.bioPlace} />
                </div>

                {message && <p className="text-red-600 text-sm text-center mt-2 font-medium bg-red-50 p-2 rounded">{message}</p>}
                
                {/* Button at the end of Step 1 */}
                <div className="mt-8 pt-6 border-t border-slate-200">
                  <button 
                    onClick={handleCheckEmailAndNext} 
                    disabled={!displayName || !email || !password || loading || !!emailError || checkingEmail} 
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (lang === "el" ? "Έλεγχος..." : "Checking...") : txt.next}
                  </button>
                </div>
            </div>
        )}

        {/* --- STEP 2 --- (Socials) */}
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

                {/* LANGUAGES MULTI-SELECT */}
                <div>
                    <label className={labelClass}>{txt.langsLabel}</label>
                    <p className="text-xs text-slate-500 mb-3">{txt.langsDesc}</p>
                    <div className="border-2 border-slate-200 rounded-xl p-4 bg-slate-50">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {LANGUAGES.map(langItem => {
                                const isSelected = selectedLanguages.includes(langItem.code);
                                const displayName = lang === 'el' ? langItem.el : langItem.en;
                                
                                return (
                                    <label 
                                        key={langItem.code} 
                                        className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-all ${
                                            isSelected 
                                                ? 'bg-blue-100 border-2 border-blue-500' 
                                                : 'bg-white border-2 border-slate-200 hover:border-blue-300'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedLanguages([...selectedLanguages, langItem.code]);
                                                } else {
                                                    setSelectedLanguages(selectedLanguages.filter(l => l !== langItem.code));
                                                }
                                            }}
                                            className="w-4 h-4 text-blue-600 border-2 border-slate-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                        />
                                        <span className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                                            {displayName}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                    {selectedLanguages.length > 0 && (
                        <p className="text-xs text-slate-600 mt-2">
                            {lang === 'el' 
                                ? `Επιλέχθηκαν: ${selectedLanguages.map(l => LANGUAGES.find(lang => lang.code === l)?.el || l).join(', ')}` 
                                : `Selected: ${selectedLanguages.map(l => LANGUAGES.find(lang => lang.code === l)?.en || l).join(', ')}`}
                        </p>
                    )}
                </div>
                
                {/* Buttons at the end of Step 2 */}
                <div className="mt-8 pt-6 border-t border-slate-200 flex gap-4">
                  <button onClick={() => { setStep(1); setMessage(""); }} className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-all">{txt.back}</button>
                  <button onClick={() => { setStep(3); setMessage(""); }} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all">{txt.next}</button>
                </div>
            </div>
        )}

        {/* --- STEP 3 --- (Portfolio & Insights) */}
        {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <h2 className="text-xl font-bold text-black border-b border-gray-200 pb-2">{txt.step3}</h2>
                
                {/* Photo */}
                <div className="flex items-center gap-6 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <div className="relative w-20 h-20 rounded-full bg-white shadow-sm border border-gray-200 overflow-hidden flex items-center justify-center">
                        {avatarPreview ? <Image src={avatarPreview} alt="Avatar preview" fill className="object-cover" /> : <span className="text-3xl">📸</span>}
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
                    <div className="text-xs text-blue-800 bg-blue-100 p-3 rounded-lg mb-3 border border-blue-200">
                        {txt.insightsTip}
                    </div>
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

                {/* Audience Data (Self Declared) */}
                <h3 className="text-sm font-bold uppercase text-gray-600 border-b border-gray-200 pb-2">{txt.aud_title}</h3>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className={labelClass}>{txt.aud_male}</label>
                        <input type="number" className={inputClass} value={malePercent} onChange={handleMaleChange} placeholder="35" />
                    </div>
                    <div>
                        <label className={labelClass}>{txt.aud_female}</label>
                        <input type="number" className={inputClass} value={femalePercent} onChange={handleFemaleChange} placeholder="65" />
                    </div>
                    <div>
                        <label className={labelClass}>{txt.aud_age_group}</label>
                        <input type="text" className={inputClass} value={topAge} onChange={(e) => setTopAge(e.target.value)} placeholder={txt.aud_age_place} />
                    </div>
                </div>

                {/* Engagement / Likes / Rate */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>{txt.engageRateLabel}</label>
                        <input type="text" className={inputClass} value={engagementRate} onChange={(e) => setEngagementRate(replaceCommaWithDot(e.target.value))} placeholder="5.5%" />
                    </div>
                    <div>
                        <label className={labelClass}>{txt.avgLikesLabel}</label>
                        <input type="text" className={inputClass} value={avgLikes} onChange={(e) => setAvgLikes(replaceCommaWithDot(e.target.value))} placeholder="3.2k" />
                    </div>
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
                    <input type="text" className={inputClass} value={minRate} onChange={(e) => setMinRate(replaceCommaWithDot(e.target.value))} placeholder="150" />
                </div>

                {message && <p className="text-red-600 text-sm text-center mt-2 font-medium bg-red-50 p-2 rounded">{message}</p>}
                
                {/* Buttons at the end of Step 3 */}
                <div className="mt-8 pt-6 border-t border-slate-200 flex gap-4">
                  <button onClick={() => { setStep(2); setMessage(""); }} className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-all">{txt.back}</button>
                  <button onClick={handleSubmit} disabled={loading} className="flex-1 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-slate-900/30 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? txt.loading : txt.submit}
                  </button>
                </div>
            </div>
        )}

        {/* --- STEP 4 --- (Success) */}
        {step === 4 && (
            <div className="text-center py-20 animate-in zoom-in duration-300">
                <div className="w-24 h-24 bg-gradient-to-br from-green-100 to-emerald-100 text-green-600 rounded-full flex items-center justify-center text-5xl mx-auto mb-6 shadow-lg shadow-green-500/20 animate-bounce">🎉</div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">{txt.successTitle}</h2>
                <p className="text-slate-600 max-w-md mx-auto mb-10 text-lg leading-relaxed">
                    {txt.successDesc}
                </p>
                <a href="/login" className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-xl hover:shadow-xl shadow-lg shadow-blue-500/30 transition-all inline-block max-w-xs mx-auto">
                    {txt.close}
                </a>
            </div>
        )}

      </div>
    </div>
  );
}