// app/login/page.tsx
"use client";

import { useState, useEffect, useRef, Suspense } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { loadOwnProfiles } from '@/lib/ownProfile'; 
import { useRouter, useSearchParams } from 'next/navigation';
import { getStoredLanguage, setStoredLanguage } from '@/lib/language';
import { clearLoggedOutMark, clearSupabaseAuthStorage, isLoggedOutMarked } from '@/lib/authSession';
import SignupChoiceModal from '@/components/SignupChoiceModal';

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
    no_account: "Δεν έχετε λογαριασμό;",
    sign_up: "Εγγραφείτε",
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
    no_account: "Don't have an account?",
    sign_up: "Sign up",
    footer_note: "For Influencers, Brands and Admins.",
    back: "Back to Site",
    reset_email_sent: "Password reset email sent. Please check your inbox.",
    reset_error: "Error:",
  }
};

function LoginPageContent() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState(''); 
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState<'error' | 'success'>('error');
    const [lang, setLang] = useState<'el' | 'en'>('el'); // Default to Greek, will be updated in useEffect
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showSignup, setShowSignup] = useState(false);
    const emailRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const submittingRef = useRef(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const txt = t[lang];

    // Load language from localStorage on client-side
    useEffect(() => {
        setLang(getStoredLanguage());
    }, []);

    // Already signed in → go to the right dashboard (avoids showing login while session exists)
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (isLoggedOutMarked()) {
                clearSupabaseAuthStorage();
                void supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
                return;
            }
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || cancelled) return;
            const userEmail = user.email?.toLowerCase().trim();
            const adminEmail = 'nd.6@hotmail.com'.toLowerCase().trim();
            if (userEmail === adminEmail) {
                router.replace('/admin');
                return;
            }
            const profiles = await loadOwnProfiles(supabase);
            if (cancelled) return;
            if (!profiles.ok) {
                setMessage(profiles.message);
                setMessageType('error');
                return;
            }
            if (profiles.brand) {
                router.replace('/brand/dashboard');
                return;
            }
            router.replace('/dashboard');
        })();
        return () => {
            cancelled = true;
        };
    }, [router]);

    // Pre-fill email from URL parameter if provided
    useEffect(() => {
        const emailParam = searchParams?.get('email');
        if (emailParam) {
            setEmail(emailParam);
            if (emailRef.current) emailRef.current.value = emailParam;
        }
    }, [searchParams]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submittingRef.current) return;

        // Read the DOM value. Controlled state stays empty when the browser
        // autofills, and the first click was only committing those credentials.
        const emailValue = (emailRef.current?.value || email).trim();
        const passwordValue = passwordRef.current?.value || password;
        if (emailValue !== email) setEmail(emailValue);
        if (passwordValue !== password) setPassword(passwordValue);

        if (!emailValue || !passwordValue) {
            setMessage(lang === 'el'
                ? 'Συμπλήρωσε email και κωδικό.'
                : 'Enter your email and password.');
            setMessageType('error');
            return;
        }

        submittingRef.current = true;
        setLoading(true);
        setMessage('');

        try {
        // 1. Sign In με Email/Password
        const { data, error } = await supabase.auth.signInWithPassword({
            email: emailValue,
            password: passwordValue,
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
            return;
        }

        clearLoggedOutMark();

        // Check if user exists but login succeeded
        if (!data.user) {
            setMessage(lang === 'el' 
                ? 'Σφάλμα: Δεν μπόρεσε να γίνει σύνδεση. Παρακαλώ δοκιμάστε ξανά.' 
                : 'Error: Could not sign in. Please try again.');
            setMessageType('error');
            return;
        }

        // Admin check by email (case-insensitive and trimmed)
        const userEmail = data.user?.email?.toLowerCase().trim();
        const adminEmail = 'nd.6@hotmail.com'.toLowerCase().trim();
        const isAdmin = userEmail === adminEmail;

        if (isAdmin) {
            router.push('/admin');
            return;
        }

        const redirectParam = searchParams?.get('redirect');
        const profiles = await loadOwnProfiles(supabase);
        if (!profiles.ok) {
            setMessage(profiles.message);
            setMessageType('error');
            return;
        }
        if (profiles.brand) {
            router.push(redirectParam || '/brand/dashboard');
            return;
        }

        const redirectPath = redirectParam || '/dashboard';
        router.push(redirectPath);
        } catch (err) {
            const detail = err instanceof Error ? err.message : '';
            setMessage(lang === 'el'
                ? `Δεν ολοκληρώθηκε η σύνδεση.${detail ? ` ${detail}` : ''}`
                : `Sign-in did not finish.${detail ? ` ${detail}` : ''}`);
            setMessageType('error');
        } finally {
            submittingRef.current = false;
            setLoading(false);
        }
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
            // Match server forgot-password: contact_email only (no brands.email — column may not exist → 400).
            const checkRes = await fetch('/api/check-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const checkBody = await checkRes.json().catch(() => ({}));

            if (!checkRes.ok || !checkBody.exists) {
                setMessage(lang === 'el' 
                    ? 'Το email που εισάγατε δεν βρέθηκε στη βάση δεδομένων. Παρακαλώ ελέγξτε το email σας ή επικοινωνήστε με την υποστήριξη.' 
                    : 'The email you entered was not found in our database. Please check your email or contact support.');
                setMessageType('error');
                setResetLoading(false);
                return;
            }
        }

        // Branded reset email via Resend (same verification link as Supabase recovery)
        const resetRes = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, lang }),
        });
        const resetJson = await resetRes.json().catch(() => ({}));

        if (!resetRes.ok || !resetJson.success) {
            const errMsg =
                typeof resetJson.error === 'string' && resetJson.error
                    ? resetJson.error
                    : txt.reset_error + ' ' + (resetRes.statusText || '');
            setMessage(errMsg);
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
                        onClick={() => {
                            const newLang = lang === "el" ? "en" : "el";
                            setLang(newLang);
                            setStoredLanguage(newLang);
                        }} 
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
                                ref={emailRef}
                                name="email"
                                type="email"
                                autoComplete="username"
                                defaultValue={email}
                                onInput={(e) => {
                                    setEmail(e.currentTarget.value);
                                    if (messageType === 'error') setMessage('');
                                }}
                                required
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 !text-black !bg-white transition-all shadow-sm hover:border-slate-300"
                                placeholder={txt.email_placeholder}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">{txt.password_label}</label>
                            <div className="relative">
                                <input
                                    ref={passwordRef}
                                    name="password"
                                    autoComplete="current-password"
                                    type={showPassword ? "text" : "password"}
                                    defaultValue={password}
                                    onInput={(e) => {
                                        setPassword(e.currentTarget.value);
                                        if (messageType === 'error') setMessage('');
                                    }}
                                    required
                                    className="w-full px-4 py-3 pr-12 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 !text-black !bg-white transition-all shadow-sm hover:border-slate-300"
                                    placeholder={txt.password_placeholder}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex min-h-11 min-w-11 items-center justify-center text-slate-500 hover:text-slate-700 transition-colors focus:outline-none"
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
                                onClick={() => {
                                    setEmail(emailRef.current?.value || email);
                                    setShowForgotPassword(true);
                                }}
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
                            onMouseDown={(event) => {
                                if (event.button !== 0 || loading) return;
                                // Password managers dismiss on the first click and never submit.
                                event.preventDefault();
                                event.currentTarget.form?.requestSubmit();
                            }}
                            className="w-full min-h-11 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-colors"
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

                        <p className="text-center text-sm leading-6 text-slate-600">
                            {txt.no_account}{" "}
                            <button
                                type="button"
                                onClick={() => setShowSignup(true)}
                                className="inline-flex min-h-11 items-center font-semibold text-blue-600 underline decoration-blue-600/30 underline-offset-2 hover:text-blue-800"
                            >
                                {txt.sign_up}
                            </button>
                        </p>
                        
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
                                className="flex-1 min-h-11 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-colors"
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
            <SignupChoiceModal open={showSignup} onClose={() => setShowSignup(false)} lang={lang} />
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-blue-50/15 to-purple-50/15">
                <div className="text-slate-600">Loading...</div>
            </div>
        }>
            <LoginPageContent />
        </Suspense>
    );
}