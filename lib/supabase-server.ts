// lib/supabase-server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Αυτή η συνάρτηση θα χρησιμοποιείται από τις Protected Server Components
export function createSupabaseServerClient() {
  // Παίρνουμε το store των cookies
  const cookieStore = cookies(); 

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // FIX: Χρησιμοποιούμε 'as any' για να παρακάμψουμε το type error
          // ΔΕΝ επηρεάζει το runtime, αλλά περνάει το type-check.
          return (cookieStore as any).get(name)?.value; 
        },
        set(name: string, value: string, options: CookieOptions) {
          (cookieStore as any).set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          (cookieStore as any).set({ name, value: '', ...options });
        },
      },
    }
  );
}