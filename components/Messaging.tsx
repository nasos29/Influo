"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
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
  last_activity_influencer?: string | null;
  last_activity_brand?: string | null;
  closed_at?: string | null;
}

interface ProposalInfo {
  id: number;
  brand_name: string;
  brand_email: string;
  budget: string;
  service_type: string;
  status: string;
  counter_proposal_budget?: string | null;
  counter_proposal_status?: string | null;
  influencer_agreement_accepted?: boolean;
  brand_agreement_accepted?: boolean;
}

interface MessagingProps {
  influencerId: string;
  influencerName: string;
  influencerEmail: string;
  brandEmail?: string;
  brandName?: string;
  proposalId?: number;
  mode: 'influencer' | 'brand';
  lang?: 'el' | 'en';
}

const t = {
  el: {
    placeholder: "Γράψε το μήνυμά σου...",
    online: "Online",
    offline: "Offline",
    offlineNotice: "💬 Ο influencer είναι offline. Το μήνυμα θα σταλεί ως email.",
    brandOfflineNotice: "💬 Η επιχείρηση είναι offline. Το μήνυμα θα σταλεί ως email.",
    sending: "Αποστολή...",
    send: "Αποστολή",
    messages: "Μηνύματα",
    noConversations: "Δεν υπάρχουν συνομιλίες ακόμα",
    selectConversation: "Επέλεξε μια συνομιλία για να δεις τα μηνύματα",
    endConversation: "Τέλος συνομιλίας",
    endingConversation: "Τερματισμός...",
    inactivityWarning: "⚠️ Η συνομιλία είναι αδρανής και από τις δύο πλευρές. Η συνομιλία θα κλείσει αυτόματα σε 5 λεπτά.",
    conversationClosed: "Η συνομιλία έκλεισε.",
    conversationClosedInactivity: "Η συνομιλία έκλεισε λόγω αδράνειας.",
    acceptAgreement: "✅ Αποδοχή Συμφωνίας",
    agreementTitle: "Συμφωνία Συνεργασίας",
    agreementCancel: "Ακύρωση",
    agreementAccept: "Αποδοχή Συμφωνίας",
    agreementSaving: "Αποθήκευση...",
    agreementAccepted: "✅ Συμφωνία Αποδεκτή",
    agreementPending: "⏳ Αναμονή Αποδοχής"
  },
  en: {
    placeholder: "Type your message...",
    online: "Online",
    offline: "Offline",
    offlineNotice: "💬 The influencer is offline. Message will be sent via email.",
    brandOfflineNotice: "💬 The brand is offline. Message will be sent via email.",
    sending: "Sending...",
    send: "Send",
    messages: "Messages",
    noConversations: "No conversations yet",
    selectConversation: "Select a conversation to view messages",
    endConversation: "End Conversation",
    endingConversation: "Ending...",
    inactivityWarning: "⚠️ The conversation is inactive on both sides. The conversation will close automatically in 5 minutes.",
    conversationClosed: "The conversation has been closed.",
    conversationClosedInactivity: "The conversation has been closed due to inactivity.",
    acceptAgreement: "✅ Accept Agreement",
    agreementTitle: "Collaboration Agreement",
    agreementCancel: "Cancel",
    agreementAccept: "Accept Agreement",
    agreementSaving: "Saving...",
    agreementAccepted: "✅ Agreement Accepted",
    agreementPending: "⏳ Pending Acceptance"
  }
};

export default function Messaging({
  influencerId,
  influencerName,
  influencerEmail,
  brandEmail,
  brandName,
  proposalId,
  mode,
  lang = 'el'
}: MessagingProps) {
  const txt = t[lang];
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [isInfluencerOnline, setIsInfluencerOnline] = useState(false);
  const [isBrandOnline, setIsBrandOnline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSentMessageRef = useRef<string>('');
  const [proposalInfo, setProposalInfo] = useState<ProposalInfo | null>(null);
  const [lastActivityInfluencer, setLastActivityInfluencer] = useState<Date | null>(null);
  const [lastActivityBrand, setLastActivityBrand] = useState<Date | null>(null);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [conversationClosed, setConversationClosed] = useState(false);
  const [conversationClosedByInactivity, setConversationClosedByInactivity] = useState(false);
  const [endingConversation, setEndingConversation] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [savingAgreement, setSavingAgreement] = useState(false);
  const activityCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityUpdateRef = useRef<number>(0);
  const warningStartTimeRef = useRef<number | null>(null);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ACTIVITY_UPDATE_THROTTLE = 30000; // Update at most once per 30 seconds

  // Load proposal info if proposalId is provided
  useEffect(() => {
    if (proposalId) {
      loadProposalInfo();
    }
  }, [proposalId]);

  // Load conversations
  useEffect(() => {
    loadConversations();
  }, [mode]);

  // Auto-select conversation when proposalId and brandEmail are provided
  useEffect(() => {
    if (proposalId && brandEmail && conversations.length > 0) {
      const matchingConv = conversations.find(c => c.brand_email === brandEmail);
      if (matchingConv) {
        setSelectedConversation(matchingConv.id);
      }
    }
  }, [proposalId, brandEmail, conversations]);

  // Track online status for influencer mode
  useEffect(() => {
    if (mode === 'influencer' && influencerId) {
      // Update immediately when component mounts
      updateOnlineStatus();
      // Update status every 15 seconds (more frequent for better accuracy)
      const interval = setInterval(updateOnlineStatus, 15000);
      // Mark as offline when component unmounts
      return () => {
        clearInterval(interval);
        markOffline();
      };
    } else if (mode === 'brand') {
      // Track brand online status - use brandEmail prop or get from conversations
      const updateBrandStatus = () => {
        const emailToUpdate = brandEmail || (selectedConversation
          ? conversations.find(c => c.id === selectedConversation)?.brand_email
          : null);
        if (emailToUpdate) {
          updateBrandOnlineStatus(emailToUpdate);
        }
      };
      
      updateBrandStatus();
      // Update status every 15 seconds (more frequent for better accuracy)
      const interval = setInterval(updateBrandStatus, 15000);
      // Mark as offline when component unmounts
      return () => {
        clearInterval(interval);
        const emailToMark = brandEmail || (selectedConversation
          ? conversations.find(c => c.id === selectedConversation)?.brand_email
          : null);
        if (emailToMark) {
          markBrandOffline(emailToMark);
        }
      };
    }
  }, [mode, influencerId, brandEmail, selectedConversation, conversations]);

  // Define checkInactivity BEFORE it's used in useEffect
  // SIMPLIFIED APPROACH: Use last_message_at instead of activity timestamps
  // This avoids all the issues with timestamps being auto-updated
  const checkInactivity = useCallback(async () => {
    if (!selectedConversation || conversationClosed) return;

    try {
      // Just check last_message_at - if no message for 5+ minutes, show warning
      const { data: conv, error } = await supabase
        .from('conversations')
        .select('last_message_at,closed_at')
        .eq('id', selectedConversation)
        .single();

      if (error || !conv || conv.closed_at) {
        if (conv?.closed_at) setConversationClosed(true);
        return;
      }

      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const lastMessageTime = conv.last_message_at ? new Date(conv.last_message_at) : null;
      const isInactive = !lastMessageTime || lastMessageTime < fiveMinutesAgo;

        if (isInactive) {
        setShowInactivityWarning(prev => {
          if (!prev) {
            warningStartTimeRef.current = Date.now();
            return true;
          }
          return prev;
        });
      } else {
        setShowInactivityWarning(prev => {
          if (prev) {
            warningStartTimeRef.current = null;
            return false;
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('[Check Inactivity] Error:', error);
    }
  }, [selectedConversation, conversationClosed]);

  // Define endConversation BEFORE it's used in useEffect
  const endConversation = useCallback(async (autoClose = false) => {
    if (!selectedConversation || endingConversation) {
      console.log('[End Conversation] Skipping - no selected conversation or already ending');
      return;
    }

    console.log('[End Conversation] Called with autoClose:', autoClose, 'conversationId:', selectedConversation);

    if (!autoClose && !confirm(lang === 'el' 
      ? 'Είστε σίγουρος ότι θέλετε να τερματίσετε τη συνομιλία; Θα σταλεί email σε όλους με ολόκληρη τη συνομιλία.'
      : 'Are you sure you want to end the conversation? An email will be sent to everyone with the full conversation.')) {
      return;
    }

    setEndingConversation(true);
    try {
      console.log('[End Conversation] Calling API...');
      const response = await fetch('/api/conversations/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation,
          autoClose,
        })
      });

      const result = await response.json();
      
      console.log('[End Conversation] API response:', { ok: response.ok, success: result.success, error: result.error });
      
      if (!response.ok || !result.success) {
        const errorMsg = result.error || `HTTP ${response.status}: ${response.statusText}`;
        console.error('[End Conversation] Error response:', result);
        throw new Error(errorMsg);
      }

      setConversationClosed(true);
      setConversationClosedByInactivity(autoClose);
      setShowInactivityWarning(false);
      warningStartTimeRef.current = null;
      
      if (!autoClose) {
        alert(lang === 'el' 
          ? 'Η συνομιλία έκλεισε. Έχει σταλεί email σε όλους με ολόκληρη τη συνομιλία.'
          : 'Conversation closed. An email has been sent to everyone with the full conversation.');
      } else {
        alert(lang === 'el' 
          ? 'Η συνομιλία έκλεισε λόγω αδράνειας. Έχει σταλεί email σε όλους με ολόκληρη τη συνομιλία.'
          : 'Conversation closed due to inactivity. An email has been sent to everyone with the full conversation.');
      }
    } catch (error) {
      console.error('[End Conversation] Error:', error);
      alert(lang === 'el' 
        ? 'Αποτυχία τερματισμού συνομιλίας. Παρακαλώ δοκιμάστε ξανά.'
        : 'Failed to end conversation. Please try again.');
    } finally {
      setEndingConversation(false);
    }
  }, [selectedConversation, endingConversation, lang]);

  // Load messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      // Reset flags but don't reset conversationClosed - let loadActivityTimestamps check it
      setConversationClosedByInactivity(false);
      setShowInactivityWarning(false);
      warningStartTimeRef.current = null;
      
      // Load activity timestamps FIRST to check if conversation is closed, then load messages
      // IMPORTANT: Even if conversation is closed, the textarea will remain visible
      (async () => {
        await loadActivityTimestamps(selectedConversation);
        await loadMessages(selectedConversation);
      })();
      // NOTE: We do NOT update activity timestamp when opening conversation
      // Activity should only be updated on actual user actions (typing, sending, etc.)
      // Set up real-time subscription
      const subscription = supabase
        .channel(`messages:${selectedConversation}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation}`
        }, (payload) => {
          const newMsg = payload.new as Message;
          // Only play sound if this is not the message we just sent (to avoid double beep)
          const isOurMessage = lastSentMessageRef.current && 
            newMsg.content.trim() === lastSentMessageRef.current;
          
          if (!isOurMessage) {
            playNotificationSound();
          } else {
            // Clear the ref after checking
            lastSentMessageRef.current = '';
          }
          
          setMessages((prev) => [...prev, newMsg]);
          scrollToBottom();
        })
        .subscribe();

      // Update activity timestamp periodically while conversation is open
      // This keeps the user's online status current
      const activityInterval = setInterval(() => {
        updateActivityTimestamp();
      }, 30000); // Every 30 seconds

      return () => {
        subscription.unsubscribe();
        clearInterval(activityInterval);
      };
    }
  }, [selectedConversation]);


  // Check for inactivity every 1 minute (more frequent checks for better UX)
  useEffect(() => {
    if (selectedConversation && !conversationClosed) {
      // Check immediately
      checkInactivity();
      
      // Then check every 1 minute for more responsive inactivity detection
      // NOTE: We do NOT update activity timestamp here - only check for inactivity
      // Activity timestamps should only be updated on user actions (typing, sending, etc.)
      activityCheckIntervalRef.current = setInterval(() => {
        checkInactivity();
      }, 60 * 1000); // 1 minute

      return () => {
        if (activityCheckIntervalRef.current) {
          clearInterval(activityCheckIntervalRef.current);
          activityCheckIntervalRef.current = null;
        }
      };
    }
  }, [selectedConversation, conversationClosed, checkInactivity]);

  // Auto-close conversation after 5 minutes of inactivity warning
  // When warning appears, both parties have been inactive for 5+ minutes
  // After another 5 minutes, the conversation auto-closes
  useEffect(() => {
    // Clear any existing timer first
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }

    if (showInactivityWarning && !conversationClosed) {
      // Record when warning started (only if not already set)
      if (!warningStartTimeRef.current) {
        warningStartTimeRef.current = Date.now();
      }
      
      // Calculate remaining time based on when warning started
      const elapsed = Date.now() - (warningStartTimeRef.current || Date.now());
      const remaining = Math.max(0, 5 * 60 * 1000 - elapsed); // 5 minutes total
      
      console.log('[Auto-Close] Setting timer:', { 
        elapsed: Math.round(elapsed / 1000), 
        remaining: Math.round(remaining / 1000),
        willCloseIn: Math.round(remaining / 1000) + 's'
      });
      
      // Set timer for remaining time (or full 5 minutes if just started)
      autoCloseTimerRef.current = setTimeout(() => {
        console.log('[Auto-Close] Timer fired, closing conversation...');
        autoCloseTimerRef.current = null;
        endConversation(true); // Auto-close after 5 minutes of warning
      }, remaining);

      return () => {
        if (autoCloseTimerRef.current) {
          clearTimeout(autoCloseTimerRef.current);
          autoCloseTimerRef.current = null;
        }
      };
    } else {
      // Reset warning start time if warning disappears
      warningStartTimeRef.current = null;
    }
  }, [showInactivityWarning, conversationClosed, endConversation]);

  // Client-side polling to check if conversation should be closed
  // This works even with Vercel Hobby plan (daily cron limit)
  // When user is online, we poll every 5 minutes and trigger server-side check if needed
  useEffect(() => {
    if (!selectedConversation || conversationClosed) return;

    // Poll the check endpoint every 5 minutes when user has an open conversation
    // If conversation is inactive, trigger the cron endpoint to close it
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/conversations/check-inactive?conversationId=${selectedConversation}`, {
          method: 'GET'
        });
        
        if (response.ok) {
          const result = await response.json();
          
          // If conversation is inactive and not closed, trigger the cron endpoint to close it
          if (result.isInactive && !result.isClosed) {
            // The cron endpoint will handle the actual closing
            // We just trigger it (it will check authorization but Vercel Cron headers are not required for this)
            try {
              await fetch('/api/cron/check-inactive-conversations', {
                method: 'GET',
                // Note: This might fail if CRON_SECRET is required, but that's ok
                // The daily Vercel cron will handle it eventually
              }).catch(() => {
                // Ignore - daily cron will handle it
              });
            } catch {
              // Ignore - daily cron will handle it
            }
          }
          
          // Refresh conversation state to reflect any closures
          if (selectedConversation) {
            await loadActivityTimestamps(selectedConversation);
            await loadConversations();
          }
        }
      } catch (error) {
        console.error('[Client Polling] Error:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    // Also check immediately
    (async () => {
      try {
        const response = await fetch(`/api/conversations/check-inactive?conversationId=${selectedConversation}`, {
          method: 'GET'
        });
        if (response.ok) {
          const result = await response.json();
          if (result.isClosed) {
            setConversationClosed(true);
          }
        }
      } catch (error) {
        console.error('[Client Polling] Initial check error:', error);
      }
    })();

    return () => clearInterval(pollInterval);
  }, [selectedConversation, conversationClosed]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('conversations')
        .select('*');

      if (mode === 'influencer') {
        query = query.eq('influencer_id', influencerId);
      } else if (mode === 'brand' && brandEmail) {
        query = query.eq('brand_email', brandEmail);
      }

      // Order: open conversations first (nulls), then by last_message_at desc
      const { data, error } = await query
        .order('closed_at', { ascending: true, nullsFirst: true })
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('[Load Conversations] ❌ ERROR:', error);
        throw error;
      }
      
      setConversations(data || []);

      // Auto-select first conversation or create new if brandEmail provided
      if (mode === 'brand' && brandEmail && data && data.length === 0 && influencerId) {
        // Will create conversation when first message is sent
      } else if (data && data.length > 0 && !selectedConversation) {
        setSelectedConversation(data[0].id);
        // Check brand status immediately when first conversation is auto-selected
        if (mode === 'influencer' && data[0]?.brand_email) {
          setTimeout(() => checkBrandStatus(data[0].brand_email), 100);
        }
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProposalInfo = async () => {
    if (!proposalId) return;
    try {
      const { data, error } = await supabase
        .from('proposals')
        .select('id, brand_name, brand_email, budget, service_type, status, counter_proposal_budget, counter_proposal_status, influencer_agreement_accepted, brand_agreement_accepted')
        .eq('id', proposalId)
        .single();

      if (error) throw error;
      if (data) {
        setProposalInfo(data as ProposalInfo);
      }
    } catch (error) {
      console.error('Error loading proposal info:', error);
    }
  };

  // Check if user needs to accept agreement
  const needsAgreement = proposalInfo && 
    (proposalInfo.status === 'accepted' || proposalInfo.status === 'completed') &&
    ((mode === 'influencer' && !proposalInfo.influencer_agreement_accepted) ||
     (mode === 'brand' && !proposalInfo.brand_agreement_accepted));

  // Check if agreement is already accepted
  const hasAgreement = proposalInfo && 
    (proposalInfo.status === 'accepted' || proposalInfo.status === 'completed') &&
    ((mode === 'influencer' && proposalInfo.influencer_agreement_accepted) ||
     (mode === 'brand' && proposalInfo.brand_agreement_accepted));

  // Check if both parties accepted
  const bothAccepted = proposalInfo && 
    proposalInfo.influencer_agreement_accepted && 
    proposalInfo.brand_agreement_accepted;

  const handleAcceptAgreement = async () => {
    if (!proposalId || !agreementAccepted) {
      alert(lang === 'el' 
        ? 'Παρακαλώ διαβάστε και αποδεχτείτε τους όρους χρήσης'
        : 'Please read and accept the terms of service');
      return;
    }

    setSavingAgreement(true);
    try {
      const response = await fetch('/api/proposals/agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: proposalId,
          userType: mode, // 'influencer' or 'brand'
          accepted: true
        })
      });

      const result = await response.json();
      if (result.success) {
        // Reload proposal info to get updated status
        await loadProposalInfo();
        setShowAgreementModal(false);
        setAgreementAccepted(false);
        alert(lang === 'el'
          ? mode === 'influencer'
            ? 'Η συμφωνία αποδεχτήθηκε! Το brand θα προστεθεί στις συνεργασίες σας όταν και το brand αποδεχτεί.'
            : 'Η συμφωνία αποδεχτήθηκε! Θα προστεθείτε στις συνεργασίες του influencer όταν και ο influencer αποδεχτεί.'
          : mode === 'influencer'
            ? 'Agreement accepted! The brand will be added to your collaborations once the brand also accepts.'
            : 'Agreement accepted! You will be added to the influencer\'s collaborations once the influencer also accepts.');
      } else {
        throw new Error(result.error || (lang === 'el' ? 'Σφάλμα αποδοχής συμφωνίας' : 'Error accepting agreement'));
      }
    } catch (error: any) {
      console.error('Error accepting agreement:', error);
      alert(lang === 'el' 
        ? 'Σφάλμα: ' + error.message 
        : 'Error: ' + error.message);
    } finally {
      setSavingAgreement(false);
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
      
      // Mark messages as read when loaded (only for messages sent by the other party)
      if (data && data.length > 0) {
        const unreadMessages = data.filter(msg => 
          !msg.read && msg.sender_type !== mode
        );
        
        if (unreadMessages.length > 0) {
          // Mark all unread messages from the other party as read
          const messageIds = unreadMessages.map(msg => msg.id);
          await supabase
            .from('messages')
            .update({ read: true })
            .in('id', messageIds);
          
          // Trigger a custom event to update unread count in parent component
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('messagesRead', { 
              detail: { conversationId: convId, count: unreadMessages.length } 
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      let convId = selectedConversation;

      // If we have a conversationId (even if closed), send with conversationId so backend can reopen it
      // Only send without conversationId if we don't have one at all
      if (convId) {
        // Send message to existing conversation (backend will reopen if closed)
        // Send message to existing conversation
        const senderId = mode === 'influencer' ? influencerId : brandEmail!;
        
        // If brand is sending and influencer is offline, send via email
        // Get influencer email from the current conversation if not provided as prop
        if (mode === 'brand' && !isInfluencerOnline && selectedConversation) {
          try {
            // Get influencer email from conversation
            const currentConv = conversations.find(c => c.id === selectedConversation);
            const targetInfluencerEmail = currentConv?.influencer_email || influencerEmail;
            const targetInfluencerName = currentConv?.influencer_name || influencerName;
            
            // Only send email if we have a valid influencer email
            if (!targetInfluencerEmail) {
              console.warn('[Messaging] Cannot send offline email: influencer email not found');
              return;
            }
            
            const emailPayload = {
              type: 'message_offline',
              toEmail: targetInfluencerEmail,
              influencerName: targetInfluencerName,
              brandName: brandName || brandEmail,
              message: newMessage,
              conversationId: convId,
            };
            
            const emailResponse = await fetch('/api/emails', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(emailPayload)
            });
            
            if (!emailResponse.ok) {
              const errorData = await emailResponse.json();
              console.error('[Messaging] Offline email failed:', errorData);
            }
          } catch (emailError) {
            console.error('[Messaging] Offline email error:', emailError);
          }
        }
        
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: convId,
            senderId,
            senderType: mode,
            content: newMessage,
            sendViaEmail: mode === 'brand' && !isInfluencerOnline,
          })
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        
        // Update online status when sending message
        if (mode === 'influencer' && influencerId) {
          updateOnlineStatus();
        } else if (mode === 'brand') {
          const emailToUpdate = brandEmail || (selectedConversation
            ? conversations.find(c => c.id === selectedConversation)?.brand_email
            : null);
          if (emailToUpdate) {
            updateBrandOnlineStatus(emailToUpdate);
          }
        }
        
        // Play sound when message is sent (single beep)
        lastSentMessageRef.current = newMessage.trim();
        playSendSound();
        
        // Reset conversation closed state immediately - backend has reopened it
        setConversationClosed(false);
        setConversationClosedByInactivity(false);
        setShowInactivityWarning(false);
        
        // Refresh conversation state to reflect reopened status
        // Small delay to ensure backend has processed the update
        await new Promise(resolve => setTimeout(resolve, 100));
        await loadConversations();
        await loadActivityTimestamps(convId); // This will check if conversation is still closed and update state accordingly
        await loadMessages(convId); // Refresh messages
      } else if (influencerId && brandEmail) {
        // No conversation exists - create new one
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            influencerId,
            brandEmail,
            brandName: brandName || brandEmail,
            senderType: mode,
            content: newMessage,
          })
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        
        convId = result.conversationId;
        
        // Update online status when sending message
        if (mode === 'influencer' && influencerId) {
          updateOnlineStatus();
        } else if (mode === 'brand') {
          const emailToUpdate = brandEmail || (selectedConversation
            ? conversations.find(c => c.id === selectedConversation)?.brand_email
            : null);
          if (emailToUpdate) {
            updateBrandOnlineStatus(emailToUpdate);
          }
        }
        
        // Refresh conversations list to show new conversation
        await loadConversations();
        
        // Select the new conversation
        if (convId) {
          setSelectedConversation(convId);
          setConversationClosed(false);
          setConversationClosedByInactivity(false);
        }
      }

      setNewMessage('');
      if (convId) {
        // Select the conversation if it was reopened
        if (convId !== selectedConversation) {
          setSelectedConversation(convId);
        }
        // Refresh conversations list to show reopened conversation
        await loadConversations();
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

  // Sound when receiving a message
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Soft, pleasant tone for incoming messages
      oscillator.frequency.value = 700;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.12);
    } catch (error) {
      console.log('Sound notification');
    }
  };

  // Sound when sending a message - single, distinct beep
  const playSendSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Distinct, slightly higher tone for sent messages
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      // Quick, crisp beep
      gainNode.gain.setValueAtTime(0.06, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.08);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.08);
    } catch (error) {
      console.log('Send sound notification');
    }
  };

  const checkInfluencerStatus = async (idToCheck?: string) => {
    // Use provided ID or get from current conversation or use prop
    const id = idToCheck || (mode === 'brand' && selectedConversation
      ? conversations.find(c => c.id === selectedConversation)?.influencer_id
      : influencerId);
    
    if (!id) {
      setIsInfluencerOnline(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('influencer_presence')
        .select('is_online, last_seen')
        .eq('influencer_id', id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking influencer status:', error);
        setIsInfluencerOnline(false);
        return;
      }

      if (data) {
        // Consider online if last seen within 5 minutes
        const lastSeen = new Date(data.last_seen);
        const now = new Date();
        const minutesSinceLastSeen = (now.getTime() - lastSeen.getTime()) / 60000;
        const isOnline = data.is_online && minutesSinceLastSeen < 5;
        setIsInfluencerOnline(isOnline);
        console.log('[Influencer Status]', { influencerId: id, isOnline, lastSeen: data.last_seen, minutesSinceLastSeen });
      } else {
        setIsInfluencerOnline(false);
        console.log('[Influencer Status] No data found for:', id);
      }
    } catch (error) {
      console.error('Error checking influencer status:', error);
      setIsInfluencerOnline(false);
    }
  };

  const updateOnlineStatus = async () => {
    if (!influencerId) return;
    await updateOnlineStatusForId(influencerId);
  };

  const updateOnlineStatusForId = async (id: string) => {
    if (!id) return;
    try {
      const result = await supabase
        .from('influencer_presence')
        .upsert({
          influencer_id: id,
          is_online: true,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'influencer_id'
        });
      
      if (result.error) {
        console.error('Error updating influencer online status:', result.error);
      } else {
        console.log('[Influencer Status] Updated presence for:', id);
      }
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  };

  const markOffline = async () => {
    try {
      await supabase
        .from('influencer_presence')
        .update({
          is_online: false,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('influencer_id', influencerId);
    } catch (error) {
      console.error('Error marking offline:', error);
    }
  };

  const checkBrandStatus = async (emailToCheck?: string) => {
    // Use provided email or get from current conversation
    const email = emailToCheck || (mode === 'influencer' && selectedConversation 
      ? conversations.find(c => c.id === selectedConversation)?.brand_email 
      : brandEmail);
    
    if (!email) {
      setIsBrandOnline(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('brand_presence')
        .select('is_online, last_seen')
        .eq('brand_email', email.toLowerCase().trim())
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking brand status:', error);
        setIsBrandOnline(false);
        return;
      }

      if (data) {
        // Consider online if last seen within 5 minutes
        const lastSeen = new Date(data.last_seen);
        const now = new Date();
        const minutesSinceLastSeen = (now.getTime() - lastSeen.getTime()) / 60000;
        const isOnline = data.is_online && minutesSinceLastSeen < 5;
        setIsBrandOnline(isOnline);
        console.log('[Brand Status]', { email, isOnline, lastSeen: data.last_seen, minutesSinceLastSeen });
      } else {
        setIsBrandOnline(false);
        console.log('[Brand Status] No data found for:', email);
      }
    } catch (error) {
      console.error('Error checking brand status:', error);
      setIsBrandOnline(false);
    }
  };

  const updateBrandOnlineStatus = async (emailToUpdate?: string) => {
    // Use provided email, or get from current conversation, or use prop
    const email = emailToUpdate || (mode === 'influencer' && selectedConversation
      ? conversations.find(c => c.id === selectedConversation)?.brand_email
      : brandEmail);
    
    if (!email) return;
    
    try {
      const result = await supabase
        .from('brand_presence')
        .upsert({
          brand_email: email.toLowerCase().trim(),
          is_online: true,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'brand_email'
        });
      
      if (result.error) {
        console.error('Error updating brand online status:', result.error);
      } else {
        console.log('[Brand Status] Updated presence for:', email);
      }
    } catch (error) {
      console.error('Error updating brand online status:', error);
    }
  };

  const markBrandOffline = async (emailToMark?: string) => {
    const email = emailToMark || brandEmail || (mode === 'influencer' && selectedConversation
      ? conversations.find(c => c.id === selectedConversation)?.brand_email
      : null);
    
    if (!email) return;
    
    try {
      await supabase
        .from('brand_presence')
        .update({
          is_online: false,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('brand_email', email.toLowerCase().trim());
    } catch (error) {
      console.error('Error marking brand offline:', error);
    }
  };

  const loadActivityTimestamps = async (convId: string) => {
    try {
      const { data: conv, error } = await supabase
        .from('conversations')
        .select('last_activity_influencer,last_activity_brand,closed_at')
        .eq('id', convId)
        .single();

      if (error) {
        console.error('[Load Activity] Error:', error);
        return;
      }

      if (conv) {
        // IMPORTANT: Even if conversation is closed, we DON'T prevent user from sending messages
        // The textarea should always be visible when a conversation is selected
        // Setting conversationClosed only affects UI messages, not the textarea visibility
        if (conv.closed_at) {
          setConversationClosed(true);
          // Note: closed_by_inactivity column may not exist in database
          setConversationClosedByInactivity(false);
        } else {
          setConversationClosed(false);
        }
        
        // Initialize activity timestamps if they don't exist
        const now = new Date().toISOString();
        const updates: any = {};
        
        if (!conv.last_activity_influencer && mode === 'influencer') {
          updates.last_activity_influencer = now;
          setLastActivityInfluencer(new Date());
        } else if (conv.last_activity_influencer) {
          setLastActivityInfluencer(new Date(conv.last_activity_influencer));
        }
        
        if (!conv.last_activity_brand && mode === 'brand') {
          updates.last_activity_brand = now;
          setLastActivityBrand(new Date());
        } else if (conv.last_activity_brand) {
          setLastActivityBrand(new Date(conv.last_activity_brand));
        }
        
        // Update database if we initialized timestamps
        if (Object.keys(updates).length > 0) {
          await supabase
            .from('conversations')
            .update(updates)
            .eq('id', convId);
        }
      }
    } catch (error) {
      console.error('Error loading activity timestamps:', error);
    }
  };

  const updateActivityTimestamp = async (force = false) => {
    if (!selectedConversation) {
      return;
    }
    
    // Throttle updates to avoid too many database writes
    const now = Date.now();
    if (!force && (now - lastActivityUpdateRef.current) < ACTIVITY_UPDATE_THROTTLE) {
      // Update local state but skip database update
      if (mode === 'influencer') {
        setLastActivityInfluencer(new Date());
      } else {
        setLastActivityBrand(new Date());
      }
      return;
    }
    
    lastActivityUpdateRef.current = now;
    
    try {
      const updateField = mode === 'influencer' ? 'last_activity_influencer' : 'last_activity_brand';
      const timestamp = new Date().toISOString();
      
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ [updateField]: timestamp })
        .eq('id', selectedConversation);

      if (updateError) {
        console.error('[Activity] Database update error:', updateError);
        return;
      }

      // Also update presence table to keep user online status current
      if (mode === 'influencer' && influencerId) {
        updateOnlineStatus();
      } else if (mode === 'brand') {
        // For brand mode, update brand presence
        const emailToUpdate = brandEmail || (selectedConversation
          ? conversations.find(c => c.id === selectedConversation)?.brand_email
          : null);
        if (emailToUpdate) {
          updateBrandOnlineStatus(emailToUpdate);
        }
        // Also update influencer presence if we have influencer_id from conversation
        const influencerIdToUpdate = influencerId || (selectedConversation
          ? conversations.find(c => c.id === selectedConversation)?.influencer_id
          : null);
        if (influencerIdToUpdate) {
          updateOnlineStatusForId(influencerIdToUpdate);
        }
      }

      if (mode === 'influencer') {
        setLastActivityInfluencer(new Date());
      } else {
        setLastActivityBrand(new Date());
      }
    } catch (error) {
      console.error('[Activity] Exception updating activity timestamp:', error);
    }
  };

  const currentConversation = conversations.find(c => c.id === selectedConversation);
  const otherPartyName = mode === 'influencer' 
    ? currentConversation?.brand_name || currentConversation?.brand_email
    : currentConversation?.influencer_name;

  // Debug: Log current conversation info
  useEffect(() => {
    if (mode === 'influencer' && selectedConversation) {
      console.log('[Brand Status] Current conversation:', {
        selectedConversation,
        currentConversation: currentConversation?.brand_email,
        brandEmail: brandEmail,
        isBrandOnline
      });
    } else if (mode === 'brand' && selectedConversation) {
      console.log('[Influencer Status] Current conversation:', {
        selectedConversation,
        currentConversation: currentConversation?.influencer_id,
        influencerId: influencerId,
        isInfluencerOnline
      });
    }
  }, [selectedConversation, currentConversation?.brand_email, currentConversation?.influencer_id, brandEmail, influencerId, isBrandOnline, isInfluencerOnline, mode]);

  // Check influencer status when conversation changes (for brand mode)
  useEffect(() => {
    if (mode === 'brand') {
      if (selectedConversation) {
        const conv = conversations.find(c => c.id === selectedConversation);
        const idToCheck = conv?.influencer_id || influencerId;
        console.log('[Influencer Status] useEffect triggered:', {
          selectedConversation,
          hasConv: !!conv,
          influencerId: conv?.influencer_id,
          propInfluencerId: influencerId,
          idToCheck
        });
        if (idToCheck) {
          console.log('[Influencer Status] Checking status for conversation:', idToCheck);
          checkInfluencerStatus(idToCheck);
          // Poll every 15 seconds to check influencer online status
          const interval = setInterval(() => {
            const currentConv = conversations.find(c => c.id === selectedConversation);
            const id = currentConv?.influencer_id || influencerId;
            if (id) {
              checkInfluencerStatus(id);
            }
          }, 15000);
          return () => clearInterval(interval);
        } else {
          console.log('[Influencer Status] No influencer_id in conversation or prop');
          setIsInfluencerOnline(false);
        }
      } else if (influencerId) {
        // If no conversation selected but influencerId prop exists, check it
        console.log('[Influencer Status] Checking status from prop:', influencerId);
        checkInfluencerStatus(influencerId);
        const interval = setInterval(() => {
          checkInfluencerStatus(influencerId);
        }, 15000);
        return () => clearInterval(interval);
      } else {
        setIsInfluencerOnline(false);
      }
    }
  }, [selectedConversation, conversations, mode, influencerId]);

  // Check brand status when conversation changes (for influencer mode)
  useEffect(() => {
    if (mode === 'influencer') {
      if (selectedConversation) {
        const conv = conversations.find(c => c.id === selectedConversation);
        const emailToCheck = conv?.brand_email || brandEmail;
        console.log('[Brand Status] useEffect triggered:', {
          selectedConversation,
          hasConv: !!conv,
          brandEmail: conv?.brand_email,
          propBrandEmail: brandEmail,
          emailToCheck
        });
        if (emailToCheck) {
          console.log('[Brand Status] Checking status for conversation:', emailToCheck);
          checkBrandStatus(emailToCheck);
          // Poll every 15 seconds to check brand online status
          const interval = setInterval(() => {
            const currentConv = conversations.find(c => c.id === selectedConversation);
            const email = currentConv?.brand_email || brandEmail;
            if (email) {
              checkBrandStatus(email);
            }
          }, 15000);
          return () => clearInterval(interval);
        } else {
          console.log('[Brand Status] No brand_email in conversation or prop');
          setIsBrandOnline(false);
        }
      } else if (brandEmail) {
        // If no conversation selected but brandEmail prop exists, check it
        console.log('[Brand Status] Checking status from prop:', brandEmail);
        checkBrandStatus(brandEmail);
        const interval = setInterval(() => {
          checkBrandStatus(brandEmail);
        }, 15000);
        return () => clearInterval(interval);
      } else {
        setIsBrandOnline(false);
      }
    }
  }, [selectedConversation, conversations, mode, brandEmail]);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 h-[600px] flex flex-col">
              {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <h2 className="text-xl font-bold text-slate-900">{txt.messages}</h2>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversations List */}
        <div className="w-64 border-r border-slate-200 overflow-y-auto bg-slate-50">
          {loading ? (
            <div className="p-4 text-center text-slate-500">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">{txt.noConversations}</div>
          ) : (
            conversations.map((conv) => {
              const isClosed = !!conv.closed_at;
              return (
                <button
                  key={conv.id}
                  onClick={() => {
                    setSelectedConversation(conv.id);
                  }}
                  className={`w-full text-left p-4 border-b border-slate-200 hover:bg-white transition-colors ${
                    selectedConversation === conv.id ? 'bg-white border-l-4 border-l-blue-600' : ''
                  } ${isClosed ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-900">
                      {mode === 'influencer' 
                        ? (conv.brand_name || conv.brand_email)
                        : conv.influencer_name}
                    </div>
                    {isClosed && (
                      <span className="text-xs text-red-600 font-medium">
                        {lang === 'el' ? 'Κλειστή' : 'Closed'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {new Date(conv.last_message_at).toLocaleDateString()}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="px-6 py-4 border-b border-slate-200 bg-white">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">{otherPartyName}</h3>
                  <div className="flex items-center gap-3">
                    {mode === 'brand' && (
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isInfluencerOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                        <span className="text-xs text-slate-500">
                          {isInfluencerOnline ? txt.online : txt.offline}
                        </span>
                      </div>
                    )}
                    {mode === 'influencer' && selectedConversation && (currentConversation?.brand_email || brandEmail) && (
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isBrandOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                        <span className="text-xs text-slate-500">
                          {isBrandOnline ? txt.online : txt.offline}
                        </span>
                      </div>
                    )}
                    {/* Agreement Button */}
                    {proposalInfo && needsAgreement && (
                      <button
                        onClick={() => setShowAgreementModal(true)}
                        className="px-4 py-1.5 text-sm bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
                      >
                        {txt.acceptAgreement}
                      </button>
                    )}
                    {proposalInfo && hasAgreement && !bothAccepted && (
                      <div className="px-4 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg font-medium">
                        {txt.agreementPending}
                      </div>
                    )}
                    {proposalInfo && bothAccepted && (
                      <div className="px-4 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg font-medium">
                        {txt.agreementAccepted}
                      </div>
                    )}
                    {!conversationClosed && (
                      <button
                        onClick={() => endConversation(false)}
                        disabled={endingConversation}
                        className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {endingConversation ? txt.endingConversation : txt.endConversation}
                      </button>
                    )}
                  </div>
                </div>
                {mode === 'brand' && influencerId && !isInfluencerOnline && !conversationClosed && (
                  <p className="text-xs text-amber-600 mt-1">
                    {txt.offlineNotice}
                  </p>
                )}
                {mode === 'influencer' && currentConversation?.brand_email && !isBrandOnline && !conversationClosed && (
                  <p className="text-xs text-amber-600 mt-1">
                    {txt.brandOfflineNotice}
                  </p>
                )}
                {showInactivityWarning && !conversationClosed && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">{txt.inactivityWarning}</p>
                  </div>
                )}
                {conversationClosed && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">
                      {conversationClosedByInactivity ? txt.conversationClosedInactivity : txt.conversationClosed}
                    </p>
                  </div>
                )}
                
                {/* Proposal Info Card */}
                {proposalInfo && (
                  <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-blue-900 mb-1">📋 Προσφορά Συνεργασίας</p>
                        <p className="text-sm text-blue-800">
                          <strong>{proposalInfo.service_type}</strong> • 
                          <span className="ml-1">Προσφερόμενη: <strong>{proposalInfo.budget}€</strong></span>
                          {proposalInfo.counter_proposal_budget && proposalInfo.counter_proposal_status === 'pending' && (
                            <span className="ml-2 text-amber-700">
                              • Αντιπρόταση: <strong>{proposalInfo.counter_proposal_budget}€</strong> ⏳
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          Status: <span className="capitalize">{proposalInfo.status}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
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

              {/* Message Input - ALWAYS VISIBLE when conversation is selected */}
              {/* CRITICAL: This form MUST always be visible when selectedConversation is set */}
              {/* conversationClosed only affects the message shown, NOT the visibility of the form */}
              <form 
                onSubmit={sendMessage} 
                className="px-6 py-4 border-t border-slate-200 bg-white"
                style={{ 
                  display: 'block', 
                  visibility: 'visible',
                  opacity: 1,
                  pointerEvents: 'auto'
                } as React.CSSProperties}
              >
                {conversationClosed && (
                  <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-700">
                      {lang === 'el' 
                        ? '💬 Η συνομιλία είναι κλειστή. Στείλε μήνυμα για να την ανοίξεις ξανά.'
                        : '💬 Conversation is closed. Send a message to reopen it.'}
                    </p>
                  </div>
                )}
                <div className="flex gap-3">
                  <textarea
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      // DO NOT update activity timestamp on typing
                      // Activity should only be updated when sending messages
                      // This prevents false activity detection
                    }}
                    placeholder={conversationClosed 
                      ? (lang === 'el' ? 'Γράψε μήνυμα για να ανοίξεις την συνομιλία...' : 'Type a message to reopen the conversation...')
                      : txt.placeholder}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-slate-900 bg-white"
                    rows={2}
                    disabled={false} // Always enabled, even for closed conversations
                    style={{ 
                      opacity: 1, 
                      pointerEvents: 'auto',
                      visibility: 'visible',
                      display: 'block'
                    } as React.CSSProperties}
                  />
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    {sending ? txt.sending : txt.send}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="flex-1 flex items-center justify-center text-slate-500">
                {txt.selectConversation}
              </div>
              
              {/* Show message input even without selected conversation if we have influencerId and brandEmail */}
              {influencerId && brandEmail && (
                <form onSubmit={sendMessage} className="px-6 py-4 border-t border-slate-200 bg-white">
                  <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-700">
                      {lang === 'el' 
                        ? '💬 Ξεκίνα νέα συνομιλία ή στείλε μήνυμα σε υπάρχουσα κλειστή συνομιλία.'
                        : '💬 Start a new conversation or send a message to an existing closed conversation.'}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={txt.placeholder}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-slate-900"
                      rows={2}
                    />
                    <button
                      type="submit"
                      disabled={sending || !newMessage.trim()}
                      className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                    >
                      {sending ? txt.sending : txt.send}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Agreement Modal */}
      {showAgreementModal && proposalInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">{txt.agreementTitle}</h2>
              <button 
                onClick={() => {
                  setShowAgreementModal(false);
                  setAgreementAccepted(false);
                }}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 font-medium mb-2">
                  {lang === 'el' ? 'Συνεργασία με:' : 'Collaboration with:'} <strong>
                    {mode === 'influencer' ? proposalInfo.brand_name : influencerName}
                  </strong>
                </p>
                <p className="text-sm text-blue-800">
                  {lang === 'el' ? 'Υπηρεσία:' : 'Service:'} {proposalInfo.service_type} • {lang === 'el' ? 'Budget:' : 'Budget:'} €{proposalInfo.counter_proposal_budget || proposalInfo.budget}
                </p>
              </div>

              {/* Benefits Section */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5 space-y-3">
                <h3 className="font-bold text-blue-900 text-lg flex items-center gap-2">
                  ✨ {lang === 'el' ? 'Γιατί να αποδεχτείτε τη συμφωνία;' : 'Why accept the agreement?'}
                </h3>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="flex items-start gap-2">
                    <span className="text-2xl">⭐</span>
                    <div>
                      <p className="font-semibold text-blue-900">{lang === 'el' ? 'Αξιολογήσεις & Reviews' : 'Ratings & Reviews'}</p>
                      <p className="text-sm text-blue-700">
                        {lang === 'el' 
                          ? 'Θα μπορείτε να λάβετε αξιολογήσεις που θα βελτιώσουν την αξιοπιστία σας'
                          : 'You will be able to receive ratings that will improve your credibility'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-2xl">📈</span>
                    <div>
                      <p className="font-semibold text-blue-900">{lang === 'el' ? 'Μεγαλύτερη Προβολή' : 'Greater Visibility'}</p>
                      <p className="text-sm text-blue-700">
                        {lang === 'el'
                          ? mode === 'influencer'
                            ? 'Το brand θα εμφανίζεται στις συνεργασίες σας, αυξάνοντας την προβολή σας'
                            : 'Θα εμφανίζεστε στις συνεργασίες του influencer, αυξάνοντας την προβολή σας'
                          : mode === 'influencer'
                            ? 'The brand will appear in your collaborations, increasing your visibility'
                            : 'You will appear in the influencer\'s collaborations, increasing your visibility'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-2xl">🎯</span>
                    <div>
                      <p className="font-semibold text-blue-900">{lang === 'el' ? 'Επαγγελματικός Προφίλ' : 'Professional Profile'}</p>
                      <p className="text-sm text-blue-700">
                        {lang === 'el' 
                          ? 'Περισσότερες συνεργασίες = πιο επαγγελματικό και αξιόπιστο προφίλ'
                          : 'More collaborations = more professional and trustworthy profile'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-2xl">💼</span>
                    <div>
                      <p className="font-semibold text-blue-900">{lang === 'el' ? 'Περισσότερες Ευκαιρίες' : 'More Opportunities'}</p>
                      <p className="text-sm text-blue-700">
                        {lang === 'el' 
                          ? 'Το portfolio σας μεγάλωνει και ελκύει περισσότερα brands'
                          : 'Your portfolio grows and attracts more brands'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-slate-900">{lang === 'el' ? 'Όροι Χρήσης & Συμφωνία' : 'Terms of Service & Agreement'}</h3>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-64 overflow-y-auto text-sm text-slate-700 space-y-3">
                  <p><strong>{lang === 'el' ? '1. Υποχρεώσεις:' : '1. Obligations:'}</strong></p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>{lang === 'el' ? 'Παροχή υψηλής ποιότητας περιεχομένου σύμφωνα με τις προδιαγραφές' : 'Provide high-quality content according to specifications'}</li>
                    <li>{lang === 'el' ? 'Σεβασμός προθεσμιών και deadlines' : 'Respect deadlines and timelines'}</li>
                    <li>{lang === 'el' ? 'Επικοινωνία για οποιαδήποτε απορία' : 'Communication for any questions'}</li>
                  </ul>

                  <p><strong>{lang === 'el' ? '2. Πληρωμή:' : '2. Payment:'}</strong></p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>{lang === 'el' ? 'Η πληρωμή θα γίνει σύμφωνα με τις προδιαγραφές της προσφοράς' : 'Payment will be made according to the proposal specifications'}</li>
                  </ul>

                  <p><strong>{lang === 'el' ? '3. Δικαιώματα:' : '3. Rights:'}</strong></p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>{lang === 'el' ? 'Δικαίωμα έγκρισης/απόρριψης περιεχομένου' : 'Right to approve/reject content'}</li>
                  </ul>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                    <p className="text-xs font-medium text-amber-900">
                      ⚠️ <strong>{lang === 'el' ? 'Σημαντικό:' : 'Important:'}</strong> {lang === 'el' ? 'Με την αποδοχή αυτής της συμφωνίας:' : 'By accepting this agreement:'}
                    </p>
                    <ul className="text-xs text-amber-800 mt-2 space-y-1 list-disc list-inside ml-2">
                      <li>{lang === 'el' ? 'Συμφωνείτε με τους παραπάνω όρους χρήσης' : 'You agree to the above terms of service'}</li>
                      <li>
                        {lang === 'el'
                          ? mode === 'influencer'
                            ? `Το όνομα του brand ${proposalInfo.brand_name} θα προστεθεί στις συνεργασίες σας (public)`
                            : `Θα προστεθείτε στις συνεργασίες του influencer (public)`
                          : mode === 'influencer'
                            ? `The brand ${proposalInfo.brand_name} will be added to your collaborations (public)`
                            : 'You will be added to the influencer\'s collaborations (public)'}
                      </li>
                      <li>{lang === 'el' ? 'Η συνεργασία θα εμφανίζεται στο προφίλ σας' : 'The collaboration will appear in your profile'}</li>
                    </ul>
                  </div>
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreementAccepted}
                    onChange={(e) => setAgreementAccepted(e.target.checked)}
                    className="mt-1 w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">
                    <strong>{lang === 'el' ? 'Αποδέχομαι τους όρους χρήσης' : 'I accept the terms of service'}</strong> {lang === 'el' ? 'και συμφωνώ να προστεθεί' : 'and agree to add'}
                    {mode === 'influencer' ? (
                      <> <strong>{proposalInfo.brand_name}</strong> {lang === 'el' ? 'στις συνεργασίες μου' : 'to my collaborations'}</>
                    ) : (
                      <> {lang === 'el' ? 'με στις συνεργασίες του influencer' : 'me to the influencer\'s collaborations'}</>
                    )}
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    setShowAgreementModal(false);
                    setAgreementAccepted(false);
                  }}
                  className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                >
                  {txt.agreementCancel}
                </button>
                <button
                  onClick={handleAcceptAgreement}
                  disabled={!agreementAccepted || savingAgreement}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
                >
                  {savingAgreement ? txt.agreementSaving : txt.agreementAccept}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

