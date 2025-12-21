// app/dashboard/page.tsx
"use client"; 

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; 
import { useRouter } from 'next/navigation';
import DashboardContent from '../components/DashboardContent'; // ΝΕΟ COMPONENT

// [!!!] ΒΑΛΕ ΤΟ ADMIN EMAIL ΣΟΥ ΕΔΩ
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nd.6@hotmail.com';


export default function DashboardPage() {
    const router = useRouter();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [profileData, setProfileData] = useState<any>(null); // State για τα δεδομένα

    useEffect(() => {
        async function checkAuthAndLoadProfile() {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.replace('/login');
                return;
            }

            // 1. ΕΛΕΓΧΟΣ ADMIN (Redirect)
            if (user.email === ADMIN_EMAIL) {
                router.replace('/admin'); 
                return;
            }

            // 2. Load Profile (Μόνο για Influencer)
            const { data: profile, error } = await supabase
                .from('influencers')
                .select('*') // Φέρνουμε ΟΛΑ τα δεδομένα για το edit
                .eq('contact_email', user.email)
                .single();
            
            setProfileData(profile);
            setLoading(false);
        }
        checkAuthAndLoadProfile();
    }, [router]);

    if (loading || !profileData) {
        if (!loading && !profileData) {
             return <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center"><h1 className="text-2xl font-bold">Profile Not Found</h1><p className="text-slate-500">Please finish your sign-up or contact admin.</p><Link href="/logout" className="mt-4 text-red-500 hover:underline">Sign Out</Link></div>
        }
        return <div className="min-h-screen flex items-center justify-center">Loading Dashboard...</div>;
    }
    
    // 3. Εμφάνιση Dashboard Content (περνώντας τα δεδομένα)
    return <DashboardContent profile={profileData} />;
}