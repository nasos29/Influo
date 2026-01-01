"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect to unified login page
export default function BrandLoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to unified login page
    router.replace('/login');
  }, [router]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-600">Ανακατεύθυνση...</p>
      </div>
    </div>
  );
}

