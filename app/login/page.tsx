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
    email_placeholder: "το@email.com",
    password_label: "Κωδικός Πρόσβασης",
    password_placeholder: "••••••••",
    forgot_password: "Ξέχασα τον κωδικό μου",
    login_button: "Σύνδεση",
    logging_in: "Σύνδεση...",
    footer_note: "Για Influencers και Admins.",
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
    footer_note: "For Influencers and Admins.",
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
            setMessage(error.message);
            setMessageType('error');
            setLoading(false);
            return;
        }

        // Admin check by email
        const isAdmin = data.user?.email === 'nd.6@hotmail.com';

        if (isAdmin) {
            router.push('/admin');
        } else {
            router.push('/dashboard');
        }

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

        // Check if email exists in database (influencers or admin)
        const ADMIN_EMAIL = 'nd.6@hotmail.com';
        const isAdmin = email === ADMIN_EMAIL;

        if (!isAdmin) {
            // Check if email exists in influencers table
            const { data: influencer, error: checkError } = await supabase
                .from('influencers')
                .select('contact_email')
                .eq('contact_email', email)
                .single();

            if (checkError || !influencer) {
                setMessage(lang === 'el' 
                    ? 'Το email που εισάγατε δεν βρέθηκε στη βάση δεδομένων. Παρακαλώ ελέγξτε το email σας ή επικοινωνήστε με την υποστήριξη.' 
                    : 'The email you entered was not found in our database. Please check your email or contact support.');
                setMessageType('error');
                setResetLoading(false);
                return;
            }
        }

        // Email exists, send reset password email
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) {
            setMessage(txt.reset_error + ' ' + error.message);
            setMessageType('error');
        } else {
            setMessage(txt.reset_email_sent);
            setMessageType('success');
            setShowForgotPassword(false);
        }

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
                            <input
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 !text-black !bg-white transition-all shadow-sm hover:border-slate-300"
                                placeholder={txt.password_placeholder}
                            />
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