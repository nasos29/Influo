"use client";

import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import BrandDashboardContent from '@/components/BrandDashboardContent';

export default function BrandDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/brand/login');
        return;
      }

      // Verify user is a brand
      const { data: brandData } = await supabase
        .from('brands')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!brandData) {
        router.push('/brand/login');
        return;
      }
    };

    checkAuth();
  }, [router]);

  return <BrandDashboardContent />;
}

