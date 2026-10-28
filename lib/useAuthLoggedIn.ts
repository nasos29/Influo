"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/** Client-only: tracks whether the browser has an auth session. */
export function useAuthLoggedIn(): boolean {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled) setIsLoggedIn(!!session);
    })();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return isLoggedIn;
}
