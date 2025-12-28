"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

const t = {
  el: {
    title: "Σύνδεση Επιχείρησης",
    subtitle: "Συνδεθείτε στον λογαριασμό σας",
    email_label: "Email",
    email_placeholder: "epixeirisi@example.com",
    password_label: "Κωδικός",
    password_placeholder: "••••••••",
    login_button: "Σύνδεση",
    logging_in: "Σύνδεση...",
    back: "← Πίσω",
    no_account: "Δεν έχετε λογαριασμό;",
    signup_link: "Εγγραφείτε εδώ"
  },
  en: {
    title: "Company Login",
    subtitle: "Sign in to your account",
    email_label: "Email",
    email_placeholder: "company@example.com",
    password_label: "Password",
    password_placeholder: "••••••••",
    login_button: "Sign In",
    logging_in: "Signing In...",
    back: "← Back",
    no_account: "Don't have an account?",
    signup_link: "Sign up here"
  }
};

export default function BrandLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [lang, setLang] = useState<'el' | 'en'>('el');
  const router = useRouter();
  const txt = t[lang];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      let translatedMessage = error.message;
      if (error.message === 'Invalid login credentials' || 
          error.message.toLowerCase().includes('invalid login credentials')) {
        translatedMessage = lang === 'el' 
          ? 'Μη έγκυρα στοιχεία σύνδεσης' 
          : 'Invalid login credentials';
      }
      setMessage(translatedMessage);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setMessage(lang === 'el' 
        ? 'Σφάλμα: Δεν μπόρεσε να γίνει σύνδεση' 
        : 'Error: Could not sign in');
      setLoading(false);
      return;
    }

      // Check if user is a brand
      const { data: brandData } = await supabase
        .from('brands')
        .select('id')
        .eq('id', data.user.id)
        .single();

      if (!brandData) {
        // User exists but is not a brand
        await supabase.auth.signOut();
        setMessage(lang === 'el' 
          ? 'Αυτός ο λογαριασμός δεν είναι επιχείρηση. Παρακαλώ χρησιμοποιήστε τη σελίδα σύνδεσης influencer.' 
          : 'This account is not a company. Please use the influencer login page.');
        setLoading(false);
        return;
      }

    // Success - redirect to brand dashboard (or redirect param if exists)
    const redirect = new URLSearchParams(window.location.search).get('redirect');
    router.push(redirect === 'dashboard' ? '/brand/dashboard' : '/brand/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <a href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">I</span>
            </div>
            <span className="text-2xl font-bold text-slate-900">Influo</span>
          </a>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => router.back()}
              className="text-slate-600 hover:text-slate-900 transition-colors"
            >
              {txt.back}
            </button>
            <button
              onClick={() => setLang(lang === 'el' ? 'en' : 'el')}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
            >
              {lang === 'el' ? 'EN' : 'ΕΛ'}
            </button>
          </div>

          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{txt.title}</h1>
            <p className="text-slate-600 text-sm">{txt.subtitle}</p>
          </div>

          {message && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
              {message}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {txt.email_label}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={txt.email_placeholder}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {txt.password_label}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={txt.password_placeholder}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              {loading ? txt.logging_in : txt.login_button}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            {txt.no_account}{' '}
            <a href="/brand/signup" className="text-blue-600 hover:text-blue-700 font-medium">
              {txt.signup_link}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

