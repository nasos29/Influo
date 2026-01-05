// app/admin/support/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import SupportHelpDesk from '@/components/SupportHelpDesk';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nd.6@hotmail.com';

export default function SupportPage() {
    const [userRole, setUserRole] = useState<'admin' | 'guest' | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        async function checkAuth() {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.replace('/login');
                return;
            }

            // Check if admin
            const userEmail = user.email?.toLowerCase().trim();
            const adminEmail = ADMIN_EMAIL.toLowerCase().trim();
            
            if (userEmail !== adminEmail) {
                router.replace('/dashboard?error=unauthorized');
            } else {
                setUserRole('admin');
            }

            setLoading(false);
        }
        checkAuth();
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-xl text-gray-600">Loading Support Desk...</div>
            </div>
        );
    }
    
    if (userRole !== 'admin') {
        return null; // Will redirect
    }
    
    return <SupportHelpDesk adminEmail={ADMIN_EMAIL} />;
}

