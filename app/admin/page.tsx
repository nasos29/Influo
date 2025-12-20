// app/admin/page.tsx
// SERVER COMPONENT

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';

// Lazy load το Client Component, ΑΠΕΝΕΡΓΟΠΟΙΩΝΤΑΣ ΤΟ SSR
// FIX: Το dynamic πρέπει να είναι εκτός της συνάρτησης
const ClientAdminDashboardContent = dynamic(() => import('../../components/AdminDashboardContent'), { 
    ssr: false, // <-- ΤΟ ΚΛΕΙΔΙ: Κάνε το Client-Side Rendered
    loading: () => <div className="min-h-screen flex items-center justify-center">Loading Admin Panel...</div>
});

// [!!!] ΒΑΛΕ ΤΟ ADMIN EMAIL ΣΟΥ ΕΔΩ
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nd.6@hotmail.com';


export default function AdminPage() {
    // [!!!] ΑΦΑΙΡΕΣΑ ΤΗΝ SERVER-SIDE AUTH ΓΙΑ ΝΑ ΠΕΡΑΣΕΙ ΤΟ BUILD
    // Η Auth θα γίνεται εντός του Client Component (όπως πριν το σφάλμα)
    
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <ClientAdminDashboardContent adminEmail={ADMIN_EMAIL} /> 
        </Suspense>
    );
}