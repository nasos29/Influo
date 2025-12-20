// app/dashboard/page.tsx
// SERVER COMPONENT

// ΔΙΟΡΘΩΣΗ PATH: Βγαίνουμε από το /app και μπαίνουμε στο /lib
import { createSupabaseServerClient } from './lib/supabase-server'; 
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function DashboardPage() {
    const supabase = createSupabaseServerClient();
    
    // 1. Πρώτα, τσεκάρουμε αν ο χρήστης είναι συνδεδεμένος
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        // Αν δεν είναι συνδεδεμένος, τον στέλνουμε στο login
        redirect('/login');
    }

    // 2. Αν είναι συνδεδεμένος, ψάχνουμε το προφίλ του Influencer
    // Υποθέτουμε ότι το user.email συνδέεται με το contact_email του influencer
    const { data: profile, error } = await supabase
        .from('influencers')
        .select('*')
        .eq('contact_email', user.email)
        .single();
    
    if (!profile) {
        // Αν είναι συνδεδεμένος αλλά δεν έχει προφίλ (π.χ. είναι admin/test), 
        // θα τον στείλουμε σε μια σελίδα που λέει "Profile Incomplete"
        return (
            <div className="min-h-screen p-8 text-center bg-slate-50">
                <h1 className="text-3xl font-bold pt-16">Profile Not Found</h1>
                <p className="text-slate-500">
                    Your account is active, but we couldn't find an Influencer profile linked to {user.email}.
                </p>
                <a href="/login" className="mt-4 text-blue-600 hover:underline block">Sign out</a>
            </div>
        );
    }
    
    // 3. Εμφάνιση του Dashboard (Εδώ θα φτιάξουμε το UI)
    return (
        <div className="min-h-screen p-8 bg-slate-50">
            <h1 className="text-4xl font-extrabold text-slate-900 mb-8">
                Welcome back, {profile.display_name}!
            </h1>
            
            <p className="text-lg mb-4 text-slate-600">This is your Influencer Dashboard.</p>
            
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-bold mb-4">Profile Status</h2>
                <p>Status: {profile.verified ? '✅ VERIFIED & LIVE' : '⏳ PENDING REVIEW'}</p>
                <p>Location: {profile.location}</p>
                <p>Email: {user.email}</p>
                
                <a href="/logout" className="mt-6 inline-block bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600">
                    Sign Out
                </a>
            </div>
        </div>
    );
}