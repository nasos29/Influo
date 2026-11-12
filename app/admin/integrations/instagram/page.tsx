"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AdminInstagramIntegrations from "@/components/admin/AdminInstagramIntegrations";

const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "nd.6@hotmail.com")
  .toLowerCase()
  .trim();

/**
 * Client gate is UX-only. All data/actions are enforced server-side via
 * /api/social/instagram/* (isAdminUser / rejectUnlessAdmin).
 */
export default function AdminInstagramIntegrationsPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?redirect=/admin/integrations/instagram");
        return;
      }
      const email = (user.email || "").toLowerCase().trim();
      const { data: role } = await supabase.from("user_roles").select("role").eq("id", user.id).maybeSingle();
      const isAdmin = role?.role === "admin" || email === ADMIN_EMAIL;
      if (!isAdmin) {
        router.replace("/dashboard?error=unauthorized");
        return;
      }
      if (!cancelled) {
        setAllowed(true);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Checking admin access…
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
          Loading…
        </div>
      }
    >
      <AdminInstagramIntegrations />
    </Suspense>
  );
}
