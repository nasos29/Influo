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
      if (convId && existingConv && existingConv.closed_at) {
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

      // Send email notification when influencer sends a message to brand
      if (senderType === 'influencer' && brandEmail && process.env.RESEND_API_KEY) {
        try {
          // Get influencer name
          const { data: influencerData } = await supabaseAdmin
            .from('influencers')
            .select('display_name')
            .eq('id', influencerId)
            .single();

          if (influencerData) {
            // Check if brand has an account
            const { data: brandData } = await supabaseAdmin
              .from('brands')
              .select('id')
              .eq('contact_email', brandEmail.toLowerCase().trim())
              .maybeSingle();

            const brandHasAccount = !!brandData;

            // Send email notification to brand
            const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://influo.gr'}/api/emails`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'message_influencer_to_brand',
                email: brandEmail,
                toEmail: brandEmail,
                brandName: brandName || brandEmail,
                influencerName: influencerData.display_name,
                message: content,
                brandHasAccount: brandHasAccount
              })
            });

            if (emailResponse.ok) {
              console.log('[Messages API] Email notification sent to brand:', brandEmail);
            } else {
              console.error('[Messages API] Failed to send email notification:', await emailResponse.text());
            }
          }
        } catch (emailError: any) {
          console.error('[Messages API] Error sending email notification:', emailError);
          // Don't fail the request if email fails
        }
      }

      // Track analytics: conversation_started (if new conversation) and message_sent
      // Use direct database insert instead of API call for better reliability
      if (!existingConv) {
        // New conversation started
        try {
          const { error: analyticsError } = await supabaseAdmin.from('influencer_analytics').insert([{
            influencer_id: influencerId,
            event_type: 'conversation_started',
            brand_email: brandEmail || null,
            brand_name: brandName || null,
            metadata: { conversation_id: convId, source: 'messages_api' }
          }]);
          if (analyticsError) {
            console.error('[Messages API] Error tracking conversation_started:', analyticsError);
          }
        } catch (err) {
          // Fail silently - analytics tracking should not break the flow
        }
      }
      
      // Track message_sent
      try {
        const { error: analyticsError } = await supabaseAdmin.from('influencer_analytics').insert([{
          influencer_id: influencerId,
          event_type: 'message_sent',
          brand_email: brandEmail || null,
          brand_name: brandName || null,
          metadata: { conversation_id: convId, source: 'messages_api', sender_type: senderType }
        }]);
        if (analyticsError) {
          console.error('[Messages API] Error tracking message_sent:', analyticsError);
        }
      } catch (err) {
        // Fail silently - analytics tracking should not break the flow
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

      // Send email notification when influencer sends a message to brand
      if (senderType === 'influencer' && process.env.RESEND_API_KEY) {
        try {
          // Get conversation data
          const { data: convData } = await supabaseAdmin
            .from('conversations')
            .select('influencer_id, influencer_name, brand_email, brand_name')
            .eq('id', conversationId)
            .single();

          if (convData && convData.brand_email) {
            // Check if brand has an account
            const { data: brandData } = await supabaseAdmin
              .from('brands')
              .select('id')
              .eq('contact_email', convData.brand_email.toLowerCase().trim())
              .maybeSingle();

            const brandHasAccount = !!brandData;

            // Send email notification to brand
            const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://influo.gr'}/api/emails`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'message_influencer_to_brand',
                email: convData.brand_email,
                toEmail: convData.brand_email,
                brandName: convData.brand_name || convData.brand_email,
                influencerName: convData.influencer_name,
                message: content,
                brandHasAccount: brandHasAccount
              })
            });

            if (emailResponse.ok) {
              console.log('[Messages API] Email notification sent to brand:', convData.brand_email);
            } else {
              console.error('[Messages API] Failed to send email notification:', await emailResponse.text());
            }
          }
        } catch (emailError: any) {
          console.error('[Messages API] Error sending email notification:', emailError);
          // Don't fail the request if email fails
        }
      }

      // Track message_sent for existing conversation
      // Need to get influencer_id from conversation
      try {
        const { data: convData } = await supabaseAdmin
          .from('conversations')
          .select('influencer_id, brand_email, brand_name')
          .eq('id', conversationId)
          .single();

        if (convData) {
          const { error: analyticsError } = await supabaseAdmin.from('influencer_analytics').insert([{
            influencer_id: convData.influencer_id,
            event_type: 'message_sent',
            brand_email: convData.brand_email || null,
            brand_name: convData.brand_name || null,
            metadata: { conversation_id: conversationId, source: 'messages_api', sender_type: senderType }
          }]);
          if (analyticsError) {
            console.error('[Messages API] Error tracking message_sent (existing conv):', analyticsError);
          }
        }
      } catch (err) {
        // Fail silently - analytics tracking should not break the flow
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

