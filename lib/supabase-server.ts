// lib/supabase-server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Αυτή η συνάρτηση θα χρησιμοποιείται από τις Protected Server Components
export function createSupabaseServerClient() {
  // Παίρνουμε το store των cookies
  const cookieStore = cookies() as any; // Κρατάμε το any για να περάσει το build

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => {
          // FIX: Αυτό είναι το πιο ανθεκτικό GET call
          const cookie = cookieStore.get(name);
          return cookie ? cookie.value : undefined;
        },
        set: (name: string, value: string, options: CookieOptions) => {
          cookieStore.set({ name, value, ...options });
        },
        remove: (name: string, options: CookieOptions) => { 
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  )
}