import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Public endpoint for client-side polling - only checks, doesn't close
// This allows client-side polling without exposing CRON_SECRET
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    // If specific conversation requested, check only that one
    if (conversationId) {
      const { data: conv, error } = await supabaseAdmin
        .from('conversations')
        .select('id, closed_at, last_message_at')
        .eq('id', conversationId)
        .single();

      if (error || !conv) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }

      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      const lastMessageTime = conv.last_message_at ? new Date(conv.last_message_at) : null;
      const isInactive = !lastMessageTime || lastMessageTime < tenMinutesAgo;

      return NextResponse.json({
        conversationId: conv.id,
        isClosed: !!conv.closed_at,
        isInactive,
        lastMessageAt: conv.last_message_at
      });
    }

    // If no conversationId, return general status (for testing)
    return NextResponse.json({ 
      message: 'Provide conversationId query parameter to check specific conversation',
      example: '/api/conversations/check-inactive?conversationId=xxx'
    });
  } catch (error: any) {
    console.error('[Check Inactive] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

