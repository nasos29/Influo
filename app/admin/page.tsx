// app/admin/page.tsx
"use client"; // <-- ΤΟ ΚΑΝΟΥΜΕ CLIENT COMPONENT ΞΑΝΑ

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { redirect } from "next/navigation";
import AdminDashboardContent from "@/components/AdminDashboardContent";
import { useRouter } from "next/navigation";

// [!!!] ΒΑΛΕ ΤΟ ADMIN EMAIL ΣΟΥ ΕΔΩ
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nd.6@hotmail.com';


export default function AdminPage() {
    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        async function checkAuth() {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
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
                router.replace('/dashboard?error=unauthorized');
            } else {
                setUserRole(roleData?.role || (user.email === ADMIN_EMAIL ? 'admin' : 'influencer'));
            }

            setLoading(false);
        }
        checkAuth();
    }, [router]);

    if (loading || !userRole) {
        return <div className="min-h-screen flex items-center justify-center">Loading Admin Panel...</div>;
    }
    
    // Εμφανίζουμε το Admin Content ΜΟΝΟ αν είναι Admin
    if (userRole === 'admin') {
        // Χρειάζεται να ενημερώσεις την AdminDashboardContent για να μην παίρνει adminEmail (αφαίρεσε το prop)
        // Για τώρα το κρατάμε για να μη σπάσει η AdminDashboardContent.tsx
        return <AdminDashboardContent adminEmail={ADMIN_EMAIL} />; 
    }
    
    // Fallback (δεν θα έπρεπε να φτάσει εδώ)
    return <div className="min-h-screen p-8">Unauthorized Access.</div>;
}