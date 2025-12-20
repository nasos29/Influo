// app/dashboard/page.tsx
"use client"; // <--- ΤΟ ΚΑΝΟΥΜΕ CLIENT COMPONENT

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; 
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// [!!!] ΒΑΛΕ ΤΟ ADMIN EMAIL ΣΟΥ ΕΔΩ
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nd.6@hotmail.com';


export default function DashboardPage() {
    const router = useRouter();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function checkAuthAndLoadProfile() {
            // 1. Έλεγχος Auth
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.replace('/login');
                return;
            }

            // 2. ΕΛΕΓΧΟΣ ADMIN (Client Side)
            if (user.email === ADMIN_EMAIL) {
                router.replace('/admin'); // Redirect Admin
                return;
            }

            // 3. Load Profile (Μόνο για Influencer)
            const { data: profileData } = await supabase
                .from('influencers')
                .select('display_name, location, contact_email, verified, min_rate')
                .eq('contact_email', user.email)
                .single();
            
            if (!profileData) {
                 setProfile({ display_name: 'User', location: 'N/A', verified: false, min_rate: 'N/A' });
            } else {
                 setProfile(profileData);
            }

            setLoading(false);
        }
        checkAuthAndLoadProfile();
    }, [router]);

    if (loading || !profile) {
        return <div className="min-h-screen flex items-center justify-center">Loading Dashboard...</div>;
    }
    
    // 4. Εμφάνιση Dashboard
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