// app/login/page.tsx
"use client";

import { useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient'; 
import { useRouter } from 'next/navigation';

const t = {
  el: {
    title: "Καλώς ήρθατε",
    subtitle: "Συνδεθείτε στον λογαριασμό σας",
    email_label: "Διεύθυνση Email",
    email_placeholder: "xxxx@email.com",
    password_label: "Κωδικός Πρόσβασης",
    password_placeholder: "••••••••",
    forgot_password: "Ξέχασα τον κωδικό μου",
    login_button: "Σύνδεση",
    logging_in: "Σύνδεση...",
    footer_note: "Για Influencers, Επιχειρήσεις και Admins.",
    back: "Πίσω στο Site",
    reset_email_sent: "Στάλθηκε email επαναφοράς κωδικού. Ελέγξτε το inbox σας.",
    reset_error: "Σφάλμα:",
  },
  en: {
    title: "Welcome Back",
    subtitle: "Sign in to your account",
    email_label: "Email Address",
    email_placeholder: "your@email.com",
    password_label: "Password",
    password_placeholder: "••••••••",
    forgot_password: "Forgot Password?",
    login_button: "Log In",
    logging_in: "Logging In...",
    footer_note: "For Influencers, Brands and Admins.",
    back: "Back to Site",
    reset_email_sent: "Password reset email sent. Please check your inbox.",
    reset_error: "Error:",
  }
};

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState(''); 
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState<'error' | 'success'>('error');
    const [lang, setLang] = useState<'el' | 'en'>('el');
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();
    const txt = t[lang];

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        // 1. Sign In με Email/Password
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            // Translate common error messages - be more specific to avoid false positives
            let translatedMessage = error.message;
            
            // Check for exact error messages from Supabase
            if (error.message === 'Invalid login credentials' || 
                error.message.toLowerCase().includes('invalid login credentials') ||
                error.message.toLowerCase().includes('email not found') ||
                error.message.toLowerCase().includes('incorrect password')) {
                translatedMessage = lang === 'el' 
                    ? 'Μη έγκυρα στοιχεία σύνδεσης. Παρακαλώ ελέγξτε το email και τον κωδικό πρόσβασης.' 
                    : 'Invalid login credentials. Please check your email and password.';
            } else if (error.message.includes('Email not confirmed') || 
                       error.message.includes('email_not_confirmed')) {
                translatedMessage = lang === 'el' 
                    ? 'Το email σας δεν έχει επιβεβαιωθεί. Παρακαλώ ελέγξτε το inbox σας.' 
                    : 'Your email has not been confirmed. Please check your inbox.';
            } else {
                // For any other errors, show the original message
                translatedMessage = error.message;
            }
            
            setMessage(translatedMessage);
            setMessageType('error');
            setLoading(false);
            return;
        }

        // Check if user exists but login succeeded
        if (!data.user) {
            setMessage(lang === 'el' 
                ? 'Σφάλμα: Δεν μπόρεσε να γίνει σύνδεση. Παρακαλώ δοκιμάστε ξανά.' 
                : 'Error: Could not sign in. Please try again.');
            setMessageType('error');
            setLoading(false);
            return;
        }

        // Admin check by email (case-insensitive and trimmed)
        const userEmail = data.user?.email?.toLowerCase().trim();
        const adminEmail = 'nd.6@hotmail.com'.toLowerCase().trim();
        const isAdmin = userEmail === adminEmail;

        if (isAdmin) {
            router.push('/admin');
            setLoading(false);
            return;
        }

        // Check if user is a brand (has AFM)
        const { data: brandData, error: brandError } = await supabase
            .from('brands')
            .select('id, afm')
            .eq('contact_email', userEmail)
            .maybeSingle();

        if (!brandError && brandData && brandData.afm) {
            // User is a brand (has AFM) -> redirect to brand dashboard
            router.push('/brand/dashboard');
            setLoading(false);
            return;
        }

        // User is an influencer (no AFM) -> redirect to influencer dashboard
        router.push('/dashboard');

        setLoading(false);
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setResetLoading(true);
        setMessage('');

        if (!email) {
            setMessage(lang === 'el' ? 'Παρακαλώ εισάγετε το email σας' : 'Please enter your email');
            setMessageType('error');
            setResetLoading(false);
            return;
        }

        // Check if email exists in database (influencers, brands or admin)
        const ADMIN_EMAIL = 'nd.6@hotmail.com';
        const isAdmin = email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();

        if (!isAdmin) {
            // Check if email exists in influencers table
            const { data: influencer, error: influencerError } = await supabase
                .from('influencers')
                .select('contact_email')
                .eq('contact_email', email)
                .maybeSingle();

            // Check if email exists in brands table (case-insensitive)
            // Check contact_email column
            const { data: brandByContact, error: brandContactError } = await supabase
                .from('brands')
                .select('contact_email')
                .ilike('contact_email', email)
                .maybeSingle();
            
            // Check email column if not found in contact_email
            let brandExists = !!brandByContact;
            let brandError = brandContactError;
            if (!brandByContact && !brandContactError) {
                const { data: brandByEmail, error: brandEmailError } = await supabase
                    .from('brands')
                    .select('email')
                    .ilike('email', email)
                    .maybeSingle();
                brandExists = !!brandByEmail;
                brandError = brandEmailError;
            }

            if ((influencerError || !influencer) && (brandError || !brandExists)) {
                setMessage(lang === 'el' 
                    ? 'Το email που εισάγατε δεν βρέθηκε στη βάση δεδομένων. Παρακαλώ ελέγξτε το email σας ή επικοινωνήστε με την υποστήριξη.' 
                    : 'The email you entered was not found in our database. Please check your email or contact support.');
                setMessageType('error');
                setResetLoading(false);
                return;
            }
        }

        // Email exists, send reset password email using Supabase
        // The email template is configured in Supabase Dashboard with custom Greek content
        const resetLink = `${window.location.origin}/reset-password`;
        
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: resetLink,
        });

        if (resetError) {
            setMessage(txt.reset_error + ' ' + resetError.message);
            setMessageType('error');
            setResetLoading(false);
            return;
        }

        setMessage(txt.reset_email_sent);
        setMessageType('success');
        setShowForgotPassword(false);

        setResetLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-blue-50/15 to-purple-50/15 p-4">
            <div className="bg-white/90 backdrop-blur-xl p-8 md:p-10 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200/50">
                {/* Back to Site Link & Language Toggle */}
                <div className="mb-4 flex items-center justify-between">
                    <a href="/" className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-colors">
                        ← {txt.back}
                    </a>
                    <button 
                        onClick={() => setLang(lang === "el" ? "en" : "el")} 
                        className="text-xs font-medium border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 text-slate-600 transition-colors"
                        aria-label="Toggle language"
                    >
                        {lang === "el" ? "EN" : "EL"}
                    </button>
                </div>
                
                {/* Logo/Brand */}
                <div className="flex items-center justify-center mb-8">
                    <Image 
                      src="/logo.svg" 
                      alt="Influo.gr Logo" 
                      width={180} 
                      height={72} 
                      className="h-14 w-auto"
                      priority
                    />
                </div>
                
                <h2 className="text-3xl font-bold mb-2 text-slate-900 text-center">{txt.title}</h2>
                <p className="text-slate-500 text-center mb-8">{txt.subtitle}</p>
                
                {!showForgotPassword ? (
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">{txt.email_label}</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 !text-black !bg-white transition-all shadow-sm hover:border-slate-300"
                                placeholder={txt.email_placeholder}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">{txt.password_label}</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"} 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 pr-12 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 !text-black !bg-white transition-all shadow-sm hover:border-slate-300"
                                    placeholder={txt.password_placeholder}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors focus:outline-none"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowForgotPassword(true)}
                                className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                            >
                                {txt.forgot_password}
                            </button>
                        </div>

                        {message && (
                            <div className={`px-4 py-3 rounded-xl text-sm font-medium ${
                                messageType === 'error' 
                                    ? 'bg-red-50 border-2 border-red-200 text-red-700' 
                                    : 'bg-green-50 border-2 border-green-200 text-green-700'
                            }`}>
                                {message}
                            </div>
                        )}
                        
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all transform hover:-translate-y-0.5"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    {txt.logging_in}
                                </span>
                            ) : txt.login_button}
                        </button>
                        
                        <p className="text-xs text-slate-500 text-center pt-2">
                            {txt.footer_note}
                        </p>
                    </form>
                ) : (
                    <form onSubmit={handleForgotPassword} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">{txt.email_label}</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 !text-black !bg-white transition-all shadow-sm hover:border-slate-300"
                                placeholder={txt.email_placeholder}
                            />
                            <p className="text-xs text-slate-500 mt-2">
                                {lang === 'el' 
                                    ? 'Θα σας στείλουμε email με οδηγίες για επαναφορά του κωδικού σας.' 
                                    : 'We will send you an email with instructions to reset your password.'}
                            </p>
                        </div>

                        {message && (
                            <div className={`px-4 py-3 rounded-xl text-sm font-medium ${
                                messageType === 'error' 
                                    ? 'bg-red-50 border-2 border-red-200 text-red-700' 
                                    : 'bg-green-50 border-2 border-green-200 text-green-700'
                            }`}>
                                {message}
                            </div>
                        )}
                        
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowForgotPassword(false);
                                    setMessage('');
                                }}
                                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3.5 rounded-xl transition-all"
                            >
                                {lang === 'el' ? 'Ακύρωση' : 'Cancel'}
                            </button>
                            <button
                                type="submit"
                                disabled={resetLoading}
                                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all"
                            >
                                {resetLoading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        {lang === 'el' ? 'Αποστολή...' : 'Sending...'}
                                    </span>
                                ) : (lang === 'el' ? 'Αποστολή Email' : 'Send Email')}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}