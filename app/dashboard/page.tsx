// app/dashboard/page.tsx
// SERVER COMPONENT

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

// [!!!] ΒΑΛΕ ΤΟ ADMIN EMAIL ΣΟΥ ΕΔΩ (ΠΡΕΠΕΙ ΝΑ ΕΙΝΑΙ ΣΤΟ .env)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nd.6@hotmail.com';


export default async function DashboardPage() {
    // 1. Δημιουργία Supabase Client (Server)
    // Πρέπει να χρησιμοποιούμε το createSupabaseServerClient για SSR
    const supabase = createSupabaseServerClient();
    
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }
    
    // --- 2. FIX: ADMIN REDIRECT ---
    if (user.email === ADMIN_EMAIL) {
        // Αν το email είναι το Admin email, τον στέλνουμε στο Admin Panel
        redirect('/admin');
    }
    // ----------------------------


    // 3. Βρες το Profile του Influencer (Μόνο για μη-Admin)
    const { data: profile, error } = await supabase
        .from('influencers')
        .select('display_name, location, contact_email, verified, min_rate')
        .eq('contact_email', user.email)
        .single();
    
    if (!profile) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-slate-50">
                <h1 className="text-3xl font-bold pt-16 text-slate-900">Profile Incomplete</h1>
                <p className="text-slate-600 max-w-sm text-center">
                    Το email σου είναι συνδεδεμένο, αλλά δεν βρέθηκε Influencer profile. 
                    Παρακαλώ εγγράψου πρώτα.
                </p>
                <Link href="/" className="mt-4 text-blue-600 hover:underline">Go to Sign Up</Link>
                <Link href="/logout" className="mt-2 text-red-500 hover:underline">Sign Out</Link>
            </div>
        );
    }

    // 4. Εμφάνιση του Dashboard 
    return (
        <div className="min-h-screen p-8 bg-slate-100">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-extrabold text-slate-900 mb-8">
                    Welcome back, {profile.display_name}!
                </h1>
                
                <div className="bg-white p-8 rounded-xl shadow-xl space-y-6">
                    <h2 className="text-2xl font-bold border-b pb-2">Your Profile Overview</h2>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="p-3 bg-slate-50 rounded">
                            <span className="block text-slate-500 text-xs uppercase">Status</span>
                            <span className={`font-bold ${profile.verified ? 'text-green-600' : 'text-yellow-600'}`}>
                                {profile.verified ? '✅ VERIFIED & LIVE' : '⏳ PENDING REVIEW'}
                            </span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded">
                            <span className="block text-slate-500 text-xs uppercase">Min Rate</span>
                            <span className="font-bold">{profile.min_rate || 'N/A'}€</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded">
                            <span className="block text-slate-500 text-xs uppercase">Location</span>
                            <span className="font-bold">{profile.location || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div className="pt-4 border-t">
                        <Link href="/logout" className="mt-6 inline-block bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600">
                            Sign Out
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}