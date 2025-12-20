// app/logout/route.ts

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

// Αλλαγή: Το Supabase Auth είναι καλύτερο να τρέχει σε Server Actions/Routes
export async function GET() {
  const supabase = createSupabaseServerClient();
  
  // Logout
  await supabase.auth.signOut();
  
  // Ανακατεύθυνση στο Login
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
}