// lib/supabase-server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Αυτή η συνάρτηση θα χρησιμοποιείται από τις Protected Server Components
export function createSupabaseServerClient() {
  // FIX: Force cast to 'any' για να παρακάμψουμε το type error
  const cookieStore = cookies() as any; 

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value, 
        
        // FIX: Το set παίρνει 3 ορίσματα
        set: (name: string, value: string, options: CookieOptions) => {
          cookieStore.set({ name, value, ...options })
        },
        // FIX: Το remove παίρνει 2 ορίσματα (name και options)
        remove: (name: string, options: CookieOptions) => { 
          // Χρησιμοποιούμε τη μέθοδο set, αλλά με κενή τιμή
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}