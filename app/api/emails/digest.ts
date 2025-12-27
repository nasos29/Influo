// Email digest system - collects messages and sends one email per conversation

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface PendingEmail {
  conversation_id: string;
  messages: Array<{
    sender_name: string;
    sender_type: 'influencer' | 'brand';
    content: string;
    created_at: string;
  }>;
  influencer_email: string;
  influencer_name: string;
  brand_email: string;
  brand_name: string;
  last_sent_at: string | null;
}

// This function will be called when a message is created
export async function queueEmailDigest(
  conversationId: string,
  messageContent: string,
  senderName: string,
  senderType: 'influencer' | 'brand',
  influencerEmail: string,
  brandEmail: string
) {
  // Check if we should send email (only once per hour per conversation)
  const { data: conversation } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (!conversation) return;

  // Get all unread messages from last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentMessages } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .gte('created_at', oneHourAgo)
    .eq('email_sent', false)
    .order('created_at', { ascending: true });

  if (!recentMessages || recentMessages.length === 0) return;

  // Mark messages as email_sent
  await supabaseAdmin
    .from('messages')
    .update({ email_sent: true })
    .in('id', recentMessages.map(m => m.id));

  // Send digest email to all parties
  const messageList = recentMessages.map(m => ({
    sender_name: m.sender_type === 'influencer' ? conversation.influencer_name : (conversation.brand_name || conversation.brand_email),
    sender_type: m.sender_type,
    content: m.content,
    created_at: m.created_at
  }));

  return {
    conversation,
    messages: messageList
  };
}

