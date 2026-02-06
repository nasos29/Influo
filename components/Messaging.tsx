"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { displayNameForLang } from '@/lib/greeklish';

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
  onUnreadCountChange?: (count: number) => void;
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
    agreementPending: "⏳ Αναμονή Αποδοχής",
    agreementSummary: "Σύνοψη Συμφωνίας"
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
    agreementPending: "⏳ Pending Acceptance",
    agreementSummary: "Agreement Summary"
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
  lang = 'el',
  onUnreadCountChange
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
  const [showConversationsList, setShowConversationsList] = useState(false); // Mobile: toggle conversations list
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

  // Track online status for influencer mode - update presence
  useEffect(() => {
    if (mode === 'influencer' && influencerId) {
      // Update immediately when component mounts
      updateOnlineStatus();
      // Update status every 10 seconds (more frequent for better accuracy)
      const interval = setInterval(updateOnlineStatus, 10000);
      
      // Handle browser close/tab close
      const handleBeforeUnload = () => {
        markOffline();
      };
      
      const handleVisibilityChange = () => {
        if (document.hidden) {
          // Tab is hidden - mark as offline after a delay
          setTimeout(() => {
            if (document.hidden) {
              markOffline();
            }
          }, 60000); // 1 minute after tab becomes hidden
        } else {
          // Tab is visible again - mark as online
          updateOnlineStatus();
        }
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Mark as offline when component unmounts
      return () => {
        clearInterval(interval);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        markOffline();
      };
    } else if (mode === 'brand' && brandEmail) {
      // Track brand online status - only if brand has account
      const updateBrandStatus = async () => {
        // Check if brand has account first
        const { data: brandData } = await supabase
          .from('brands')
          .select('id')
          .eq('contact_email', brandEmail.toLowerCase().trim())
          .maybeSingle();
        
        if (brandData) {
          // Brand has account - update presence
          updateBrandOnlineStatus(brandEmail);
        }
      };
      
      updateBrandStatus();
      // Update status every 3 seconds to keep brand online (more frequent for reliability)
      const interval = setInterval(updateBrandStatus, 3000);
      
      // Handle browser close/tab close
      const handleBeforeUnload = () => {
        markBrandOffline(brandEmail);
      };
      
      const handleVisibilityChange = () => {
        if (document.hidden) {
          // Tab is hidden - mark as offline after a delay
          setTimeout(() => {
            if (document.hidden) {
              markBrandOffline(brandEmail);
            }
          }, 60000); // 1 minute after tab becomes hidden
        } else {
          // Tab is visible again - mark as online
          updateBrandStatus();
        }
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Mark as offline when component unmounts
      return () => {
        clearInterval(interval);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        markBrandOffline(brandEmail);
      };
    }
  }, [mode, influencerId, brandEmail]);

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
          
          // Update brand status when brand sends a message (for influencer mode)
          // This is the same as when influencer sends message to brand (brand checks influencer status)
          if (mode === 'influencer' && newMsg.sender_type === 'brand') {
            // When brand sends a message, they are definitely online - check their status immediately
            // The API route already updated brand_presence, but we need to check it here to update UI
            // Use the current conversation to get brand email (avoid variable shadowing)
            const currentConv = conversations.find(c => c.id === selectedConversation);
            const emailToCheck = currentConv?.brand_email || (brandEmail as string | undefined);
            if (emailToCheck) {
              // Check brand status immediately with a small delay to ensure API has updated presence
              // Then check again after a bit longer to catch the update
              setTimeout(() => {
                checkBrandStatus(emailToCheck);
                // Check again after 500ms to ensure we catch the updated presence
                setTimeout(() => {
                  checkBrandStatus(emailToCheck);
                }, 500);
              }, 100);
            }
          }
          
          // Update unread count if this is a new message from the other party
          if (mode === 'brand' && newMsg.sender_type === 'influencer' && onUnreadCountChange) {
            // Increment count immediately (optimistic update)
            // The actual count will be recalculated when conversation loads
            setTimeout(() => {
              (async () => {
                try {
                  // Recalculate unread count
                  const currentConversations = conversations;
                  if (currentConversations.length > 0) {
                    const conversationIds = currentConversations.map(c => c.id);
                    const { data: unreadMessages } = await supabase
                      .from('messages')
                      .select('id')
                      .in('conversation_id', conversationIds)
                      .eq('sender_type', 'influencer')
                      .eq('read', false);
                    onUnreadCountChange(unreadMessages?.length || 0);
                  }
                } catch (error) {
                  // Ignore errors
                }
              })();
            }, 500);
          }
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

      // Calculate unread message count for brand mode
      if (mode === 'brand' && brandEmail && data && data.length > 0 && onUnreadCountChange) {
        (async () => {
          try {
            const conversationIds = data.map(c => c.id);
            const { data: unreadMessages } = await supabase
              .from('messages')
              .select('id')
              .in('conversation_id', conversationIds)
              .eq('sender_type', 'influencer')
              .eq('read', false);
            onUnreadCountChange(unreadMessages?.length || 0);
          } catch (error) {
            // Ignore errors
          }
        })();
      } else if (onUnreadCountChange) {
        onUnreadCountChange(0);
      }

      // Auto-select first conversation or create new if brandEmail provided
      if (mode === 'brand' && brandEmail && data && data.length === 0 && influencerId) {
        // Will create conversation when first message is sent
      } else if (data && data.length > 0 && !selectedConversation) {
        setSelectedConversation(data[0].id);
        // Check brand status immediately when first conversation is auto-selected (for influencer mode)
        if (mode === 'influencer' && data[0]?.brand_email) {
          // Use setTimeout to ensure conversations state is updated first
          setTimeout(() => {
            checkBrandStatus(data[0].brand_email);
          }, 200);
        }
      } else if (mode === 'influencer' && data && data.length > 0 && selectedConversation) {
        // If conversation is already selected, check brand status for that conversation
        const currentConv = data.find(c => c.id === selectedConversation);
        if (currentConv?.brand_email) {
          setTimeout(() => {
            checkBrandStatus(currentConv.brand_email);
          }, 200);
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

  // Check if we can show agreement summary button (if there's a proposal or if conversation exists)
  const canShowAgreementSummary = selectedConversation && !conversationClosed;

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
        .select('is_online, last_seen, updated_at')
        .eq('influencer_id', id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking influencer status:', error);
        setIsInfluencerOnline(false);
        return;
      }

      if (data) {
        // Very strict: must be online AND last_seen within 1 minute (not 2)
        // This ensures only actively connected users show as online
        const lastSeen = new Date(data.last_seen);
        const updatedAt = new Date(data.updated_at || data.last_seen);
        const now = new Date();
        const secondsSinceLastSeen = (now.getTime() - lastSeen.getTime()) / 1000;
        const secondsSinceUpdated = (now.getTime() - updatedAt.getTime()) / 1000;
        
        // Must be actively online (updated within 1 minute = 60 seconds)
        const isOnline = data.is_online && 
                        secondsSinceLastSeen < 60 && 
                        secondsSinceUpdated < 60;
        
        setIsInfluencerOnline(isOnline);
        
        // If presence is stale, mark as offline
        if (data.is_online && (secondsSinceLastSeen >= 60 || secondsSinceUpdated >= 60)) {
          setIsInfluencerOnline(false);
        }
      } else {
        setIsInfluencerOnline(false);
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
      }
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  };

  const markOffline = async () => {
    if (!influencerId) return;
    try {
      const result = await supabase
        .from('influencer_presence')
        .update({
          is_online: false,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('influencer_id', influencerId);
      
      if (result.error) {
        console.error('Error marking influencer offline:', result.error);
      }
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
      console.log(`[Brand Status Check] No email provided`);
      setIsBrandOnline(false);
      return;
    }
    
    const emailLower = email.toLowerCase().trim();
    console.log(`[Brand Status Check] Starting check for email: ${emailLower}`);
    
    try {
      // Check presence first - if presence exists, we can check status immediately
      console.log(`[Brand Status Check] Checking presence for email: ${emailLower}`);
      const { data: presenceData, error: presenceError } = await supabase
        .from('brand_presence')
        .select('is_online, last_seen, updated_at, brand_email')
        .eq('brand_email', emailLower)
        .maybeSingle();

      if (presenceError && presenceError.code !== 'PGRST116') {
        console.error(`[Brand Status Check] Error checking presence:`, presenceError);
        setIsBrandOnline(false);
        return;
      }

      // If no presence data, brand is offline
      if (!presenceData) {
        console.log(`[Brand Status Check] No presence data for ${emailLower} - OFFLINE`);
        setIsBrandOnline(false);
        return;
      }

      // Presence data exists - trust it (presence is only created by authenticated brands)
      // RLS might block brands table query, but presence data is sufficient proof that brand has account
      console.log(`[Brand Status Check] Found presence data for ${emailLower}, checking online status...`);
      
      // Check if brand is online: must be online AND last_seen/updated_at within 10 seconds
      const data = presenceData;

      if (data) {
        console.log(`[Brand Status Check] Found presence data:`, data);
        // Check if brand is online: must be online AND last_seen/updated_at within 10 seconds
        // More tolerant window to account for network delays and polling intervals
        const lastSeen = new Date(data.last_seen);
        const updatedAt = new Date(data.updated_at || data.last_seen);
        const now = new Date();
        const secondsSinceLastSeen = (now.getTime() - lastSeen.getTime()) / 1000;
        const secondsSinceUpdated = (now.getTime() - updatedAt.getTime()) / 1000;
        
        // Brand is online if is_online is true AND updated within last 10 seconds
        // This gives enough time for the 3-second update interval plus network delays
        const ONLINE_WINDOW = 10; // 10 seconds window (allows for 3s updates + network delay)
        const isOnline = data.is_online && 
                        secondsSinceLastSeen < ONLINE_WINDOW && 
                        secondsSinceUpdated < ONLINE_WINDOW;
        
        console.log(`[Brand Status Check] Email: ${email}, is_online: ${data.is_online}, last_seen: ${secondsSinceLastSeen.toFixed(1)}s ago, updated_at: ${secondsSinceUpdated.toFixed(1)}s ago, result: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
        
        // Update state - this will trigger UI update
        setIsBrandOnline(isOnline);
      } else {
        // No presence data - brand is offline
        console.log(`[Brand Status Check] Email: ${email}, No presence data - OFFLINE`);
        setIsBrandOnline(false);
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
    
    if (!email) {
      console.log('[Brand Presence Update] No email provided');
      return;
    }
    
    try {
      const emailLower = email.toLowerCase().trim();
      console.log(`[Brand Presence Update] Updating presence for: ${emailLower}`);
      
      // First check if brand has an account - unregistered brands should not update presence
      const { data: brandData } = await supabase
        .from('brands')
        .select('id')
        .eq('contact_email', emailLower)
        .maybeSingle();

      if (!brandData) {
        // Brand doesn't have account - don't update presence
        console.log(`[Brand Presence Update] Brand ${emailLower} does not have account - skipping`);
        return;
      }

      // Brand has account - update presence
      const now = new Date().toISOString();
      const result = await supabase
        .from('brand_presence')
        .upsert({
          brand_email: emailLower,
          is_online: true,
          last_seen: now,
          updated_at: now,
        }, {
          onConflict: 'brand_email'
        });
      
      if (result.error) {
        console.error('[Brand Presence Update] Error updating brand online status:', result.error);
      } else {
        console.log(`[Brand Presence Update] Successfully updated presence for ${emailLower} at ${now}`);
      }
    } catch (error) {
      console.error('[Brand Presence Update] Exception updating brand online status:', error);
    }
  };

  const markBrandOffline = async (emailToMark?: string) => {
    const email = emailToMark || brandEmail || (mode === 'influencer' && selectedConversation
      ? conversations.find(c => c.id === selectedConversation)?.brand_email
      : null);
    
    if (!email) return;
    
    try {
      // Only mark offline if brand has account
      const { data: brandData } = await supabase
        .from('brands')
        .select('id')
        .eq('contact_email', email.toLowerCase().trim())
        .maybeSingle();

      if (brandData) {
        // Brand has account - mark as offline
        const result = await supabase
          .from('brand_presence')
          .update({
            is_online: false,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('brand_email', email.toLowerCase().trim());
        
        if (result.error) {
          console.error('Error marking brand offline:', result.error);
        }
      }
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
    : displayNameForLang(currentConversation?.influencer_name, lang || 'el');


  // Check influencer status when conversation changes (for brand mode) - only check, don't update
  useEffect(() => {
    if (mode === 'brand') {
      if (selectedConversation) {
        const conv = conversations.find(c => c.id === selectedConversation);
        const idToCheck = conv?.influencer_id || influencerId;
        if (idToCheck) {
          checkInfluencerStatus(idToCheck);
          // Poll every 10 seconds to check influencer online status
          const interval = setInterval(() => {
            const currentConv = conversations.find(c => c.id === selectedConversation);
            const id = currentConv?.influencer_id || influencerId;
            if (id) {
              checkInfluencerStatus(id);
            }
          }, 10000);
          return () => clearInterval(interval);
        } else {
          setIsInfluencerOnline(false);
        }
      } else if (influencerId) {
        // If no conversation selected but influencerId prop exists, check it
        checkInfluencerStatus(influencerId);
        const interval = setInterval(() => {
          checkInfluencerStatus(influencerId);
        }, 10000);
        return () => clearInterval(interval);
      } else {
        setIsInfluencerOnline(false);
      }
    }
  }, [selectedConversation, conversations, mode, influencerId]);

  // Check brand status when conversation changes (for influencer mode) - only check, don't update
  // Use the same logic as checkInfluencerStatus for brand mode
  useEffect(() => {
    if (mode === 'influencer') {
      if (selectedConversation) {
        const conv = conversations.find(c => c.id === selectedConversation);
        const emailToCheck = conv?.brand_email || brandEmail;
        if (emailToCheck) {
          // Check immediately and again after a short delay to ensure we catch any updates
          console.log(`[Brand Status Check] Initial check for: ${emailToCheck}`);
          checkBrandStatus(emailToCheck);
          // Check again after 500ms to catch any recent updates
          setTimeout(() => {
            console.log(`[Brand Status Check] Delayed check for: ${emailToCheck}`);
            checkBrandStatus(emailToCheck);
          }, 500);
          
          // Set up real-time subscription for brand_presence changes
          const presenceChannel = supabase
            .channel(`brand_presence:${emailToCheck.toLowerCase().trim()}`)
            .on('postgres_changes', {
              event: '*', // Listen to INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'brand_presence',
              filter: `brand_email=eq.${emailToCheck.toLowerCase().trim()}`
            }, (payload) => {
              // When presence changes, check status immediately
              console.log('[Brand Presence] Real-time update received:', payload);
              checkBrandStatus(emailToCheck);
            })
            .subscribe((status) => {
              console.log('[Brand Presence] Subscription status:', status);
            });
          
          // Poll every 3 seconds to check brand online status (more frequent for better responsiveness)
          const interval = setInterval(() => {
            // Re-read conversations in case it changed
            setConversations((currentConvs) => {
              const currentConv = currentConvs.find(c => c.id === selectedConversation);
              const email = currentConv?.brand_email || brandEmail;
              if (email) {
                checkBrandStatus(email);
              } else {
                setIsBrandOnline(false);
              }
              return currentConvs; // Return unchanged
            });
          }, 3000); // Check every 3 seconds to match update frequency
          
          return () => {
            clearInterval(interval);
            presenceChannel.unsubscribe();
          };
        } else {
          setIsBrandOnline(false);
        }
      } else if (brandEmail) {
        // If no conversation selected but brandEmail prop exists, check it
        checkBrandStatus(brandEmail);
        
        // Set up real-time subscription for brand_presence changes
        const presenceChannel = supabase
          .channel(`brand_presence:${brandEmail.toLowerCase().trim()}`)
          .on('postgres_changes', {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'brand_presence',
            filter: `brand_email=eq.${brandEmail.toLowerCase().trim()}`
          }, (payload) => {
            // When presence changes, check status immediately
            console.log('[Brand Presence] Real-time update received:', payload);
            checkBrandStatus(brandEmail);
          })
          .subscribe((status) => {
            console.log('[Brand Presence] Subscription status:', status);
          });
        
        // Poll every 3 seconds to check brand online status
        const interval = setInterval(() => {
          checkBrandStatus(brandEmail);
        }, 3000); // Check every 3 seconds to match update frequency
        
        return () => {
          clearInterval(interval);
          presenceChannel.unsubscribe();
        };
      } else {
        setIsBrandOnline(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation, conversations, mode, brandEmail]);

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-slate-200 h-[calc(100vh-200px)] sm:h-[600px] min-h-[500px] flex flex-col">
              {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900">{txt.messages}</h2>
      </div>

      <div className="flex flex-col sm:flex-row flex-1 overflow-hidden relative">
        {/* Mobile: Backdrop overlay when conversations list is open */}
        {showConversationsList && (
          <div
            onClick={() => setShowConversationsList(false)}
            className="sm:hidden fixed inset-0 bg-black/50 z-30"
          />
        )}

        {/* Mobile: Toggle button for conversations list */}
        <button
          onClick={() => setShowConversationsList(!showConversationsList)}
          className="sm:hidden absolute top-2 right-2 z-50 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium shadow-lg hover:bg-blue-700 transition-colors"
        >
          {showConversationsList ? (lang === 'el' ? 'Κλείσιμο' : 'Close') : (lang === 'el' ? 'Συνομιλίες' : 'Conversations')}
        </button>

        {/* Conversations List */}
        <div className={`w-full sm:w-64 border-b sm:border-b-0 sm:border-r border-slate-200 overflow-y-auto bg-slate-50 flex-shrink-0 ${
          showConversationsList ? 'block' : 'hidden sm:block'
        } absolute sm:relative top-0 left-0 right-0 bottom-0 sm:bottom-auto z-40 sm:z-auto max-h-[calc(100vh-250px)] sm:max-h-none shadow-xl sm:shadow-none`}>
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
                    // Close conversations list on mobile after selection
                    setShowConversationsList(false);
                  }}
                  className={`w-full text-left p-3 sm:p-4 border-b border-slate-200 hover:bg-white transition-colors ${
                    selectedConversation === conv.id ? 'bg-white border-l-4 border-l-blue-600' : ''
                  } ${isClosed ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-900">
                      {mode === 'influencer' 
                        ? (conv.brand_name || conv.brand_email)
                        : displayNameForLang(conv.influencer_name, lang || 'el')}
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
        <div className="flex-1 flex flex-col relative z-10">
          {selectedConversation ? (
            <>
              {/* Mobile: Back button to show conversations list */}
              <button
                onClick={() => {
                  setSelectedConversation(null);
                  setShowConversationsList(true);
                }}
                className="sm:hidden px-4 py-2 mx-4 mt-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors flex items-center gap-2"
              >
                ← {lang === 'el' ? 'Πίσω' : 'Back'}
              </button>

              {/* Chat Header */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-gradient-to-r from-white to-slate-50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                  <h3 className="text-base sm:text-lg font-semibold text-slate-900">{otherPartyName}</h3>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {mode === 'brand' && (
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className={`w-2 h-2 rounded-full ${isInfluencerOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                        <span className="text-xs font-medium text-slate-600">
                          {isInfluencerOnline ? txt.online : txt.offline}
                        </span>
                      </div>
                    )}
                    {mode === 'influencer' && selectedConversation && (currentConversation?.brand_email || brandEmail) && (
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className={`w-2 h-2 rounded-full ${isBrandOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                        <span className="text-xs font-medium text-slate-600">
                          {isBrandOnline ? txt.online : txt.offline}
                        </span>
                      </div>
                    )}
                    {/* Agreement Button - Shows when agreement needs to be accepted */}
                    {proposalInfo && needsAgreement && (
                      <button
                        onClick={() => setShowAgreementModal(true)}
                        className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
                      >
                        {txt.acceptAgreement}
                      </button>
                    )}
                    {proposalInfo && hasAgreement && !bothAccepted && (
                      <div className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm bg-blue-100 text-blue-700 rounded-lg font-medium">
                        {txt.agreementPending}
                      </div>
                    )}
                    {proposalInfo && bothAccepted && (
                      <div className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm bg-green-100 text-green-700 rounded-lg font-medium">
                        {txt.agreementAccepted}
                      </div>
                    )}
                    {/* Agreement Summary Button - Always visible when there's a proposal, opens agreement modal */}
                    {canShowAgreementSummary && proposalInfo && (
                      <button
                        onClick={() => setShowAgreementModal(true)}
                        className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 sm:gap-2"
                      >
                        <span className="text-sm sm:text-base">🤝</span>
                        <span className="hidden sm:inline">{txt.agreementSummary}</span>
                        <span className="sm:hidden">Σύνοψη</span>
                      </button>
                    )}
                    {!conversationClosed && (
                      <button
                        onClick={() => endConversation(false)}
                        disabled={endingConversation}
                        className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                      >
                        {endingConversation ? txt.endingConversation : txt.endConversation}
                      </button>
                    )}
                  </div>
                </div>
                {mode === 'brand' && selectedConversation && (influencerId || currentConversation?.influencer_id) && !isInfluencerOnline && !conversationClosed && (
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
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 sm:space-y-4 bg-gradient-to-b from-slate-50 to-white">
                {messages.map((msg) => {
                  const isOwn = (mode === 'influencer' && msg.sender_type === 'influencer') ||
                               (mode === 'brand' && msg.sender_type === 'brand');
                  
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-xs lg:max-w-md px-4 py-2.5 sm:py-3 rounded-2xl shadow-sm ${
                          isOwn
                            ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
                            : 'bg-white text-slate-900 border border-slate-200'
                        }`}
                      >
                        <p className="text-sm sm:text-base whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        <p
                          className={`text-xs mt-1.5 opacity-75 ${
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
                className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 bg-white shadow-lg"
                style={{ 
                  display: 'block', 
                  visibility: 'visible',
                  opacity: 1,
                  pointerEvents: 'auto'
                } as React.CSSProperties}
              >
                {conversationClosed && (
                  <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs sm:text-sm text-blue-700">
                      {lang === 'el' 
                        ? '💬 Η συνομιλία είναι κλειστή. Στείλε μήνυμα για να την ανοίξεις ξανά.'
                        : '💬 Conversation is closed. Send a message to reopen it.'}
                    </p>
                  </div>
                )}
                <div className="flex gap-2 sm:gap-3">
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
                    className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-slate-900 bg-white text-sm sm:text-base"
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
                    className="px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-md hover:shadow-lg transition-all text-sm sm:text-base"
                  >
                    {sending ? txt.sending : txt.send}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-4">
                <p className="text-center mb-4">{txt.selectConversation}</p>
                <button
                  onClick={() => setShowConversationsList(true)}
                  className="sm:hidden px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  {lang === 'el' ? '📋 Προβολή Συνομιλιών' : '📋 View Conversations'}
                </button>
              </div>
              
              {/* Show message input even without selected conversation if we have influencerId and brandEmail */}
              {influencerId && brandEmail && (
                <form onSubmit={sendMessage} className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 bg-white shadow-lg">
                  <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs sm:text-sm text-blue-700">
                      {lang === 'el' 
                        ? '💬 Ξεκίνα νέα συνομιλία ή στείλε μήνυμα σε υπάρχουσα κλειστή συνομιλία.'
                        : '💬 Start a new conversation or send a message to an existing closed conversation.'}
                    </p>
                  </div>
                  <div className="flex gap-2 sm:gap-3">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={txt.placeholder}
                      className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-slate-900 text-sm sm:text-base"
                      rows={2}
                    />
                    <button
                      type="submit"
                      disabled={sending || !newMessage.trim()}
                      className="px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-md hover:shadow-lg transition-all text-sm sm:text-base"
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
                    {mode === 'influencer' ? proposalInfo.brand_name : displayNameForLang(influencerName, lang || 'el')}
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

