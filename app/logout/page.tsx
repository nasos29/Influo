"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { logoutEverywhere } from "@/lib/authSession";

export default function LogoutPage() {
  useEffect(() => {
    const token = (() => {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key || !/^sb-/i.test(key)) continue;
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw) as { access_token?: string; user?: { id?: string } };
          return parsed;
        }
      } catch {
        /* presence must not block logout */
      }
      return null;
    })();
    const userId = token?.user?.id;
    if (userId) {
      void supabase
        .from("influencer_presence")
        .update({ is_online: false, last_seen: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("influencer_id", userId);
    }
    logoutEverywhere("/login");
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      Logging out...
    </div>
  );
}
