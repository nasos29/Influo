import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Internal function to close a conversation (same logic as /api/conversations/end)
async function endConversationInternal(conversationId: string, autoClose: boolean, origin?: string) {
  try {
    // Get conversation details
    // Don't use select('*') to avoid issues with missing columns
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('id, influencer_id, influencer_name, influencer_email, brand_email, brand_name, proposal_id, created_at, updated_at, last_message_at, closed_at, last_activity_influencer, last_activity_brand')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return { success: false, error: 'Conversation not found' };
    }

    // Check if already closed
    if (conversation.closed_at) {
      return { success: true, message: 'Conversation already closed' };
    }

    // Get all messages from the conversation
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
    }

    // Mark conversation as closed
    const closedAt = new Date().toISOString();
    const updateData: any = { closed_at: closedAt };
    
    const { error: updateError } = await supabaseAdmin
      .from('conversations')
      .update(updateData)
      .eq('id', conversationId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Send email to all parties (admin, influencer, brand)
    const baseUrl = origin || 'https://influo.gr';

    const messagesList = (messages || []).map((msg: any) => ({
      senderName: msg.sender_type === 'influencer' 
        ? conversation.influencer_name 
        : (conversation.brand_name || conversation.brand_email),
      senderType: msg.sender_type,
      content: msg.content,
      createdAt: msg.created_at
    }));

    const emailPromises = [
      // Admin email
      fetch(`${baseUrl}/api/emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'conversation_end',
          email: process.env.ADMIN_EMAIL || 'nd.6@hotmail.com',
          influencerName: conversation.influencer_name,
          brandName: conversation.brand_name || conversation.brand_email,
          conversationId: conversationId,
          messages: messagesList,
          autoClose: autoClose || false,
        })
      }),
      // Influencer email
      fetch(`${baseUrl}/api/emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'conversation_end',
          email: conversation.influencer_email,
          influencerName: conversation.influencer_name,
          brandName: conversation.brand_name || conversation.brand_email,
          conversationId: conversationId,
          messages: messagesList,
          autoClose: autoClose || false,
        })
      }),
      // Brand email
      fetch(`${baseUrl}/api/emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'conversation_end',
          email: conversation.brand_email,
          influencerName: conversation.influencer_name,
          brandName: conversation.brand_name || conversation.brand_email,
          conversationId: conversationId,
          messages: messagesList,
          autoClose: autoClose || false,
        })
      })
    ];

    await Promise.allSettled(emailPromises);

    return { success: true, message: 'Conversation closed and emails sent', closedAt };
  } catch (error: any) {
    console.error('End conversation error:', error);
    return { success: false, error: error.message };
  }
}

// This endpoint should be called by a cron job every 1-5 minutes
// To set up: Use Vercel Cron, or Supabase Edge Functions, or external cron service
export async function GET(req: Request) {
  // Verify this is called from a cron job
  // Vercel Cron automatically sends the CRON_SECRET in the Authorization header
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // Security check: require authorization header to match CRON_SECRET
  // In production, CRON_SECRET should be set and Vercel will send it automatically
  // For local testing, you can temporarily disable this check or set CRON_SECRET
  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      // Check if it's a Vercel Cron request (they send special headers)
      const isVercelCron = req.headers.get('x-vercel-cron') === '1' || 
                          req.headers.get('user-agent')?.includes('vercel-cron');
      if (!isVercelCron) {
        return NextResponse.json({ error: 'Unauthorized. Missing or invalid CRON_SECRET.' }, { status: 401 });
      }
    }
  } else {
    console.warn('[Cron] WARNING: CRON_SECRET not set. This endpoint is unprotected!');
  }

  try {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000); // 10 minutes total (5 for warning + 5 for close)
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Find conversations where both parties have been inactive for 10+ minutes
    // We need to check both timestamps are either null or older than 10 minutes
    const { data: allConversations, error: fetchError } = await supabaseAdmin
      .from('conversations')
      .select('id, influencer_name, influencer_email, brand_name, brand_email, last_activity_influencer, last_activity_brand')
      .is('closed_at', null); // Not already closed

    if (fetchError) {
      console.error('[Cron] Error fetching conversations:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Filter conversations where both parties have been inactive for 10+ minutes
    const inactiveConversations = (allConversations || []).filter(conv => {
      const influencerInactive = !conv.last_activity_influencer || 
        new Date(conv.last_activity_influencer) < tenMinutesAgo;
      const brandInactive = !conv.last_activity_brand || 
        new Date(conv.last_activity_brand) < tenMinutesAgo;
      return influencerInactive && brandInactive;
    });

    if (inactiveConversations.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No inactive conversations to close',
        count: 0 
      });
    }

    // Close each inactive conversation
    const origin = req.headers.get('origin') || req.headers.get('host') || 'influo.gr';
    const protocol = origin.includes('localhost') ? 'http' : 'https';
    const baseUrl = origin.startsWith('http') ? origin : `${protocol}://${origin}`;
    
    const results = [];
    for (const conv of inactiveConversations) {
      try {
        // Directly call the end conversation logic instead of making HTTP request
        const endResponse = await endConversationInternal(conv.id, true, baseUrl);
        
        if (endResponse.success) {
          results.push({ conversationId: conv.id, status: 'closed' });
        } else {
          results.push({ conversationId: conv.id, status: 'error', error: endResponse.error });
        }
      } catch (err: any) {
        console.error(`[Cron] Error closing conversation ${conv.id}:`, err);
        results.push({ conversationId: conv.id, status: 'error', error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${inactiveConversations.length} conversations`,
      results
    });

  } catch (error: any) {
    console.error('[Cron] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

