// app/admin/page.tsx
// SERVER COMPONENT

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import AdminDashboardContent from '@/components/AdminDashboardContent';

// [!!!] ΒΑΛΕ ΤΟ ADMIN EMAIL ΣΟΥ ΕΔΩ
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nd.6@hotmail.com';


async function getAdminStatus() {
    const supabase = createSupabaseServerClient();
    
    // 1. Έλεγχος αν ο χρήστης είναι συνδεδεμένος
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        // Αν δεν είναι συνδεδεμένος, τον στέλνουμε στο login
        redirect('/login');
    }

    // 2. Έλεγχος Admin Role από τον πίνακα user_roles
    const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('id', user.id)
        .single();
    
    // 3. DEBUGGING & ΕΛΕΓΧΟΣ:
    // Αν υπάρχει error στη βάση ή το role δεν είναι 'admin'
    if (roleError || roleData?.role !== 'admin') {
        // Fallback check: Αν το email είναι το Admin Email
        if (user.email === ADMIN_EMAIL) {
            return user.email; // Επιτρέπουμε με Admin Email (Fallback)
        }
        
        // Αν δεν είναι ούτε Admin, ούτε το Admin Email, τον πετάμε στο dashboard
        redirect('/dashboard?error=unauthorized'); 
    }

    return user.email; // Επιτρέπουμε
}


export default async function AdminPage() {
    // ΕΔΩ ΕΚΤΕΛΕΙΤΑΙ ΤΟ REDIRECT
    const adminEmail = await getAdminStatus(); 
    
    return <AdminDashboardContent adminEmail={adminEmail} />;
}