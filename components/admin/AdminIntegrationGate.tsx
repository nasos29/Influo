"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "nd.6@hotmail.com")
  .toLowerCase()
  .trim();

const centered = "flex min-h-screen items-center justify-center bg-slate-50 text-slate-600";

/**
 * Client gate for admin integration pages. UX-only: every data/action is
 * enforced server-side by the matching /api/social/* routes.
 */
export default function AdminIntegrationGate({ redirectPath, children }: { redirectPath: string; children: ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace(`/login?redirect=${redirectPath}`);
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
    };
    check().catch((err) => {
      console.error("[admin integrations gate]", err);
      router.replace("/dashboard?error=unauthorized");
    });
    return () => {
      cancelled = true;
    };
  }, [router, redirectPath]);

  if (loading || !allowed) {
    return <div className={centered}>Checking admin access…</div>;
  }

  return <Suspense fallback={<div className={centered}>Loading…</div>}>{children}</Suspense>;
}
