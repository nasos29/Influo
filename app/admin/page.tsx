// app/admin/page.tsx

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
// import { redirect } from 'next/navigation'; // <-- ΔΕΝ ΤΟ ΧΡΕΙΑΖΟΜΑΣΤΕ ΠΙΑ ΕΔΩ
import { headers } from 'next/headers'; // <-- Keep this if needed for server

// Lazy load το Client Component, ΑΠΕΝΕΡΓΟΠΟΙΩΝΤΑΣ ΤΟ SSR
const AdminDashboardContent = dynamic(() => import('../components/AdminDashboardContent'), { 
    ssr: false, 
    loading: () => <div className="min-h-screen flex items-center justify-center">Loading Admin Panel...</div>
});

// [!!!] ΒΑΛΕ ΤΟ ADMIN EMAIL ΣΟΥ ΕΔΩ
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nd.6@hotmail.com';


export default function AdminPage() {
    // Η Auth γίνεται πλέον εντός του Client Component
    
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            {/* Περιμένουμε το Client Component να κάνει τον έλεγχο Auth */}
            <AdminDashboardContent adminEmail={ADMIN_EMAIL} /> 
        </Suspense>
    );
}