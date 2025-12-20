// app/admin/check-auth.tsx
"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; // ή '../lib/supabaseClient'
import AdminDashboardContent from '@/components/AdminDashboardContent'; // ή '../components/AdminDashboardContent'
import { useRouter } from 'next/navigation';

// [!!!] ΒΑΛΕ ΤΟ ADMIN EMAIL ΣΟΥ ΕΔΩ
const ADMIN_EMAIL = 'nd.6@hotmail.com';


export default function AdminAuthWrapper() {
    const [userRole, setUserRole] = useState<'admin' | 'influencer' | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        async function checkAuth() {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                // Not logged in: Redirect to login
                router.replace('/login');
                return;
            }

            // 1. Έλεγχος Admin Role
            const { data: roleData } = await supabase
                .from('user_roles')
                .select('role')
                .eq('id', user.id)
                .maybeSingle();

            // 2. Έλεγχος: Αν δεν έχει role 'admin' ΚΑΙ το email δεν είναι το Admin Email
            if (roleData?.role !== 'admin' && user.email !== ADMIN_EMAIL) {
                // Not Admin: Send to Dashboard
                router.replace('/dashboard?error=unauthorized');
            } else {
                // Is Admin: Set Role
                setUserRole('admin');
            }
            setLoading(false);
        }
        checkAuth();
    }, [router]);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center text-xl">Loading Admin Access...</div>;
    }
    
    // Εμφάνιση του Dashboard ΜΟΝΟ αν είναι Admin
    if (userRole === 'admin') {
        return <AdminDashboardContent adminEmail={ADMIN_EMAIL} />; 
    }
    
    // Εάν δεν είναι Admin (θα έχει γίνει ήδη redirect, αλλά για ασφάλεια)
    return <div className="min-h-screen flex items-center justify-center text-red-500">Access Denied.</div>;
}