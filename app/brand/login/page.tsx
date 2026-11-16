"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Redirect to unified login, preserving ?redirect= (and other query params). */
function BrandLoginRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams?.toString();
    router.replace(qs ? `/login?${qs}` : "/login");
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-600">Ανακατεύθυνση...</p>
      </div>
    </div>
  );
}

export default function BrandLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-slate-600">Ανακατεύθυνση...</p>
        </div>
      }
    >
      <BrandLoginRedirect />
    </Suspense>
  );
}

