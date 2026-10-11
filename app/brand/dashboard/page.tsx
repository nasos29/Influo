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
      if (!user) router.push('/login');
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
