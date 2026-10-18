// app/logout/page.tsx
"use client";

import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { loadOwnBrand } from '@/lib/ownProfile';
import { logoutEverywhere } from '@/lib/authSession';

export default function LogoutPage() {
    useEffect(() => {
        let finished = false;
        const go = () => {
            if (finished) return;
            finished = true;
            void logoutEverywhere('/login');
        };
        const watchdog = window.setTimeout(go, 2000);

        async function handleLogout() {
            try {
                const userResult = await Promise.race([
                    supabase.auth.getUser(),
                    new Promise<null>((resolve) => setTimeout(() => resolve(null), 800)),
                ]);
                const user = userResult && 'data' in userResult ? userResult.data.user : null;
                if (user) {
                    void supabase
                        .from('influencer_presence')
                        .update({ is_online: false, last_seen: new Date().toISOString(), updated_at: new Date().toISOString() })
                        .eq('influencer_id', user.id);
                    const brandResult = await Promise.race([
                        loadOwnBrand(supabase),
                        new Promise<null>((resolve) => setTimeout(() => resolve(null), 800)),
                    ]);
                    const brandEmail = brandResult && 'ok' in brandResult && brandResult.ok && typeof brandResult.profile.contact_email === "string"
                        ? brandResult.profile.contact_email
                        : "";
                    if (brandEmail) {
                        void supabase
                            .from('brand_presence')
                            .update({ is_online: false, last_seen: new Date().toISOString(), updated_at: new Date().toISOString() })
                            .eq('brand_email', brandEmail.toLowerCase().trim());
                    }
                }
            } catch {
                /* presence must not block logout */
            }
            window.clearTimeout(watchdog);
            go();
        }
        handleLogout();
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center">
            Logging out...
        </div>
    );
}