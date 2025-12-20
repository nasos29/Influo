// app/admin/page.tsx
// Server Component (για να τρέχει το <Suspense>)

import { createSupabaseServerClient } from '../lib/supabase-server'; 
import { redirect } from 'next/navigation';
import AdminDashboardContent from '@/components/AdminDashboardContent'; // <-- Keep this alias for components


// Lazy load το Client Component, ΑΠΕΝΕΡΓΟΠΟΙΩΝΤΑΣ ΤΟ SSR
const AdminDashboardContent = dynamic(() => import('@/components/AdminDashboardContent'), { 
    ssr: false, // <-- ΤΟ ΚΛΕΙΔΙ: Κάνε το Client-Side Rendered
    loading: () => <div className="min-h-screen flex items-center justify-center">Loading...</div>
});

// [!!!] ΒΑΛΕ ΤΟ ADMIN EMAIL ΣΟΥ ΕΔΩ
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nd.6@hotmail.com';


export default function AdminPage() {
    // Εδώ δεν χρειαζόμαστε Server Auth πλέον, γιατί ο client component θα το κάνει
    // Εφόσον η σελίδα είναι κλειδωμένη με Client-Side Auth, ο κώδικας είναι καθαρός.
    
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            {/* Το Component αναλαμβάνει τον έλεγχο Auth από το client */}
            <AdminDashboardContent adminEmail={ADMIN_EMAIL} /> 
        </Suspense>
    );
}