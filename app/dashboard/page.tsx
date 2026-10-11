// app/dashboard/page.tsx
"use client"; 

import { Suspense, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; 
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardContent from '@/components/DashboardContent';
import { loadOwnProfiles } from '@/lib/ownProfile'; 

// [!!!] ΒΑΛΕ ΤΟ ADMIN EMAIL ΣΟΥ ΕΔΩ
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nd.6@hotmail.com';


export default function DashboardPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [profileData, setProfileData] = useState<any>(null);
    const [orphanEmail, setOrphanEmail] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [clearingOrphan, setClearingOrphan] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function checkAuthAndLoadProfile() {
            setLoading(true);
            setLoadError(null);
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.replace('/login');
                return;
            }

            if (user.email === ADMIN_EMAIL) {
                router.replace('/admin'); 
                return;
            }

            const profiles = await loadOwnProfiles(supabase);
            if (cancelled) return;

            if (!profiles.ok) {
                setLoadError(profiles.message);
                setProfileData(null);
                setLoading(false);
                return;
            }

            if (!profiles.influencer) {
                if (profiles.brand) {
                    router.replace('/brand/dashboard');
                    return;
                }
                setOrphanEmail(user.email || null);
                setProfileData(null);
                setLoading(false);
                return;
            }

            setProfileData(profiles.influencer);
            setLoading(false);
        }
        checkAuthAndLoadProfile();
        return () => {
            cancelled = true;
        };
    }, [router, attempt]);

    const clearOrphanAndSignup = async () => {
        if (!orphanEmail) return;
        setClearingOrphan(true);
        try {
            await fetch('/api/admin/cleanup-orphaned-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: orphanEmail }),
            });
            await supabase.auth.signOut();
            router.replace('/?signup=influencer');
        } catch {
            await supabase.auth.signOut();
            router.replace('/?signup=influencer');
        } finally {
            setClearingOrphan(false);
        }
    };

    if (loadError) {
        return (
          <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
            <h1 className="text-2xl font-bold text-slate-900">Δεν φορτώθηκε το προφίλ</h1>
            <p className="text-slate-600 mt-3">{loadError}</p>
            <p className="text-slate-500 mt-2 text-sm">
              Ο λογαριασμός δεν διαγράφεται από αυτή την οθόνη.
            </p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="mt-6 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
            >
              Δοκιμάστε ξανά
            </button>
            <Link href="/logout" className="mt-4 text-red-500 hover:underline text-sm">Αποσύνδεση</Link>
          </div>
        );
    }

    if (loading || !profileData) {
        if (!loading && !profileData) {
             return (
               <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
                 <h1 className="text-2xl font-bold text-slate-900">Profile Not Found</h1>
                 <p className="text-slate-600 mt-3">
                   Ο λογαριασμός σου υπάρχει στη σύνδεση, αλλά το προφίλ influencer δεν ολοκληρώθηκε
                   (π.χ. διακοπή κατά την εγγραφή). Μπορείς να καθαρίσεις τον λογαριασμό και να ξανακάνεις εγγραφή.
                 </p>
                 <button
                   type="button"
                   onClick={clearOrphanAndSignup}
                   disabled={clearingOrphan}
                   className="mt-6 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
                 >
                   {clearingOrphan ? '…' : 'Καθαρισμός & νέα εγγραφή'}
                 </button>
                 <Link href="/logout" className="mt-4 text-red-500 hover:underline text-sm">Sign Out</Link>
               </div>
             );
        }
        return <div className="min-h-screen flex items-center justify-center">Loading Dashboard...</div>;
    }
    
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">Loading…</div>}>
            <DashboardContent profile={profileData} />
        </Suspense>
    );
}
