// app/admin/page.tsx
// ΔΕΝ ΧΡΕΙΑΖΕΤΑΙ "use client" - ΕΙΝΑΙ SERVER COMPONENT

import { createSupabaseServerClient } from '../../lib/supabase-server'; // Διορθωμένο path
import { redirect } from 'next/navigation';
import AdminDashboardContent from '@/components/AdminDashboardContent'; // Υποθέτω ότι έχεις alias '@/components'

// [!!!] ΒΑΛΕ ΤΟ ADMIN EMAIL ΣΟΥ ΕΔΩ ΓΙΑ ΛΟΓΟΥΣ ΑΣΦΑΛΕΙΑΣ
// Χρησιμοποιείται ως fallback αν το role check αποτύχει
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nd.6@hotmail.com';


// Συνάρτηση που κάνει τον έλεγχο ασφαλείας
async function getAdminStatus() {
    // Δημιουργία Supabase Client που μπορεί να διαβάσει τα cookies
    const supabase = createSupabaseServerClient();
    
    // 1. Έλεγχος αν ο χρήστης είναι συνδεδεμένος
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        // Αν δεν είναι συνδεδεμένος, τον στέλνουμε στο login
        redirect('/login');
    }

    // 2. Έλεγχος Admin Role από τον πίνακα user_roles
    const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('id', user.id)
        .single();
    
    // Έλεγχος: Αν δεν έχει role 'admin' ΚΑΙ το email του δεν είναι το δικό μας email
    if (roleData?.role !== 'admin' && user.email !== ADMIN_EMAIL) {
        // Τον στέλνουμε στο dashboard γιατί δεν έχει δικαίωμα Admin
        redirect('/dashboard?error=unauthorized');
    }

    // Αν πέρασε όλους τους ελέγχους, είναι Admin
    return user.email; 
}


export default async function AdminPage() {
    // Εκτελείται ο έλεγχος ασφαλείας. Αν αποτύχει, το redirect τον πετάει έξω.
    const adminEmail = await getAdminStatus(); 
    
    // Εφόσον πέρασε, φορτώνουμε το Client Component που κάνει τη δουλειά
    return <AdminDashboardContent adminEmail={adminEmail} />;
}