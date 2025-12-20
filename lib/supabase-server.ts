// lib/supabase-server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Αυτή η συνάρτηση θα χρησιμοποιείται από τις Protected Server Components
export function createSupabaseServerClient() {
  // FIX: Force cast the cookies() to "any" to bypass the type error
  const cookieStore = cookies() as any; 

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value, 
        set: (name: string, value: string, options: any) => {
          cookieStore.set({ name, value, ...options })
        },
        remove: (name: string, value: string, options: any) => { // Προσοχή στο value: string εδώ
          cookieStore.set({ name, value: '', ...options }) // value: ''
        },
      },
    }
  )
}