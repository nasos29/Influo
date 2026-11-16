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
        const returnTo =
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : "/brand/dashboard";
        router.push(`/login?redirect=${encodeURIComponent(returnTo)}`);
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
