// app/logout/page.tsx
"use client";

import { useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function LogoutPage() {
    const router = useRouter();

    useEffect(() => {
        async function handleLogout() {
            await supabase.auth.signOut();
            router.replace('/login');
        }
        handleLogout();
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            Logging out...
        </div>
    );
}