"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AdminSettingsPage from "@/components/AdminSettingsPage";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "nd.6@hotmail.com";

export default function AdminSettingsRoute() {
  const [userRole, setUserRole] = useState<"admin" | "guest" | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const userEmail = user.email?.toLowerCase().trim();
      const adminEmail = ADMIN_EMAIL.toLowerCase().trim();

      if (userEmail !== adminEmail) {
        router.replace("/dashboard?error=unauthorized");
      } else {
        setUserRole("admin");
      }
      setLoading(false);
    }
    void checkAuth();
  }, [router]);

  if (loading || userRole !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
        Loading Admin Settings…
      </div>
    );
  }

  return <AdminSettingsPage />;
}
