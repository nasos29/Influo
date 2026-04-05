"use client";

import { Suspense, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import BrandDashboardContent from '@/components/BrandDashboardContent';

export default function BrandDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      // Verify user is a brand
      const { data: brandData } = await supabase
        .from('brands')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (!brandData) {
        router.push('/login');
        return;
      }
    };

    checkAuth();
  }, [router]);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
          Loading…
        </div>
      }
    >
      <BrandDashboardContent />
    </Suspense>
  );
}

