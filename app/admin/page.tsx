// app/admin/page.tsx
// ΔΕΝ ΧΡΕΙΑΖΕΤΑΙ "use client"

import { createSupabaseServerClient } from '../../lib/supabase-server'; 
import { redirect } from 'next/navigation';
import AdminDashboardContent from '@/components/AdminDashboardContent'; 

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nd.6@hotmail.com';


async function getAdminStatus() {
    const supabase = createSupabaseServerClient();
    
    // ΕΔΩ ΕΙΝΑΙ Η ΚΡΙΣΙΜΗ ΚΛΗΣΗ
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }
    
    if (!user.email) {
        redirect('/login?error=noemail');
    }
    
    // 1. Έλεγχος Admin Role
    const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle(); 

    // 2. Έλεγχος: Αν δεν έχει role 'admin' ΚΑΙ το email δεν είναι το Admin Email (Fallback)
    if (roleData?.role !== 'admin' && user.email !== ADMIN_EMAIL) {
        redirect('/dashboard?error=unauthorized'); 
    }

    return user.email as string;
}


export default async function AdminPage() {
    const adminEmail = await getAdminStatus(); 
    
    return <AdminDashboardContent adminEmail={adminEmail} />;
}