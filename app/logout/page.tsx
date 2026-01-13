// app/logout/page.tsx
"use client";

import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function LogoutPage() {
    const router = useRouter();

    useEffect(() => {
        async function handleLogout() {
            try {
                // Get current user before signing out
                const { data: { user } } = await supabase.auth.getUser();
                
                // Mark influencer as offline if they are an influencer
                if (user) {
                    try {
                        // Check if user is an influencer
                        const { data: influencerData } = await supabase
                            .from('influencers')
                            .select('id')
                            .eq('id', user.id)
                            .single();
                        
                        if (influencerData) {
                            // Mark influencer as offline
                            await supabase
                                .from('influencer_presence')
                                .update({
                                    is_online: false,
                                    last_seen: new Date().toISOString(),
                                    updated_at: new Date().toISOString(),
                                })
                                .eq('influencer_id', user.id);
                            console.log('[Logout] Marked influencer as offline:', user.id);
                        }
                    } catch (err) {
                        // Fail silently - don't block logout if presence update fails
                        console.error('[Logout] Error marking influencer offline:', err);
                    }
                    
                    // Check if user is a brand
                    try {
                        const { data: brandData } = await supabase
                            .from('brands')
                            .select('contact_email')
                            .eq('id', user.id)
                            .single();
                        
                        if (brandData?.contact_email) {
                            // Mark brand as offline
                            await supabase
                                .from('brand_presence')
                                .update({
                                    is_online: false,
                                    last_seen: new Date().toISOString(),
                                    updated_at: new Date().toISOString(),
                                })
                                .eq('brand_email', brandData.contact_email.toLowerCase().trim());
                            console.log('[Logout] Marked brand as offline:', brandData.contact_email);
                        }
                    } catch (err) {
                        // Fail silently - don't block logout if presence update fails
                        console.error('[Logout] Error marking brand offline:', err);
                    }
                }
            } catch (err) {
                console.error('[Logout] Error getting user before logout:', err);
            }
            
            // Sign out
            await supabase.auth.signOut();
            router.replace('/login');
        }
        handleLogout();
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            Logging out...
        </div>
    );
}