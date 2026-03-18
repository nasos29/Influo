// Client-triggered endpoint: κλείνει τη συνομιλία αν είναι inactive (10+ λεπτά)
// Καλείται από το Messaging component όταν ο χρήστης έχει ανοιχτή τη συνομιλία
// Δεν χρειάζεται CRON_SECRET - το Vercel cron τρέχει μόνο daily

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }

    const { data: conv, error } = await supabaseAdmin
      .from('conversations')
      .select('id, closed_at, last_message_at')
      .eq('id', conversationId)
      .single();

    if (error || !conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conv.closed_at) {
      return NextResponse.json({ success: true, closed: true, message: 'Already closed' });
    }

    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const lastMessageTime = conv.last_message_at ? new Date(conv.last_message_at) : null;
    const isInactive = !lastMessageTime || lastMessageTime < tenMinutesAgo;

    if (!isInactive) {
      return NextResponse.json({
        success: true,
        closed: false,
        message: 'Conversation still active',
        lastMessageAt: conv.last_message_at
      });
    }

    // Κλείσιμο μέσω /api/conversations/end (στέλνει emails)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) || 
      'https://influo.gr';
    const res = await fetch(`${baseUrl}/api/conversations/end`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Origin': new URL(baseUrl).origin
      },
      body: JSON.stringify({ conversationId, autoClose: true })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[Close-if-inactive] Failed to close:', err);
      return NextResponse.json({ error: 'Failed to close conversation' }, { status: 500 });
    }

    return NextResponse.json({ success: true, closed: true, message: 'Conversation closed' });
  } catch (e: any) {
    console.error('[Close-if-inactive]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
