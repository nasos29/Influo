// app/login/page.tsx
"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; // Ο client σου

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        // 1. Έλεγχος αν υπάρχει ήδη ο χρήστης
        const { data: userData } = await supabase
            .from('influencers')
            .select('id')
            .eq('contact_email', email)
            .maybeSingle();

        if (!userData) {
            setMessage("Αυτό το email δεν είναι καταχωρημένο ως Influencer ή Admin.");
            setLoading(false);
            return;
        }

        // 2. Αποστολή Magic Link
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                // FIX: ΟΡΙΣΤΙΚΟ URL του site σου
                emailRedirectTo: 'https://www.influo.gr/dashboard', 
            },
        });

        if (error) {
            setMessage(error.message);
        } else {
            setSent(true);
        }
        setLoading(false);
    };

    if (sent) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
                <h1 className="text-3xl font-bold text-slate-900 mb-4">Magic Link Sent! 📧</h1>
                <p className="text-slate-600 max-w-sm">
                    Ένα link σύνδεσης στάλθηκε στο <strong>{email}</strong>. Παρακαλώ έλεγξε τα εισερχόμενά σου (και τα Spam).
                </p>
                <a href="/" className="mt-6 text-blue-600 hover:underline">← Πίσω στην αρχική</a>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100">
            <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6 text-slate-900">Sign In (Magic Link)</h1>
                <form onSubmit={handleLogin} className="space-y-4">
                    <label className="block text-sm font-medium text-slate-700">Email Address</label>
                    // app/login/page.tsx - μέσα στο return()
<input
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    required
    // FIX: Προσθέτουμε !text-black και !bg-white
    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 !text-black !bg-white"
    placeholder="your@email.com"
/>
                    {message && <p className="text-red-500 text-sm">{message}</p>}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg disabled:opacity-50"
                    >
                        {loading ? 'Sending...' : 'Send Magic Link'}
                    </button>
                    <p className="text-xs text-slate-500 text-center pt-2">
                        Για Influencers και Admins.
                    </p>
                </form>
            </div>
        </div>
    );
}