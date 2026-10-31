// app/dashboard/page.tsx
"use client"; 

import { Suspense, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; 
import { useRouter } from 'next/navigation';
import DashboardContent from '@/components/DashboardContent';
import { loadOwnProfiles } from '@/lib/ownProfile';
import { logoutEverywhere, lookupAuthUser } from '@/lib/authSession';
import { getStoredLanguage } from '@/lib/language';
import { isTimeoutError, withTimeout } from '@/lib/withTimeout'; 

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
    const [lang, setLang] = useState<'el' | 'en'>('el');

    useEffect(() => {
        let cancelled = false;
        setLang(getStoredLanguage());
        const uiLang = getStoredLanguage();
        async function checkAuthAndLoadProfile() {
            setLoading(true);
            setLoadError(null);
            try {
            await withTimeout((async () => {
            const auth = await lookupAuthUser(8000);

            if (!auth.user) {
                if (auth.timedOut) {
                    setLoadError(uiLang === 'en' ? 'Sign-in took too long. Try again.' : 'Η σύνδεση άργησε να απαντήσει. Δοκίμασε ξανά.');
                    setLoading(false);
                    return;
                }
                router.replace('/login');
                return;
            }
            const user = auth.user;

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
            })(), 20000);
            } catch (error) {
                if (cancelled) return;
                setLoadError(
                    isTimeoutError(error)
                        ? uiLang === 'en'
                            ? 'This took too long. Try again.'
                            : 'Η φόρτωση άργησε. Δοκίμασε ξανά.'
                        : uiLang === 'en'
                            ? 'The profile could not be loaded.'
                            : 'Δεν φορτώθηκε το προφίλ.'
                );
                setLoading(false);
            }
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
            await fetch('/api/auth/cleanup-orphaned', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: orphanEmail }),
            });
            logoutEverywhere('/?signup=influencer');
        } catch {
            logoutEverywhere('/?signup=influencer');
        } finally {
            setClearingOrphan(false);
        }
    };

    if (loadError) {
        return (
          <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
            <h1 className="text-2xl font-bold text-slate-900">{lang === 'en' ? 'Profile could not be loaded' : 'Δεν φορτώθηκε το προφίλ'}</h1>
            <p className="text-slate-600 mt-3">{loadError}</p>
            <p className="text-slate-500 mt-2 text-sm">
              {lang === 'en' ? 'This screen does not delete the account.' : 'Ο λογαριασμός δεν διαγράφεται από αυτή την οθόνη.'}
            </p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="mt-6 inline-flex min-h-11 items-center px-5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
            >
              {lang === 'en' ? 'Try again' : 'Δοκίμασε ξανά'}
            </button>
            <button type="button" onClick={() => logoutEverywhere("/login")} className="mt-4 inline-flex min-h-11 items-center text-red-500 hover:underline text-sm">{lang === 'en' ? 'Log out' : 'Αποσύνδεση'}</button>
          </div>
        );
    }

    if (loading || !profileData) {
        if (!loading && !profileData) {
             return (
               <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
                 <h1 className="text-2xl font-bold text-slate-900">{lang === 'en' ? 'Profile was not found' : 'Δεν βρέθηκε προφίλ'}</h1>
                 <p className="text-slate-600 mt-3">
                   {lang === 'en'
                     ? 'Your sign-in exists, but the creator profile was not finished (for example the signup was interrupted). You can clear the account and sign up again.'
                     : 'Ο λογαριασμός σου υπάρχει στη σύνδεση, αλλά το προφίλ δημιουργού δεν ολοκληρώθηκε (π.χ. διακοπή κατά την εγγραφή). Μπορείς να καθαρίσεις τον λογαριασμό και να ξανακάνεις εγγραφή.'}
                 </p>
                 <button
                   type="button"
                   onClick={clearOrphanAndSignup}
                   disabled={clearingOrphan}
                   className="mt-6 inline-flex min-h-11 items-center px-5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
                 >
                   {clearingOrphan ? '…' : lang === 'en' ? 'Clear and sign up again' : 'Καθαρισμός και νέα εγγραφή'}
                 </button>
                 <button type="button" onClick={() => logoutEverywhere("/login")} className="mt-4 inline-flex min-h-11 items-center text-red-500 hover:underline text-sm">{lang === 'en' ? 'Log out' : 'Αποσύνδεση'}</button>
               </div>
             );
        }
        return (
            <div className="min-h-screen bg-slate-50">
                <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
                    <div className="h-10 w-56 bg-slate-200 rounded animate-pulse" />
                    <div className="h-40 bg-white border border-slate-200 rounded-xl animate-pulse" />
                    <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
                </div>
            </div>
        );
    }
    
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50">
                <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
                    <div className="h-10 w-56 bg-slate-200 rounded animate-pulse" />
                    <div className="h-40 bg-white border border-slate-200 rounded-xl animate-pulse" />
                </div>
            </div>
        }>
            <DashboardContent profile={profileData} />
        </Suspense>
    );
}
