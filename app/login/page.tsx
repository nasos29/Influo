// app/login/page.tsx
"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; 
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState(''); 
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const router = useRouter();

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
            setLoading(false);
            return;
        }
        
        // 2. Έλεγχος Role για Redirect
        const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('id', data.user!.id)
            .maybeSingle();

        // [!!!] Hardcoded Admin Check:
        const isAdmin = roleData?.role === 'admin' || data.user?.email === 'nd.6@hotmail.com';

        if (isAdmin) {
            router.push('/admin');
        } else {
            router.push('/dashboard');
        }
        
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100">
            <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6 text-slate-900">Sign In</h1>
                <form onSubmit={handleLogin} className="space-y-4">
                    <label className="block text-sm font-medium text-slate-700">Email Address</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 !text-black !bg-white"
                        placeholder="your@email.com"
                    />

                    <label className="block text-sm font-medium text-slate-700">Password</label>
                    <input
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 !text-black !bg-white"
                        placeholder="••••••••"
                    />

                    {message && <p className="text-red-500 text-sm">{message}</p>}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg disabled:opacity-50"
                    >
                        {loading ? 'Logging In...' : 'Log In'}
                    </button>
                    <p className="text-xs text-slate-500 text-center pt-2">
                        Για Influencers και Admins.
                    </p>
                </form>
            </div>
        </div>
    );
}