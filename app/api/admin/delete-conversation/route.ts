import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(req: NextRequest) {
  try {
    const { conversationId } = await req.json();

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    // First, get conversation details to find related analytics
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('id, influencer_id, brand_email')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Get all message IDs from this conversation for analytics deletion
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
    }

    const messageIds = messages?.map(m => m.id) || [];

    // Delete analytics entries related to this conversation
    if (conversation.influencer_id) {
      // Get all analytics for this influencer to filter by metadata
      const { data: allAnalytics, error: analyticsError } = await supabaseAdmin
        .from('influencer_analytics')
        .select('id, event_type, metadata')
        .eq('influencer_id', conversation.influencer_id)
        .in('event_type', ['conversation_started', 'message_sent']);

      if (!analyticsError && allAnalytics) {
        // Filter analytics that match this conversation_id in metadata
        const matchingAnalytics = allAnalytics.filter(a => {
          const metadata = a.metadata as any;
          return metadata?.conversation_id === conversationId;
        });

        if (matchingAnalytics.length > 0) {
          await supabaseAdmin
            .from('influencer_analytics')
            .delete()
            .in('id', matchingAnalytics.map(a => a.id));
        }
      }
    }

    // Delete messages (will cascade from conversation deletion, but doing explicitly for clarity)
    const { error: deleteMessagesError } = await supabaseAdmin
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId);

    if (deleteMessagesError) {
      console.error('Error deleting messages:', deleteMessagesError);
      return NextResponse.json(
        { error: 'Failed to delete messages' },
        { status: 500 }
      );
    }

    // Delete the conversation (this should cascade delete messages, but we already deleted them)
    const { error: deleteError } = await supabaseAdmin
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (deleteError) {
      console.error('Error deleting conversation:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete conversation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Conversation and related data deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
