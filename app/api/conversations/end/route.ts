import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create client with options to avoid schema cache issues
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: false,
  },
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { conversationId, autoClose } = body;

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    // Get conversation details
    // Don't use select('*') to avoid issues with missing columns like closed_by_inactivity
    // Select only the columns we need
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('id,influencer_id,influencer_name,influencer_email,brand_email,brand_name,proposal_id,created_at,updated_at,last_message_at,closed_at,last_activity_influencer,last_activity_brand')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Check if already closed
    if (conversation.closed_at) {
      return NextResponse.json({ success: true, message: 'Conversation already closed' });
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
    // IMPORTANT: Only update closed_at - closed_by_inactivity column does NOT exist in database
    const closedAt = new Date().toISOString();
    
    // Direct update - no RPC function needed
    const { error: updateError } = await supabaseAdmin
      .from('conversations')
      .update({ closed_at: closedAt })
      .eq('id', conversationId);

    if (updateError) {
      console.error('[End Conversation] Update error:', updateError);
      // Check if error is about schema cache (closed_by_inactivity column)
      // Even if there's a schema cache warning, the update might have succeeded
      if (updateError.message.includes('closed_by_inactivity') || 
          updateError.message.includes('schema cache')) {
        console.warn('[End Conversation] Schema cache warning, verifying update...');
        // Verify if conversation was actually closed despite the error
        const { data: verifyConv } = await supabaseAdmin
          .from('conversations')
          .select('closed_at')
          .eq('id', conversationId)
          .single();
        
        if (verifyConv?.closed_at) {
          // Update succeeded despite schema cache warning, continue
          console.log('[End Conversation] Update succeeded despite schema cache warning');
        } else {
          // Update actually failed
          return NextResponse.json({ 
            error: 'Failed to close conversation. Schema cache issue.',
            details: updateError.message
          }, { status: 500 });
        }
      } else {
        // Other error
        return NextResponse.json({ 
          error: 'Failed to close conversation',
          details: updateError.message 
        }, { status: 500 });
      }
    }

    // Send email to all parties (admin, influencer, brand)
    const origin = req.headers.get('origin') || req.headers.get('host') || 'localhost:3000';
    const protocol = origin.includes('localhost') ? 'http' : 'https';
    const baseUrl = origin.startsWith('http') ? origin : `${protocol}://${origin}`;

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

    const emailResults = await Promise.allSettled(emailPromises);
    
    // Log email sending results
    emailResults.forEach((result, index) => {
      const recipient = index === 0 ? 'admin' : index === 1 ? 'influencer' : 'brand';
      if (result.status === 'fulfilled') {
        console.log(`[End Conversation] Successfully sent email to ${recipient}`);
      } else {
        console.error(`[End Conversation] Failed to send email to ${recipient}:`, result.reason);
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Conversation closed and emails sent',
      closedAt 
    });
  } catch (error: any) {
    console.error('End conversation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

