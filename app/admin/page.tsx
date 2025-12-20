// app/admin/page.tsx
"use client"; 

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; 
import { useRouter } from 'next/navigation';
import AdminDashboardContent from '@/components/AdminDashboardContent';


// [!!!] ΒΑΛΕ ΤΟ ADMIN EMAIL ΣΟΥ ΕΔΩ
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nd.6@hotmail.com';


export default function AdminPage() {
    // FIX: ΟΡΙΖΟΥΜΕ ΣΩΣΤΑ ΤΟΝ ΤΥΠΟ ΤΟΥ ROLE
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
                // Εδώ, δεν χρειαζόμαστε το role check, καθώς το email είναι το hard-redirect.
                router.replace('/dashboard?error=unauthorized');
            } else {
                setUserRole('admin'); // Τώρα το 'admin' είναι αποδεκτός τύπος
            }

            setLoading(false);
        }
        checkAuth();
    }, [router]);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">Loading Admin Panel...</div>;
    }
    
    // Εμφάνιση του Admin Content ΜΟΝΟ αν ο έλεγχος πέτυχε
    if (userRole === 'admin') {
        return <AdminDashboardContent adminEmail={ADMIN_EMAIL} />; 
    }
    
    // Εάν δεν είναι Admin (θα έχει γίνει ήδη redirect, αλλά για ασφάλεια)
    return <div className="min-h-screen p-8 text-red-500 text-center">Access Denied. Redirecting...</div>;
}