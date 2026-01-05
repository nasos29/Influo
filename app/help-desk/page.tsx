// app/help-desk/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import HelpDeskPublic from '@/components/HelpDeskPublic';

export default function HelpDeskPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userType, setUserType] = useState<'influencer' | 'brand' | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        // Not logged in - redirect to login
        router.replace('/login?redirect=/help-desk');
        return;
      }

      // Check if influencer
      const { data: influencer } = await supabase
        .from('influencers')
        .select('id, display_name, contact_email')
        .eq('contact_email', authUser.email)
        .single();

      if (influencer) {
        setUser({
          id: influencer.id,
          name: influencer.display_name,
          email: influencer.contact_email,
        });
        setUserType('influencer');
        setLoading(false);
        return;
      }

      // Check if brand (by email)
      // Brands don't have a separate table, we use email
      setUser({
        id: authUser.email,
        name: authUser.email,
        email: authUser.email,
      });
      setUserType('brand');
      setLoading(false);
    }

    checkAuth();
  }, [router]);

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

