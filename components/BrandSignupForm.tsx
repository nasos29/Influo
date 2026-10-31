"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import InfluoLogo from '@/components/InfluoLogo';
import { getStoredLanguage } from '@/lib/language';
import { prepareImageForStorage } from '@/lib/prepareImageForStorage';
import { formatCategoryLabels, formatStoredCategories } from '@/lib/categories';
import CategoryCheckboxList from '@/components/CategoryCheckboxList';
import { clearLoggedOutMark } from '@/lib/authSession';
import { BRAND_BIO_MAX, normalizeBrandBio } from '@/lib/brandProfile';
import { findContactInfo } from '@/lib/contactFilter';

type Lang = "el" | "en";

const BIO_CONTACT_BLOCKED = {
  el: "Για την ασφάλειά σας δεν επιτρέπονται links, email ή τηλέφωνα στο bio.",
  en: "For your safety, links, emails and phone numbers aren't allowed in the bio.",
} as const;

const t = {
  el: {
    headerTitle: "Εγγραφή Επιχείρησης",
    headerDesc: "Δημιούργησε λογαριασμό για να συνεργαστείς με influencers",
    step1: "Βασικά Στοιχεία",
    step2: "Προφίλ & Κατηγορίες",
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
    bioLabel: "Λίγα λόγια για την επιχείρηση / το brand σας",
    bioPlace: "Πείτε ποιοι είστε και τι ψάχνετε… (προαιρετικό)",
    bioHint: "Έως 600 χαρακτήρες. Χωρίς τηλέφωνα, email ή links.",
    categoryLabel: "Κατηγορίες *",
    categoryDesc: "Επιλέξτε μία ή περισσότερες κατηγορίες",
    next: "Επόμενο →",
    submit: "Δημιουργία Λογαριασμού",
    loading: "Δημιουργία...",
    checking: "Έλεγχος...",
    successTitle: "Καλώς ήρθατε!",
    successDesc: "Ο λογαριασμός σας δημιουργήθηκε. Μπορείτε να συνδεθείτε τώρα.",
    close: "Σύνδεση",
    back: "← Πίσω",
    error_required: "Παρακαλώ συμπληρώστε όλα τα απαραίτητα πεδία",
    error_category: "Παρακαλώ επιλέξτε τουλάχιστον μία κατηγορία.",
    error_email_exists: "Αυτό το email χρησιμοποιείται ήδη",
    error_afm_invalid: "Το ΑΦΜ πρέπει να έχει 9 ψηφία",
    error_logo_size: "Το αρχείο είναι πολύ μεγάλο. Μέγιστο μέγεθος: 2MB",
    error_bio_too_long: `Το bio μπορεί να έχει έως ${BRAND_BIO_MAX} χαρακτήρες.`,
    error_signup: "Σφάλμα κατά την εγγραφή",
    haveAccount: "Έχετε ήδη λογαριασμό; ",
    signIn: "Συνδεθείτε",
    logoHint: "PNG, JPG ή SVG (max. 2MB)",
  },
  en: {
    headerTitle: "Company Registration",
    headerDesc: "Create an account to collaborate with influencers",
    step1: "Basic Info",
    step2: "Profile & Categories",
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
    bioLabel: "A few words about your business / brand",
    bioPlace: "Tell creators who you are and what you look for… (optional)",
    bioHint: "Up to 600 characters. No phones, emails, or links.",
    categoryLabel: "Categories *",
    categoryDesc: "Select one or more categories",
    next: "Next →",
    submit: "Create Account",
    loading: "Creating...",
    checking: "Checking...",
    successTitle: "Welcome!",
    successDesc: "Your account has been created. You can log in now.",
    close: "Sign In",
    back: "← Back",
    error_required: "Please fill in all required fields",
    error_category: "Please select at least one category.",
    error_email_exists: "This email is already in use",
    error_afm_invalid: "Tax ID must have 9 digits",
    error_logo_size: "File is too large. Maximum size: 2MB",
    error_bio_too_long: `Bio can be at most ${BRAND_BIO_MAX} characters.`,
    error_signup: "Error during registration",
    haveAccount: "Already have an account? ",
    signIn: "Sign In",
    logoHint: "PNG, JPG or SVG (max. 2MB)",
  }
};

const inputClass = "w-full px-4 py-3 !bg-white !text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 shadow-sm hover:border-slate-300";
const labelClass = "block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2";

export default function BrandSignupForm({ embedded = false }: { embedded?: boolean }) {
  const [lang, setLang] = useState<Lang>("el");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState(1);
  
  const router = useRouter();
  const txt = t[lang];

  useEffect(() => {
    setLang(getStoredLanguage());
  }, []);

  const [brandName, setBrandName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [afm, setAfm] = useState("");
  const [website, setWebsite] = useState("");
  const [bio, setBio] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

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

  const handleStep1Next = () => {
    setMessage("");
    if (!brandName.trim() || !email.trim() || !password.trim() || password.length < 6) {
      setMessage(txt.error_required);
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const storedCategories = formatStoredCategories(categories);
      if (!brandName.trim() || !email.trim() || !password.trim() || password.length < 6) {
        setMessage(txt.error_required);
        setStep(1);
        setLoading(false);
        return;
      }
      if (!storedCategories) {
        setMessage(txt.error_category);
        setLoading(false);
        return;
      }

      let normalizedBio: string | null = null;
      try {
        normalizedBio = normalizeBrandBio(bio);
      } catch {
        setMessage(txt.error_bio_too_long);
        setLoading(false);
        return;
      }
      if (normalizedBio && findContactInfo(normalizedBio)) {
        setMessage(BIO_CONTACT_BLOCKED[lang]);
        setLoading(false);
        return;
      }

      const afmClean = afm.replace(/\D/g, '');
      if (afmClean.length > 0 && afmClean.length !== 9) {
        setMessage(txt.error_afm_invalid);
        setLoading(false);
        return;
      }

      const checkRes = await fetch('/api/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });
      const checkBody = await checkRes.json().catch(() => ({}));

      if (checkRes.ok && checkBody.exists) {
        setMessage(txt.error_email_exists);
        setStep(1);
        setLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password: password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('User creation failed');
      }

      let logoUrl = null;
      if (logoFile) {
        try {
          const preparedLogo = await prepareImageForStorage(logoFile, { maxSide: 640 });
          const safeTail = preparedLogo.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const fileName = `brand-${authData.user.id}-${Date.now()}-${safeTail}`;
          const filePath = fileName;

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, preparedLogo, {
              cacheControl: '31536000',
              upsert: false
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

          logoUrl = publicUrl;
        } catch (uploadErr: any) {
          console.error('Logo upload error:', uploadErr);
        }
      }

      const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password: password,
      });

      if (signInError) {
        console.error('Auto-login error:', signInError);
      } else {
        clearLoggedOutMark();
      }

      const accessToken = session?.access_token || authData.session?.access_token;
      if (!accessToken) {
        throw new Error(txt.error_signup);
      }

      const registerRes = await fetch('/api/brand/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          lang,
          brand_name: brandName.trim(),
          contact_person: contactPerson.trim() || null,
          afm: afmClean || null,
          website: website.trim() || null,
          industry: storedCategories,
          logo_url: logoUrl,
          bio: normalizedBio,
        }),
      });
      const registerBody = await registerRes.json().catch(() => ({}));
      if (!registerRes.ok) {
        throw new Error(
          typeof registerBody.error === 'string' && registerBody.error
            ? registerBody.error
            : txt.error_signup
        );
      }

      await fetch('/api/proposals/claim', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => {});

      setSuccess(true);

      try {
        await fetch('/api/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'signup_brand_admin',
            email: email.toLowerCase().trim(),
            name: brandName.trim(),
            industry: formatCategoryLabels(storedCategories, 'el') || storedCategories,
          }),
        });
      } catch (e) {
        console.error('Admin notification email error:', e);
      }
      
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

  const ProgressSteps = () => (
    <div className="flex justify-between mb-8 relative px-4">
      <div className="absolute top-1/2 left-0 w-full h-1.5 bg-slate-200 rounded-full -z-10"></div>
      <div
        className="absolute top-1/2 left-4 h-1.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full transition-all duration-500 -z-10"
        style={{ width: step >= 2 ? 'calc(100% - 2rem)' : '0%' }}
      ></div>
      {[1, 2].map((s) => (
        <div
          key={s}
          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm transition-all border-2 shadow-md ${
            step >= s
              ? 'bg-gradient-to-br from-blue-600 to-purple-600 border-blue-600 text-white scale-110'
              : 'bg-white border-slate-300 text-slate-500'
          }`}
        >
          {step > s ? '✓' : s}
        </div>
      ))}
    </div>
  );

  const shellClass = embedded
    ? "bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] max-w-4xl w-full mx-auto border border-slate-200"
    : "bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-w-4xl w-full mx-auto border border-slate-200";

  if (success) {
    return (
      <div className={shellClass}>
        <div className="p-6 sm:p-8 text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-green-100 to-emerald-100 text-green-600 rounded-full flex items-center justify-center text-5xl mx-auto mb-6 shadow-lg shadow-green-500/20">✓</div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">{txt.successTitle}</h2>
          <p className="text-slate-600 max-w-md mx-auto mb-10 text-lg leading-relaxed">{txt.successDesc}</p>
          <button
            onClick={() => router.push('/login')}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all"
          >
            {txt.close}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-purple-900 p-4 sm:p-6 text-white relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pr-10">
          <div className="flex items-center justify-start">
            <InfluoLogo className="h-8 sm:h-10 w-auto" title="Influo" />
          </div>
          <div className="text-left sm:flex-1 sm:text-center">
            <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2 leading-tight">{txt.headerTitle}</h3>
            <p className="text-slate-300 text-xs sm:text-sm">{txt.headerDesc}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto bg-white">
        {!embedded && (
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-slate-600 hover:text-slate-900 font-medium mb-4"
          >
            {txt.back}
          </button>
        )}

        <ProgressSteps />

        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-black border-b border-gray-200 pb-2">{txt.step1}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{txt.brandNameLabel} *</label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder={txt.brandNamePlace}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{txt.contactPersonLabel}</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder={txt.contactPersonPlace}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{txt.emailLabel} *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={txt.emailPlace}
                  className={inputClass}
                />
              </div>
              <div className="relative">
                <label className={labelClass}>{txt.passwordLabel} *</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 bottom-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {showPassword ? txt.passwordHide : txt.passwordShow}
                </button>
              </div>
            </div>

            {message && <p className="text-red-600 text-sm text-center mt-2 font-medium bg-red-50 p-2 rounded">{message}</p>}

            <div className="mt-8 pt-6 border-t border-slate-200">
              <button
                type="button"
                onClick={handleStep1Next}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl"
              >
                {txt.next}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <h2 className="text-xl font-bold text-black border-b border-gray-200 pb-2">{txt.step2}</h2>

            <CategoryCheckboxList
              lang={lang}
              selected={categories}
              onChange={setCategories}
              label={txt.categoryLabel}
              description={txt.categoryDesc}
            />

            <div>
              <label className={labelClass}>{txt.websiteLabel}</label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder={txt.websitePlace}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>{txt.bioLabel}</label>
              <textarea
                value={bio}
                onChange={(e) => {
                  setBio(e.target.value.slice(0, BRAND_BIO_MAX));
                  setMessage("");
                }}
                rows={4}
                maxLength={BRAND_BIO_MAX}
                placeholder={txt.bioPlace}
                className={`${inputClass} resize-y`}
              />
              <p className="text-xs text-slate-500 mt-1">
                {txt.bioHint} ({bio.length}/{BRAND_BIO_MAX})
              </p>
            </div>

            <div>
              <label className={labelClass}>{txt.afmLabel}</label>
              <input
                type="text"
                value={afm}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                  setAfm(value);
                }}
                placeholder={txt.afmPlace}
                className={inputClass}
                maxLength={9}
              />
            </div>

            <div>
              <label className={labelClass}>{txt.logoLabel}</label>
              {logoPreview ? (
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 bg-white">
                    <Image src={logoPreview} alt="Logo preview" fill className="object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLogoFile(null);
                      setLogoPreview(null);
                    }}
                    className="text-sm text-red-600 hover:text-red-700 font-semibold"
                  >
                    {txt.logoRemove}
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full min-h-32 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer hover:bg-slate-50 transition-colors p-4">
                  <svg className="w-8 h-8 mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="mb-1 text-sm font-semibold text-slate-600">{txt.logoUpload}</p>
                  <p className="text-xs text-slate-400">{txt.logoHint}</p>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 2 * 1024 * 1024) {
                          setMessage(txt.error_logo_size);
                          return;
                        }
                        setMessage("");
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

            {message && <p className="text-red-600 text-sm text-center mt-2 font-medium bg-red-50 p-2 rounded">{message}</p>}

            <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => { setStep(1); setMessage(""); }}
                className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-all"
              >
                {txt.back}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-slate-900/30 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? txt.loading : txt.submit}
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          {txt.haveAccount}
          <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            {txt.signIn}
          </a>
        </p>
      </div>
    </div>
  );
}
