// app/admin/page.tsx
// SERVER COMPONENT - Απλά φορτώνει το Client Component

import AdminAuthWrapper from './check-auth';

// [!!!] ΑΦΑΙΡΟΥΜΕ ΟΛΗ ΤΗ ΛΟΓΙΚΗ ΓΙΑ ΝΑ ΕΙΝΑΙ ΚΑΘΑΡΟ
export default function AdminPage() {
    return <AdminAuthWrapper />;
}