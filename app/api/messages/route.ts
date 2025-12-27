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

    // If creating a new conversation
    if (!conversationId && influencerId && brandEmail) {
      // Check if conversation already exists
      const { data: existingConv } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('influencer_id', influencerId)
        .eq('brand_email', brandEmail)
        .single();

      let convId = existingConv?.id;

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

      // Update conversation last_message_at
      await supabaseAdmin
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', convId);

      // Queue email digest (sends to all: admin, influencer, brand) - one email per conversation per hour
      try {
        const { data: conv } = await supabaseAdmin
          .from('conversations')
          .select('*')
          .eq('id', convId)
          .single();

        if (conv) {
          // Get unread messages from last hour for this conversation
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          const { data: recentMessages } = await supabaseAdmin
            .from('messages')
            .select('*')
            .eq('conversation_id', convId)
            .gte('created_at', oneHourAgo)
            .eq('email_sent', false)
            .order('created_at', { ascending: true });

          if (recentMessages && recentMessages.length > 0) {
            const origin = req.headers.get('origin') || req.headers.get('host') || 'localhost:3000';
            const protocol = origin.includes('localhost') ? 'http' : 'https';
            const baseUrl = origin.startsWith('http') ? origin : `${protocol}://${origin}`;

            // Send digest email to admin, influencer, and brand
            const emailPromises = [
              // Admin email
              fetch(`${baseUrl}/api/emails`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'conversation_digest',
                  email: process.env.ADMIN_EMAIL || 'nd.6@hotmail.com',
                  influencerName: conv.influencer_name,
                  brandName: conv.brand_name || conv.brand_email,
                  conversationId: convId,
                  messages: recentMessages.map(m => ({
                    senderName: m.sender_type === 'influencer' ? conv.influencer_name : (conv.brand_name || conv.brand_email),
                    senderType: m.sender_type,
                    content: m.content,
                    createdAt: m.created_at
                  }))
                })
              }),
              // Influencer email
              fetch(`${baseUrl}/api/emails`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'conversation_digest',
                  email: conv.influencer_email,
                  influencerName: conv.influencer_name,
                  brandName: conv.brand_name || conv.brand_email,
                  conversationId: convId,
                  messages: recentMessages.map(m => ({
                    senderName: m.sender_type === 'influencer' ? conv.influencer_name : (conv.brand_name || conv.brand_email),
                    senderType: m.sender_type,
                    content: m.content,
                    createdAt: m.created_at
                  }))
                })
              }),
              // Brand email
              fetch(`${baseUrl}/api/emails`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'conversation_digest',
                  email: conv.brand_email,
                  influencerName: conv.influencer_name,
                  brandName: conv.brand_name || conv.brand_email,
                  conversationId: convId,
                  messages: recentMessages.map(m => ({
                    senderName: m.sender_type === 'influencer' ? conv.influencer_name : (conv.brand_name || conv.brand_email),
                    senderType: m.sender_type,
                    content: m.content,
                    createdAt: m.created_at
                  }))
                })
              })
            ];

            await Promise.all(emailPromises);

            // Mark messages as email_sent
            await supabaseAdmin
              .from('messages')
              .update({ email_sent: true })
              .in('id', recentMessages.map(m => m.id));
          }
        }
      } catch (emailError) {
        console.error('Email digest failed:', emailError);
      }

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

      // Update conversation last_message_at
      await supabaseAdmin
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      // Queue email digest (sends to all: admin, influencer, brand) - one email per conversation per hour
      try {
        const { data: conv } = await supabaseAdmin
          .from('conversations')
          .select('*')
          .eq('id', conversationId)
          .single();

        if (conv) {
          // Get unread messages from last hour for this conversation
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          const { data: recentMessages } = await supabaseAdmin
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .gte('created_at', oneHourAgo)
            .eq('email_sent', false)
            .order('created_at', { ascending: true });

          if (recentMessages && recentMessages.length > 0) {
            const origin = req.headers.get('origin') || req.headers.get('host') || 'localhost:3000';
            const protocol = origin.includes('localhost') ? 'http' : 'https';
            const baseUrl = origin.startsWith('http') ? origin : `${protocol}://${origin}`;

            // Send digest email to admin, influencer, and brand
            const emailPromises = [
              // Admin email
              fetch(`${baseUrl}/api/emails`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'conversation_digest',
                  email: process.env.ADMIN_EMAIL || 'nd.6@hotmail.com',
                  influencerName: conv.influencer_name,
                  brandName: conv.brand_name || conv.brand_email,
                  conversationId: conversationId,
                  messages: recentMessages.map(m => ({
                    senderName: m.sender_type === 'influencer' ? conv.influencer_name : (conv.brand_name || conv.brand_email),
                    senderType: m.sender_type,
                    content: m.content,
                    createdAt: m.created_at
                  }))
                })
              }),
              // Influencer email
              fetch(`${baseUrl}/api/emails`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'conversation_digest',
                  email: conv.influencer_email,
                  influencerName: conv.influencer_name,
                  brandName: conv.brand_name || conv.brand_email,
                  conversationId: conversationId,
                  messages: recentMessages.map(m => ({
                    senderName: m.sender_type === 'influencer' ? conv.influencer_name : (conv.brand_name || conv.brand_email),
                    senderType: m.sender_type,
                    content: m.content,
                    createdAt: m.created_at
                  }))
                })
              }),
              // Brand email
              fetch(`${baseUrl}/api/emails`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'conversation_digest',
                  email: conv.brand_email,
                  influencerName: conv.influencer_name,
                  brandName: conv.brand_name || conv.brand_email,
                  conversationId: conversationId,
                  messages: recentMessages.map(m => ({
                    senderName: m.sender_type === 'influencer' ? conv.influencer_name : (conv.brand_name || conv.brand_email),
                    senderType: m.sender_type,
                    content: m.content,
                    createdAt: m.created_at
                  }))
                })
              })
            ];

            await Promise.all(emailPromises);

            // Mark messages as email_sent
            await supabaseAdmin
              .from('messages')
              .update({ email_sent: true })
              .in('id', recentMessages.map(m => m.id));
          }
        }
      } catch (emailError) {
        console.error('Email digest failed:', emailError);
      }

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

