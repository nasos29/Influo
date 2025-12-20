// app/admin/page.tsx
// ΔΕΝ ΧΡΕΙΑΖΕΤΑΙ "use client"

import { createSupabaseServerClient } from '@/lib/supabase-server';
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
    
    // Ελέγχουμε αν το email υπάρχει (πρέπει να υπάρχει αν ο user υπάρχει, αλλά το τσεκάρουμε)
    if (!user.email) {
        redirect('/login?error=noemail');
    }
    
    // 1. Έλεγχος Admin Role
    const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('id', user.id)
        .single();
    
    // 2. Έλεγχος: Αν δεν έχει role 'admin' ΚΑΙ το email δεν είναι το Admin Email (Fallback)
    if (roleData?.role !== 'admin' && user.email !== ADMIN_EMAIL) {
        redirect('/dashboard?error=unauthorized'); 
    }

    // ΤΩΡΑ ΕΙΝΑΙ ΣΙΓΟΥΡΑ string, αλλά το τσεκάρουμε για να περάσει ο έλεγχος του build
    return user.email as string; // <-- ΤΟ FIX ΕΙΝΑΙ ΕΔΩ (Force Cast)
}


export default async function AdminPage() {
    // ΕΔΩ ΕΚΤΕΛΕΙΤΑΙ ΤΟ REDIRECT
    const adminEmail = await getAdminStatus(); 
    
    // Το adminEmail είναι πλέον σίγουρα string
    return <AdminDashboardContent adminEmail={adminEmail} />;
}