"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: 'influencer' | 'brand';
  content: string;
  read: boolean;
  created_at: string;
}

interface Conversation {
  id: string;
  influencer_id: string;
  influencer_name: string;
  influencer_email: string;
  brand_email: string;
  brand_name: string | null;
  last_message_at: string;
}

interface MessagingProps {
  influencerId: string;
  influencerName: string;
  influencerEmail: string;
  brandEmail?: string;
  brandName?: string;
  mode: 'influencer' | 'brand';
}

export default function Messaging({
  influencerId,
  influencerName,
  influencerEmail,
  brandEmail,
  brandName,
  mode
}: MessagingProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations
  useEffect(() => {
    loadConversations();
  }, [influencerId, mode]);

  // Load messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation);
      // Set up real-time subscription
      const subscription = supabase
        .channel(`messages:${selectedConversation}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation}`
        }, (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          scrollToBottom();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [selectedConversation]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const query = supabase
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (mode === 'influencer') {
        query.eq('influencer_id', influencerId);
      } else if (mode === 'brand' && brandEmail) {
        query.eq('brand_email', brandEmail);
      }

      const { data, error } = await query;

      if (error) throw error;
      setConversations(data || []);

      // Auto-select first conversation or create new if brandEmail provided
      if (mode === 'brand' && brandEmail && data && data.length === 0 && influencerId) {
        // Will create conversation when first message is sent
      } else if (data && data.length > 0 && !selectedConversation) {
        setSelectedConversation(data[0].id);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (convId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      scrollToBottom();
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const currentConv = conversations.find(c => c.id === selectedConversation);
      
      let convId = selectedConversation;

      // Create conversation if it doesn't exist (for brand starting conversation)
      if (!convId && mode === 'brand' && influencerId && brandEmail) {
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            influencerId,
            brandEmail,
            brandName: brandName || brandEmail,
            senderType: 'brand',
            content: newMessage,
          })
        });

        const result = await response.json();
        if (result.success) {
          convId = result.conversationId;
          setSelectedConversation(convId);
          await loadConversations();
        }
      } else if (convId) {
        // Send message to existing conversation
        const senderId = mode === 'influencer' ? influencerId : brandEmail!;
        
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: convId,
            senderId,
            senderType: mode,
            content: newMessage,
          })
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error);
      }

      setNewMessage('');
      if (convId) {
        await loadMessages(convId);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const currentConversation = conversations.find(c => c.id === selectedConversation);
  const otherPartyName = mode === 'influencer' 
    ? currentConversation?.brand_name || currentConversation?.brand_email
    : currentConversation?.influencer_name;

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 h-[600px] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <h2 className="text-xl font-bold text-slate-900">Messages</h2>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversations List */}
        <div className="w-64 border-r border-slate-200 overflow-y-auto bg-slate-50">
          {loading ? (
            <div className="p-4 text-center text-slate-500">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">No conversations yet</div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv.id)}
                className={`w-full text-left p-4 border-b border-slate-200 hover:bg-white transition-colors ${
                  selectedConversation === conv.id ? 'bg-white border-l-4 border-l-blue-600' : ''
                }`}
              >
                <div className="font-semibold text-slate-900">
                  {mode === 'influencer' 
                    ? (conv.brand_name || conv.brand_email)
                    : conv.influencer_name}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {new Date(conv.last_message_at).toLocaleDateString()}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="px-6 py-4 border-b border-slate-200 bg-white">
                <h3 className="font-semibold text-slate-900">{otherPartyName}</h3>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
                {messages.map((msg) => {
                  const isOwn = (mode === 'influencer' && msg.sender_type === 'influencer') ||
                               (mode === 'brand' && msg.sender_type === 'brand');
                  
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                          isOwn
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-slate-900 border border-slate-200'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            isOwn ? 'text-blue-100' : 'text-slate-500'
                          }`}
                        >
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form onSubmit={sendMessage} className="px-6 py-4 border-t border-slate-200 bg-white">
                <div className="flex gap-3">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-slate-900"
                    rows={2}
                  />
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              {mode === 'brand' && !brandEmail
                ? 'Please provide brand email to start messaging'
                : 'Select a conversation or start a new one'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

