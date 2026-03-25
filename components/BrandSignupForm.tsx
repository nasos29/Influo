"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getStoredLanguage, setStoredLanguage } from '@/lib/language';

type Lang = "el" | "en";

// Categories (same as influencers)
const CATEGORIES = [
  "Lifestyle", "Fashion & Style", "Beauty & Makeup", "Travel", "Food & Drink",
  "Health & Fitness", "Tech & Gadgets", "Business & Finance", "Gaming & Esports",
  "Parenting & Family", "Home & Decor", "Pets & Animals", "Comedy & Entertainment",
  "Art & Photography", "Music & Dance", "Education & Coaching", "Sports & Athletes",
  "DIY & Crafts", "Sustainability & Eco", "Cars & Automotive"
];

// Category translations
const categoryTranslations: { [key: string]: { el: string; en: string } } = {
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
    headerTitle: "Εγγραφή Επιχείρησης",
    headerDesc: "Δημιούργησε λογαριασμό για να συνεργαστείς με influencers",
    smartFeature: "🤖 Έξυπνη Υπηρεσία Προτάσεων: Το AI μας προτείνει αυτόματα τους καλύτερους influencers για το brand σας. ΔΩΡΕΑΝ!",
    brandNameLabel: "Όνομα Επιχείρησης",
    brandNamePlace: "π.χ. Acme Corporation",
    contactPersonLabel: "Επικοινωνία (Προαιρετικό)",
    contactPersonPlace: "π.χ. Γιάννης Παπαδόπουλος",
    emailLabel: "Email",
    emailPlace: "epixeirisi@example.com",
    passwordLabel: "Κωδικός (τουλάχιστον 6 χαρακτήρες)",
    passwordShow: "Εμφάνιση",
    passwordHide: "Απόκρυψη",
    afmLabel: "ΑΦΜ (προαιρετικό – μπορείτε να το προσθέσετε αργότερα)",
    afmPlace: "123456789",
    logoLabel: "Λογότυπο (Προαιρετικό)",
    logoUpload: "Ανέβασμα Λογοτύπου",
    logoRemove: "Αφαίρεση",
    websiteLabel: "Ιστοσελίδα (Προαιρετικό)",
    websitePlace: "example.com ή www.example.com",
    categoryLabel: "Κατηγορία *",
    categoryPlace: "Επιλέξτε κατηγορία",
    submit: "Δημιουργία Λογαριασμού",
    loading: "Δημιουργία...",
    successTitle: "Καλώς ήρθατε!",
    successDesc: "Ο λογαριασμός σας δημιουργήθηκε. Μπορείτε να συνδεθείτε τώρα.",
    close: "Σύνδεση",
    back: "← Πίσω",
    error_required: "Παρακαλώ συμπληρώστε όλα τα απαραίτητα πεδία",
    error_email_exists: "Αυτό το email χρησιμοποιείται ήδη",
    error_afm_invalid: "Το ΑΦΜ πρέπει να έχει 9 ψηφία",
    error_signup: "Σφάλμα κατά την εγγραφή"
  },
  en: {
    headerTitle: "Company Registration",
    headerDesc: "Create an account to collaborate with influencers",
    smartFeature: "🤖 Smart Recommendation Service: Our AI automatically suggests the best influencers for your brand. FREE!",
    brandNameLabel: "Company Name",
    brandNamePlace: "e.g. Acme Corporation",
    contactPersonLabel: "Contact Person (Optional)",
    contactPersonPlace: "e.g. John Doe",
    emailLabel: "Email",
    emailPlace: "company@example.com",
    passwordLabel: "Password (min 6 characters)",
    passwordShow: "Show",
    passwordHide: "Hide",
    afmLabel: "Tax ID (optional – add later in dashboard)",
    afmPlace: "123456789",
    logoLabel: "Logo (Optional)",
    logoUpload: "Upload Logo",
    logoRemove: "Remove",
    websiteLabel: "Website (Optional)",
    websitePlace: "example.com or www.example.com",
    categoryLabel: "Category *",
    categoryPlace: "Select category",
    submit: "Create Account",
    loading: "Creating...",
    successTitle: "Welcome!",
    successDesc: "Your account has been created. You can log in now.",
    close: "Sign In",
    back: "← Back",
    error_required: "Please fill in all required fields",
    error_email_exists: "This email is already in use",
    error_afm_invalid: "Tax ID must have 9 digits",
    error_signup: "Error during registration"
  }
};

export default function BrandSignupForm({ embedded = false }: { embedded?: boolean }) {
  const [lang, setLang] = useState<Lang>("el"); // Default to Greek, will be updated in useEffect
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const router = useRouter();
  const txt = t[lang];

  // Load language from localStorage on client-side
  useEffect(() => {
    setLang(getStoredLanguage());
  }, []);

  // Form states
  const [brandName, setBrandName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [afm, setAfm] = useState("");
  const [website, setWebsite] = useState("");
  const [category, setCategory] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Pre-fill email from URL parameter and get redirect URL
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get('email');
      const redirectParam = params.get('redirect');
      
      if (emailParam) {
        setEmail(emailParam);
      }
      
      if (redirectParam) {
        setRedirectUrl(redirectParam);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      // Validation (AΦΜ optional to reduce signup friction)
      if (!brandName.trim() || !email.trim() || !password.trim() || password.length < 6 || !category.trim()) {
        setMessage(txt.error_required);
        setLoading(false);
        return;
      }

      const afmClean = afm.replace(/\D/g, '');
      if (afmClean.length > 0 && afmClean.length !== 9) {
        setMessage(txt.error_afm_invalid);
        setLoading(false);
        return;
      }

      // Check if email already exists in brands
      const { count } = await supabase
        .from('brands')
        .select('id', { count: 'exact', head: true })
        .eq('contact_email', email.toLowerCase().trim());

      if (count && count > 0) {
        setMessage(txt.error_email_exists);
        setLoading(false);
        return;
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password: password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('User creation failed');
      }

      // Upload logo if provided
      let logoUrl = null;
      if (logoFile) {
        setUploadingLogo(true);
        try {
          const fileExt = logoFile.name.split('.').pop();
          const fileName = `brand-${authData.user.id}-${Date.now()}.${fileExt}`;
          const filePath = fileName;

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, logoFile, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

          logoUrl = publicUrl;
        } catch (uploadErr: any) {
          console.error('Logo upload error:', uploadErr);
          // Continue without logo if upload fails
        } finally {
          setUploadingLogo(false);
        }
      }

      // Normalize website URL: remove protocol and www if present, store just the domain
      let normalizedWebsite = website.trim();
      if (normalizedWebsite) {
        // Remove http://, https://, www. prefixes
        normalizedWebsite = normalizedWebsite.replace(/^https?:\/\//i, '');
        normalizedWebsite = normalizedWebsite.replace(/^www\./i, '');
        // Remove trailing slash
        normalizedWebsite = normalizedWebsite.replace(/\/$/, '');
      }

      // Create brand record
      const { error: brandError } = await supabase
        .from('brands')
        .insert({
          id: authData.user.id,
          brand_name: brandName.trim(),
          contact_email: email.toLowerCase().trim(),
          contact_person: contactPerson.trim() || null,
          afm: afmClean || null,
          website: normalizedWebsite || null,
          industry: category.trim() || null, // Keep 'industry' column name in DB for compatibility
          logo_url: logoUrl,
        });

      if (brandError) {
        // If brand insert fails, we should clean up the auth user
        // But this requires admin access, so we'll just show error
        throw brandError;
      }

      // Link existing proposals to this brand (by email)
      await supabase
        .from('proposals')
        .update({ brand_id: authData.user.id })
        .eq('brand_email', email.toLowerCase().trim())
        .is('brand_id', null);

      // Auto-login after successful signup
      const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password: password,
      });

      if (signInError) {
        console.error('Auto-login error:', signInError);
        // Continue anyway - user can login manually
      }

      setSuccess(true);

      try {
        await fetch('/api/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'signup_brand_admin',
            email: email.toLowerCase().trim(),
            name: brandName.trim(),
            industry: category.trim(),
          }),
        });
      } catch (e) {
        console.error('Admin notification email error:', e);
      }
      
      // Redirect to dashboard or redirect URL after a short delay
      setTimeout(() => {
        if (redirectUrl) {
          router.push(redirectUrl);
        } else {
          router.push('/brand/dashboard');
        }
      }, 2000);
    } catch (err: any) {
      console.error('Signup error:', err);
      setMessage(err.message || txt.error_signup);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div
        className={embedded ? "bg-white rounded-2xl shadow-2xl p-8 max-w-4xl w-full mx-auto border border-slate-200" : "bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-auto"}
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✓</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">{txt.successTitle}</h2>
          <p className="text-slate-600 mb-6">{txt.successDesc}</p>
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            {txt.close}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        embedded
          ? "bg-white rounded-2xl shadow-2xl p-0 max-w-4xl w-full mx-auto border border-slate-200 overflow-hidden max-h-[85vh] flex flex-col"
          : "bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-auto"
      }
    >
      {!embedded && (
        <>
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => router.back()}
              className="text-slate-600 hover:text-slate-900 transition-colors"
            >
              {txt.back}
            </button>
          </div>

          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{txt.headerTitle}</h1>
            <p className="text-slate-600 text-sm mb-3">{txt.headerDesc}</p>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 text-sm">
              <p className="text-blue-900 font-medium">{txt.smartFeature}</p>
            </div>
          </div>
        </>
      )}

      {embedded && (
        <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-purple-900 p-4 sm:p-6 text-white relative overflow-hidden flex-shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex items-center justify-start">
              <Image src="/logo.svg" alt="Influo.gr Logo" width={140} height={56} className="h-8 sm:h-10 w-auto" />
            </div>
            <div className="text-left w-full sm:flex-1 sm:text-center">
              <h3 className="text-2xl md:text-3xl font-bold mb-1 sm:mb-2 leading-[1.1]">{txt.headerTitle}</h3>
              <p className="text-slate-300 text-xs sm:text-sm">{txt.headerDesc}</p>
              <div className="mt-3 sm:mt-4 bg-white/10 border border-white/15 rounded-lg p-2.5 sm:p-3 text-xs sm:text-sm">
                <p className="text-white font-medium">{txt.smartFeature}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={embedded ? "p-8 overflow-y-auto flex-1" : ""}>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          message.includes('✓') || message.includes('success') 
            ? 'bg-green-50 text-green-700' 
            : 'bg-red-50 text-red-700'
        }`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {txt.brandNameLabel} *
          </label>
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder={txt.brandNamePlace}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {txt.contactPersonLabel}
          </label>
          <input
            type="text"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            placeholder={txt.contactPersonPlace}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {txt.emailLabel} *
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={txt.emailPlace}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {txt.passwordLabel} *
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 pr-12"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 text-sm"
            >
              {showPassword ? txt.passwordHide : txt.passwordShow}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {txt.afmLabel}
          </label>
          <input
            type="text"
            value={afm}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 9);
              setAfm(value);
            }}
            placeholder={txt.afmPlace}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
            maxLength={9}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {txt.logoLabel}
          </label>
          {logoPreview ? (
            <div className="relative inline-block">
              <div className="w-24 h-24 rounded-lg overflow-hidden border-2 border-slate-200 mb-2">
                <Image
                  src={logoPreview}
                  alt="Logo preview"
                  width={96}
                  height={96}
                  className="object-cover w-full h-full"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setLogoFile(null);
                  setLogoPreview(null);
                }}
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                {txt.logoRemove}
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg className="w-8 h-8 mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mb-2 text-sm text-slate-500">{txt.logoUpload}</p>
                <p className="text-xs text-slate-400">PNG, JPG ή SVG (max. 2MB)</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 2 * 1024 * 1024) {
                      setMessage(lang === 'el' ? 'Το αρχείο είναι πολύ μεγάλο. Μέγιστο μέγεθος: 2MB' : 'File is too large. Maximum size: 2MB');
                      return;
                    }
                    setLogoFile(file);
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setLogoPreview(reader.result as string);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </label>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {txt.websiteLabel}
          </label>
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder={txt.websitePlace}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {txt.categoryLabel}
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white"
          >
            <option value="">{txt.categoryPlace}</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {lang === 'el' ? categoryTranslations[cat]?.el || cat : categoryTranslations[cat]?.en || cat}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
        >
          {loading ? txt.loading : txt.submit}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        {lang === 'el' ? 'Έχετε ήδη λογαριασμό; ' : 'Already have an account? '}
        <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
          {lang === 'el' ? 'Συνδεθείτε' : 'Sign In'}
        </a>
      </p>
    </div>
    </div>
  );
}

