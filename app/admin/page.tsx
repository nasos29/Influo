// app/admin/page.tsx
// SERVER COMPONENT

import { createSupabaseServerClient } from '../../lib/supabase-server'; // ΔΙΟΡΘΩΣΗ PATH
import { redirect } from 'next/navigation';
import AdminDashboardContent from '@/components/AdminDashboardContent'; 

// [!!!] ΒΑΛΕ ΤΟ ADMIN EMAIL ΣΟΥ ΕΔΩ
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nd.6@hotmail.com';


async function getAdminStatus() {
    const supabase = createSupabaseServerClient();
    
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }
    
    if (!user.email) {
        redirect('/login?error=noemail');
    }
    
    // 1. Έλεγχος Admin Role (ΠΙΟ ΑΝΘΕΚΤΙΚΟΣ ΕΛΕΓΧΟΣ)
    // Χρησιμοποιούμε maybeSingle() για να μην σκάσει αν ο χρήστης δεν υπάρχει στον πίνακα roles
    const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle(); // <-- ΤΟ FIX ΕΙΝΑΙ ΕΔΩ

    
    // 2. Ελέγχουμε: Αν δεν έχει role 'admin' ΚΑΙ το email δεν είναι το Admin Email (Fallback)
    if (roleData?.role !== 'admin' && user.email !== ADMIN_EMAIL) {
        redirect('/dashboard?error=unauthorized'); 
    }

    return user.email as string; // Επιστρέφουμε το email (τώρα είναι σίγουρα string)
}


export default async function AdminPage() {
    // ΕΔΩ ΕΚΤΕΛΕΙΤΑΙ ΤΟ REDIRECT
    const adminEmail = await getAdminStatus(); 
    
    return <AdminDashboardContent adminEmail={adminEmail} />;
}