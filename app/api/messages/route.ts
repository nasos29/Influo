import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service role client for admin operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { conversationId, senderId, senderType, content, influencerId, brandEmail, brandName, proposalId, sendViaEmail } = body;
    
    console.log('[Messages API] POST request received:', {
      hasConversationId: !!conversationId,
      hasSenderId: !!senderId,
      senderType,
      hasContent: !!content,
      contentLength: content?.length || 0
    });

    // If creating a new conversation
    if (!conversationId && influencerId && brandEmail) {
      // Check if conversation already exists (open or closed)
      const { data: existingConv } = await supabaseAdmin
        .from('conversations')
        .select('id, closed_at')
        .eq('influencer_id', influencerId)
        .eq('brand_email', brandEmail)
        .single();

      let convId = existingConv?.id;

      // If conversation exists but is closed, reopen it
      if (convId && existingConv.closed_at) {
        console.log('[Messages API] Reopening closed conversation:', convId);
        await supabaseAdmin
          .from('conversations')
          .update({ closed_at: null })
          .eq('id', convId);
      }

      // Create conversation if it doesn't exist
      if (!convId) {
        const { data: influencer } = await supabaseAdmin
          .from('influencers')
          .select('id, display_name, contact_email')
          .eq('id', influencerId)
          .single();

        if (!influencer) {
          return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });
        }

        const { data: newConv, error: convError } = await supabaseAdmin
          .from('conversations')
          .insert([{
            influencer_id: influencerId,
            influencer_name: influencer.display_name,
            influencer_email: influencer.contact_email,
            brand_email: brandEmail,
            brand_name: brandName || brandEmail,
            proposal_id: proposalId || null,
          }])
          .select()
          .single();

        if (convError) {
          return NextResponse.json({ error: convError.message }, { status: 500 });
        }

        convId = newConv.id;
      }

      // Create message
      const { data: message, error: msgError } = await supabaseAdmin
        .from('messages')
        .insert([{
          conversation_id: convId,
          sender_id: senderType === 'brand' ? brandEmail : influencerId,
          sender_type: senderType,
          content: content,
          sent_via_email: sendViaEmail || false,
          email_sent: false, // Will be set to true when digest email is sent
        }])
        .select()
        .single();

      if (msgError) {
        return NextResponse.json({ error: msgError.message }, { status: 500 });
      }

      // Update conversation last_message_at and activity timestamp
      const now = new Date().toISOString();
      const updateField = senderType === 'influencer' ? 'last_activity_influencer' : 'last_activity_brand';
      console.log('[Messages API] ⚠️ Updating activity timestamp (new conversation, message sent):', {
        conversationId: convId,
        updateField,
        timestamp: now,
        senderType,
        contentPreview: content?.substring(0, 50) || 'no content'
      });
      await supabaseAdmin
        .from('conversations')
        .update({ 
          last_message_at: now,
          [updateField]: now
        })
        .eq('id', convId);

      // Emails will be sent ONLY when conversation ends (via /api/conversations/end)
      // No auto-sending during active conversation

      return NextResponse.json({ success: true, message, conversationId: convId });
    }

    // If adding to existing conversation
    if (conversationId && senderId && senderType && content) {
      const { data: message, error: msgError } = await supabaseAdmin
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          sender_id: senderId,
          sender_type: senderType,
          content: content,
          sent_via_email: sendViaEmail || false,
          email_sent: false, // Will be set to true when digest email is sent
        }])
        .select()
        .single();

      if (msgError) {
        return NextResponse.json({ error: msgError.message }, { status: 500 });
      }

      // Check if conversation is closed and reopen it if needed
      const { data: convCheck } = await supabaseAdmin
        .from('conversations')
        .select('closed_at')
        .eq('id', conversationId)
        .single();

      if (convCheck?.closed_at) {
        console.log('[Messages API] Reopening closed conversation:', conversationId);
      }

      // Update conversation last_message_at and activity timestamp
      // IMPORTANT: This is called ONLY when a message is sent, not automatically
      // Also reopen conversation if it was closed
      const now = new Date().toISOString();
      const updateField = senderType === 'influencer' ? 'last_activity_influencer' : 'last_activity_brand';
      console.log('[Messages API] ⚠️ Updating activity timestamp (message sent):', {
        conversationId,
        updateField,
        timestamp: now,
        senderType,
        contentPreview: content?.substring(0, 50) || 'no content'
      });
      await supabaseAdmin
        .from('conversations')
        .update({ 
          last_message_at: now,
          [updateField]: now,
          closed_at: null // Reopen conversation if it was closed
        })
        .eq('id', conversationId);

      // Emails will be sent ONLY when conversation ends (via /api/conversations/end)
      // No auto-sending during active conversation

      return NextResponse.json({ success: true, message });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error: any) {
    console.error('Message API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');
    const influencerId = searchParams.get('influencerId');
    const brandEmail = searchParams.get('brandEmail');

    if (conversationId) {
      // Get messages for a conversation
      const { data: messages, error } = await supabaseAdmin
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ messages });
    }

    if (influencerId && brandEmail) {
      // Get conversation by influencer and brand
      const { data: conversation } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('influencer_id', influencerId)
        .eq('brand_email', brandEmail)
        .single();

      if (conversation) {
        const { data: messages, error } = await supabaseAdmin
          .from('messages')
          .select('*')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: true });

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ messages, conversationId: conversation.id });
      }

      return NextResponse.json({ messages: [], conversationId: null });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error: any) {
    console.error('Message GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

