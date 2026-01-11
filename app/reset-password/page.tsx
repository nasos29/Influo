// app/reset-password/page.tsx
"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStoredLanguage, setStoredLanguage } from '@/lib/language';

const t = {
  el: {
    title: "Επαναφορά Κωδικού",
    subtitle: "Εισάγετε τον νέο κωδικό πρόσβασής σας",
    new_password_label: "Νέος Κωδικός Πρόσβασης",
    new_password_placeholder: "••••••••",
    confirm_password_label: "Επιβεβαίωση Κωδικού",
    confirm_password_placeholder: "••••••••",
    reset_button: "Επαναφορά Κωδικού",
    resetting: "Επαναφορά...",
    back_to_login: "Πίσω στην Σύνδεση",
    success_message: "Ο κωδικός πρόσβασης ενημερώθηκε επιτυχώς! Ανακατεύθυνση...",
    error_message: "Σφάλμα:",
    passwords_no_match: "Οι κωδικοί δεν ταιριάζουν",
    password_too_short: "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες",
    invalid_link: "Ο σύνδεσμος επαναφοράς δεν είναι έγκυρος ή έχει λήξει. Παρακαλώ ζητήστε ένα νέο σύνδεσμο.",
    loading: "Φόρτωση...",
  },
  en: {
    title: "Reset Password",
    subtitle: "Enter your new password",
    new_password_label: "New Password",
    new_password_placeholder: "••••••••",
    confirm_password_label: "Confirm Password",
    confirm_password_placeholder: "••••••••",
    reset_button: "Reset Password",
    resetting: "Resetting...",
    back_to_login: "Back to Login",
    success_message: "Password updated successfully! Redirecting...",
    error_message: "Error:",
    passwords_no_match: "Passwords do not match",
    password_too_short: "Password must be at least 6 characters",
    invalid_link: "The reset link is invalid or has expired. Please request a new link.",
    loading: "Loading...",
  }
};

export default function ResetPasswordPage() {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState<'error' | 'success'>('error');
    const [lang, setLang] = useState<'el' | 'en'>(getStoredLanguage());
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [validating, setValidating] = useState(true);
    const router = useRouter();
    const txt = t[lang];

    useEffect(() => {
        // Check if we have a valid session from the reset link
        async function validateResetLink() {
            try {
                // Supabase password reset links contain hash fragments with access_token
                // First, check if we already have a valid session
                const { data: { session: existingSession } } = await supabase.auth.getSession();
                
                if (existingSession) {
                    // Already have a session, validate it
                    setValidating(false);
                    return;
                }

                // Try to get session from hash fragments in the URL
                const hash = window.location.hash;
                if (!hash) {
                    setMessage(txt.invalid_link);
                    setMessageType('error');
                    setValidating(false);
                    return;
                }

                // Parse hash fragments (e.g., #access_token=xxx&type=recovery&refresh_token=yyy)
                const params = new URLSearchParams(hash.substring(1));
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');
                const type = params.get('type');

                if (!accessToken || !refreshToken || type !== 'recovery') {
                    setMessage(txt.invalid_link);
                    setMessageType('error');
                    setValidating(false);
                    return;
                }

                // Set the session using the tokens from the URL
                const { error: sessionError } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });

                if (sessionError) {
                    console.error('Error setting session:', sessionError);
                    setMessage(txt.invalid_link);
                    setMessageType('error');
                    setValidating(false);
                    return;
                }

                // Verify we have a valid session now
                const { data: { session: newSession } } = await supabase.auth.getSession();
                if (!newSession) {
                    setMessage(txt.invalid_link);
                    setMessageType('error');
                    setValidating(false);
                    return;
                }

                // Clear the hash from URL for security
                window.history.replaceState(null, '', window.location.pathname);

                setValidating(false);
            } catch (error: any) {
                console.error('Error validating reset link:', error);
                setMessage(txt.invalid_link);
                setMessageType('error');
                setValidating(false);
            }
        }

        validateResetLink();
    }, [txt.invalid_link]);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        
        // Validation
        if (newPassword !== confirmPassword) {
            setMessage(txt.passwords_no_match);
            setMessageType('error');
            return;
        }

        if (newPassword.length < 6) {
            setMessage(txt.password_too_short);
            setMessageType('error');
            return;
        }

        setLoading(true);

        try {
            // Update password using Supabase auth
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) {
                setMessage(txt.error_message + ' ' + error.message);
                setMessageType('error');
                setLoading(false);
                return;
            }

            // Success - show message and redirect
            setMessage(txt.success_message);
            setMessageType('success');
            
            // Redirect to login after 2 seconds
            setTimeout(() => {
                router.push('/login');
            }, 2000);

        } catch (error: any) {
            setMessage(txt.error_message + ' ' + (error.message || 'An unexpected error occurred'));
            setMessageType('error');
            setLoading(false);
        }
    };

    if (validating) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-slate-600">{txt.loading}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                {/* Logo and Title */}
                <div className="text-center">
                    <Link href="/" className="inline-block mb-6">
                        <Image
                            src="/logo-icon.svg"
                            alt="Influo Logo"
                            width={80}
                            height={80}
                            className="mx-auto"
                        />
                    </Link>
                    <h2 className="text-3xl font-bold text-slate-800">{txt.title}</h2>
                    <p className="mt-2 text-sm text-slate-600">{txt.subtitle}</p>
                </div>

                {/* Language Toggle */}
                <div className="flex justify-center gap-2">
                    <button
                        onClick={() => {
                            setLang('el');
                            setStoredLanguage('el');
                        }}
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${
                            lang === 'el'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        ΕΛ
                    </button>
                    <button
                        onClick={() => {
                            setLang('en');
                            setStoredLanguage('en');
                        }}
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${
                            lang === 'en'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        EN
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleResetPassword} className="mt-8 space-y-6 bg-white p-8 rounded-2xl shadow-xl">
                    {/* Message Display */}
                    {message && (
                        <div className={`p-4 rounded-lg ${
                            messageType === 'success'
                                ? 'bg-green-50 text-green-800 border border-green-200'
                                : 'bg-red-50 text-red-800 border border-red-200'
                        }`}>
                            {message}
                        </div>
                    )}

                    {/* New Password */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            {txt.new_password_label}
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 pr-12 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 !text-black !bg-white transition-all shadow-sm hover:border-slate-300"
                                placeholder={txt.new_password_placeholder}
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

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            {txt.confirm_password_label}
                        </label>
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 pr-12 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 !text-black !bg-white transition-all shadow-sm hover:border-slate-300"
                                placeholder={txt.confirm_password_placeholder}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors focus:outline-none"
                                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                            >
                                {showConfirmPassword ? (
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

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-xl font-semibold shadow-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? txt.resetting : txt.reset_button}
                    </button>

                    {/* Back to Login */}
                    <div className="text-center">
                        <Link
                            href="/login"
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                        >
                            {txt.back_to_login}
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}

