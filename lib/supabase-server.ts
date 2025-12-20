// lib/supabase-server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Αυτή η συνάρτηση θα χρησιμοποιείται από τις Protected Server Components
export function createSupabaseServerClient() {
  // Παίρνουμε το store των cookies (είναι το object που μας σπάει)
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // FIX: Χρησιμοποιούμε το standard get
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // FIX: Χρησιμοποιούμε το standard set
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          // FIX: Χρησιμοποιούμε το standard remove
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}