// app/help-desk/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import HelpDeskPublic from '@/components/HelpDeskPublic';
import { loadOwnProfiles } from '@/lib/ownProfile';

export default function HelpDeskPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userType, setUserType] = useState<'influencer' | 'brand' | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        router.replace('/login?redirect=/help-desk');
        return;
      }

      const profiles = await loadOwnProfiles(supabase);
      if (!profiles.ok) {
        setLoadError(profiles.message);
        setLoading(false);
        return;
      }

      if (profiles.influencer) {
        const influencer = profiles.influencer;
        setUser({
          id: influencer.id,
          name: typeof influencer.display_name === "string" ? influencer.display_name : "",
          email: typeof influencer.contact_email === "string" ? influencer.contact_email : authUser.email,
        });
        setUserType('influencer');
        setLoading(false);
        return;
      }

      if (profiles.brand) {
        const brand = profiles.brand;
        setUser({
          id: brand.id || authUser.email,
          name: typeof brand.brand_name === "string" && brand.brand_name ? brand.brand_name : authUser.email,
          email: typeof brand.contact_email === "string" && brand.contact_email ? brand.contact_email : authUser.email,
        });
        setUserType('brand');
        setLoading(false);
        return;
      }

      setLoadError("Δεν βρέθηκε προφίλ για αυτόν τον λογαριασμό.");
      setLoading(false);
    }

    checkAuth();
  }, [router]);

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <p className="text-slate-700 text-center max-w-md">{loadError}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading Help Desk...</div>
      </div>
    );
  }

  if (!user || !userType) {
    return null; // Will redirect
  }

  return <HelpDeskPublic user={user} userType={userType} />;
}

