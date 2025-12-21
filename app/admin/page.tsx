// app/admin/page.tsx
"use client"; 

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient'; // Client Auth
import { useRouter } from 'next/navigation';
import AdminDashboardContent from '@/components/AdminDashboardContent'; // <-- Διορθωμένο Path


// [!!!] ΒΑΛΕ ΤΟ ADMIN EMAIL ΣΟΥ ΕΔΩ
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nd.6@hotmail.com';


export default function AdminPage() {
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

            // 1. Έλεγχος: Αν δεν είναι το Admin Email, τον πετάμε έξω!
            if (user.email !== ADMIN_EMAIL) {
                router.replace('/dashboard?error=unauthorized');
            } else {
                setUserRole('admin');
            }

            setLoading(false);
        }
        checkAuth();
    }, [router]);

    if (loading || userRole !== 'admin') {
         // Εμφανίζουμε loading ή ένα απλό μήνυμα αν δεν είναι admin
        return <div className="min-h-screen flex items-center justify-center">Loading Admin Panel...</div>;
    }
    
    // Εμφανίζουμε το Admin Content ΜΟΝΟ αν ο έλεγχος πέτυχε
    return <AdminDashboardContent adminEmail={ADMIN_EMAIL} />; 
}