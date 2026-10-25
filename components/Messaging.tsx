"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { FaPaperclip } from 'react-icons/fa';
import { supabase } from '@/lib/supabaseClient';
import { displayNameForLang } from '@/lib/greeklish';
import {
  formatChatRelativeTime,
  formatChatDayLabel,
  sameChatDay,
  clipChatPreview,
  chatInitial,
} from '@/lib/chatTime';
import { formatActiveLabel, presenceOnline } from '@/lib/presenceStatus';
import { counterpartyBrandPresence, counterpartyInfluencerPresence } from '@/lib/presenceIdentity';
import { sessionFetch } from '@/lib/sessionFetch';

interface MessageAttachment {
  url: string;
  filename?: string;
  size?: number;
  content_type?: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: 'influencer' | 'brand';
  content: string;
  attachments?: MessageAttachment[] | null;
  read: boolean;
  created_at: string;
  localStatus?: 'sending' | 'failed';
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
  last_message_preview?: string;
  unread_count?: number;
  proposal_id?: number | null;
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
  /** Brand mode: όταν ορίζεται, επιτρέπει νέα συνομιλία / εστίαση σε συγκεκριμένο influencer. */
  influencerId?: string;
  influencerName?: string;
  brandEmail?: string;
  brandName?: string;
  proposalId?: number;
  mode: 'influencer' | 'brand';
  lang?: 'el' | 'en';
  onUnreadCountChange?: (count: number) => void;
  initialConversationId?: string | null;
}

const t = {
  el: {
    placeholder: "Γράψε το μήνυμά σου...",
    online: "Online",
    offline: "Offline",
    offlineNotice:
      "Ο influencer δεν είναι συνδεδεμένος τώρα. Το μήνυμα αποθηκεύεται εδώ· θα το δει όταν μπει στο Influo.",
    brandOfflineNotice:
      "Η επιχείρηση δεν είναι συνδεδεμένη τώρα. Το μήνυμα αποθηκεύεται εδώ· θα το δει όταν μπει στο Influo.",
    sending: "Αποστολή...",
    send: "Αποστολή",
    messages: "Μηνύματα",
    noConversations: "Δεν υπάρχουν συνομιλίες ακόμα",
    selectConversation: "Επέλεξε μια συνομιλία για να δεις τα μηνύματα",
    endConversation: "Τέλος συνομιλίας",
    endingConversation: "Τερματισμός...",
    endConfirmTitle: "Τερματισμός συνομιλίας;",
    endConfirmBody: "Οι συμμετέχοντες θα ενημερωθούν μέσω της πλατφόρμας.",
    endConfirmYes: "Ναι, τερματισμός",
    endConfirmNo: "Ακύρωση",
    inactivityWarning: "Η συνομιλία είναι αδρανής και από τις δύο πλευρές. Θα κλείσει αυτόματα σε 5 λεπτά.",
    conversationClosed: "Η συνομιλία έκλεισε.",
    conversationClosedInactivity: "Η συνομιλία έκλεισε λόγω αδράνειας.",
    reopenHint: "Η συνομιλία είναι κλειστή. Στείλε μήνυμα για να την ανοίξεις ξανά.",
    reopenPlaceholder: "Γράψε μήνυμα για να ανοίξεις τη συνομιλία...",
    acceptAgreement: "Αποδοχή συμφωνίας",
    agreementTitle: "Συμφωνία Συνεργασίας",
    agreementCancel: "Ακύρωση",
    agreementAccept: "Αποδοχή Συμφωνίας",
    agreementSaving: "Αποθήκευση...",
    agreementAccepted: "Συμφωνία αποδεκτή",
    agreementPending: "Αναμονή αποδοχής",
    agreementSummary: "Σύνοψη",
    proposalCardTitle: "Προσφορά συνεργασίας",
    proposalOffered: "Προσφερόμενη",
    proposalCounter: "Αντιπρόταση",
    readReceipt: "Διαβάστηκε",
    seen: "Διαβάστηκε",
    sent: "Στάλθηκε",
    typing: "γράφει…",
    newMessages: "Νέα μηνύματα",
    sendFailed: "Το μήνυμα δεν στάλθηκε.",
    retry: "Δοκιμή ξανά",
    emptyThread: "Δεν υπάρχουν μηνύματα ακόμα. Γράψτε το πρώτο.",
    closedBadge: "Κλειστή",
    back: "Πίσω",
    loading: "Φόρτωση...",
    moreActions: "Ενέργειες",
    brandFallback: "Επιχείρηση",
    attach: "Επισύναψη",
    attachHint: "Εικόνα ή PDF (έως 10MB)",
    removeFile: "Αφαίρεση",
  },
  en: {
    placeholder: "Type your message...",
    online: "Online",
    offline: "Offline",
    offlineNotice:
      "The influencer is not connected right now. Your message is saved here; they will see it when they open Influo.",
    brandOfflineNotice:
      "The brand is not connected right now. Your message is saved here; they will see it when they open Influo.",
    sending: "Sending...",
    send: "Send",
    messages: "Messages",
    noConversations: "No conversations yet",
    selectConversation: "Select a conversation to view messages",
    endConversation: "End conversation",
    endingConversation: "Ending...",
    endConfirmTitle: "End this conversation?",
    endConfirmBody: "Participants will be notified through the platform.",
    endConfirmYes: "Yes, end it",
    endConfirmNo: "Cancel",
    inactivityWarning: "The conversation is inactive on both sides. It will close automatically in 5 minutes.",
    conversationClosed: "The conversation has been closed.",
    conversationClosedInactivity: "The conversation has been closed due to inactivity.",
    reopenHint: "Conversation is closed. Send a message to reopen it.",
    reopenPlaceholder: "Type a message to reopen the conversation...",
    acceptAgreement: "Accept agreement",
    agreementTitle: "Collaboration Agreement",
    agreementCancel: "Cancel",
    agreementAccept: "Accept Agreement",
    agreementSaving: "Saving...",
    agreementAccepted: "Agreement accepted",
    agreementPending: "Pending acceptance",
    agreementSummary: "Summary",
    proposalCardTitle: "Collaboration offer",
    proposalOffered: "Offered",
    proposalCounter: "Counter",
    readReceipt: "Read",
    seen: "Seen",
    sent: "Sent",
    typing: "is typing…",
    newMessages: "New messages",
    sendFailed: "The message was not sent.",
    retry: "Retry",
    emptyThread: "No messages yet. Write the first one.",
    closedBadge: "Closed",
    back: "Back",
    loading: "Loading...",
    moreActions: "Actions",
    brandFallback: "Brand",
    attach: "Attach",
    attachHint: "Image or PDF (up to 10MB)",
    removeFile: "Remove",
  }
};

export default function Messaging({
  influencerId,
  influencerName,
  brandEmail,
  brandName,
  proposalId,
  mode,
  lang = 'el',
  onUnreadCountChange,
  initialConversationId = null,
}: MessagingProps) {
  const txt = t[lang];
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [isInfluencerOnline, setIsInfluencerOnline] = useState(false);
  const [isBrandOnline, setIsBrandOnline] = useState(false);
  const [influencerLastSeen, setInfluencerLastSeen] = useState<string | null>(null);
  const [brandLastSeen, setBrandLastSeen] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [unseenBelow, setUnseenBelow] = useState(0);
  const [sendError, setSendError] = useState<string | null>(null);
  const [presenceTick, setPresenceTick] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef(0);
  const lastSentMessageRef = useRef<string>('');
  const applyInboxMessageRef = useRef<(msg: Message) => void>(() => {});
  const markReadRef = useRef<(convId: string) => void>(() => {});
  const influencerWatchGen = useRef(0);
  const brandWatchGen = useRef(0);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
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
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  useEffect(() => {
    if (!showActionsMenu) return;
    const closeIfOutside = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && actionsMenuRef.current?.contains(target)) return;
      setShowActionsMenu(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowActionsMenu(false);
    };
    document.addEventListener("mousedown", closeIfOutside);
    document.addEventListener("touchstart", closeIfOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", closeIfOutside);
      document.removeEventListener("touchstart", closeIfOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [showActionsMenu]);

  const activityCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityUpdateRef = useRef<number>(0);
  const warningStartTimeRef = useRef<number | null>(null);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ACTIVITY_UPDATE_THROTTLE = 30000; // Update at most once per 30 seconds

  const activeProposalIdRef = useRef<number | string | null>(null);

  // Offer card follows the open thread's proposal, or the one passed in from a dashboard.
  useEffect(() => {
    const fromThread = conversations.find((c) => c.id === selectedConversation)?.proposal_id;
    const id = proposalId || fromThread || null;
    activeProposalIdRef.current = id;
    if (!id) {
      setProposalInfo(null);
      return;
    }
    const load = () => { void loadProposalInfo(id); };
    load();
    window.addEventListener('focus', load);
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      load();
    }, 300000);
    const onVisibility = () => {
      if (!document.hidden) load();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(timer);
    };
  }, [proposalId, selectedConversation, conversations]);

  // Load conversations
  useEffect(() => {
    loadConversations();
  }, [mode]);

  // Auto-select conversation when proposalId and brandEmail are provided
  useEffect(() => {
    if (proposalId && brandEmail && conversations.length > 0) {
      const matchingConv = conversations.find(c => c.brand_email.toLowerCase() === brandEmail.toLowerCase());
      if (matchingConv) {
        setSelectedConversation(matchingConv.id);
      }
    }
  }, [proposalId, brandEmail, conversations]);

  useEffect(() => {
    if (initialConversationId) setSelectedConversation(initialConversationId);
  }, [initialConversationId]);

  useEffect(() => {
    const timer = window.setInterval(() => setPresenceTick((n) => n + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setViewerUserId(data.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Brand: poll + subscribe to the other party's presence. This view never writes that row.
  const watchedInfluencerId =
    mode === 'brand'
      ? influencerId ||
        (selectedConversation
          ? conversations.find((c) => c.id === selectedConversation)?.influencer_id
          : undefined) ||
        undefined
      : undefined;

  useEffect(() => {
    if (mode !== 'brand') return;

    setIsInfluencerOnline(false);
    setInfluencerLastSeen(null);
    if (!watchedInfluencerId) return;
    if (viewerUserId && watchedInfluencerId === viewerUserId) return;

    checkInfluencerStatus(watchedInfluencerId);
    const interval = setInterval(() => {
      if (document.hidden) return;
      checkInfluencerStatus(watchedInfluencerId);
    }, 300000);

    const channel = supabase
      .channel(`influencer_presence_watch:${watchedInfluencerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'influencer_presence',
          filter: `influencer_id=eq.${watchedInfluencerId}`,
        },
        () => {
          checkInfluencerStatus(watchedInfluencerId);
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, [mode, watchedInfluencerId, viewerUserId]);

  const watchedBrandEmail =
    mode === 'influencer' && selectedConversation
      ? conversations.find((c) => c.id === selectedConversation)?.brand_email
      : undefined;

  useEffect(() => {
    if (mode !== 'influencer') return;
    setIsBrandOnline(false);
    setBrandLastSeen(null);
    if (!watchedBrandEmail) return;
    checkBrandStatus(watchedBrandEmail);
    const interval = setInterval(() => {
      if (document.hidden) return;
      checkBrandStatus(watchedBrandEmail);
    }, 300000);
    return () => clearInterval(interval);
  }, [mode, watchedBrandEmail]);

  useEffect(() => {
    if (!selectedConversation) return;
    const onVis = () => {
      if (document.visibilityState === 'visible') markReadRef.current(selectedConversation);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [selectedConversation]);

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
      return;
    }

    if (!autoClose) {
      setShowEndConfirm(true);
      setShowActionsMenu(false);
      return;
    }

    setEndingConversation(true);
    try {
      const response = await sessionFetch('/api/conversations/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation,
          autoClose,
        })
      });

      const result = await response.json();
      
      if (!response.ok || !result.success) {
        const errorMsg = result.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMsg);
      }

      setConversationClosed(true);
      setConversationClosedByInactivity(autoClose);
      setShowInactivityWarning(false);
      warningStartTimeRef.current = null;
      setShowEndConfirm(false);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation
            ? { ...c, closed_at: new Date().toISOString() }
            : c
        )
      );
    } catch (error) {
      console.error('[End Conversation] Error:', error);
      alert(lang === 'el' 
        ? 'Αποτυχία τερματισμού συνομιλίας. Παρακαλώ δοκιμάστε ξανά.'
        : 'Failed to end conversation. Please try again.');
    } finally {
      setEndingConversation(false);
    }
  }, [selectedConversation, endingConversation, lang]);

  const confirmEndConversation = useCallback(async () => {
    if (!selectedConversation || endingConversation) return;
    setEndingConversation(true);
    setShowEndConfirm(false);
    try {
      const response = await sessionFetch('/api/conversations/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation,
          autoClose: false,
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }
      setConversationClosed(true);
      setConversationClosedByInactivity(false);
      setShowInactivityWarning(false);
      warningStartTimeRef.current = null;
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation
            ? { ...c, closed_at: new Date().toISOString() }
            : c
        )
      );
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
      stickToBottomRef.current = true;
      setUnseenBelow(0);
      setOtherTyping(false);
      
      // Load activity timestamps FIRST to check if conversation is closed, then load messages
      // IMPORTANT: Even if conversation is closed, the textarea will remain visible
      (async () => {
        await loadActivityTimestamps(selectedConversation);
        await loadMessages(selectedConversation);
      })();
      // NOTE: We do NOT update activity timestamp when opening conversation
      // Activity should only be updated on actual user actions (typing, sending, etc.)
      // Set up real-time subscription. Fallback poll runs only while Realtime is down.
      let realtimeOk = false;
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
          
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            const tmpIdx = prev.findIndex(
              (m) => m.id.startsWith('tmp-') && m.sender_type === newMsg.sender_type
            );
            if (tmpIdx >= 0) {
              const copy = [...prev];
              copy[tmpIdx] = newMsg;
              return copy;
            }
            return [...prev, newMsg];
          });
          if (stickToBottomRef.current || isOurMessage) {
            setUnseenBelow(0);
            scrollToBottom(true);
          } else {
            setUnseenBelow((n) => n + 1);
          }
          applyInboxMessageRef.current(newMsg);

          if (
            !isOurMessage &&
            newMsg.sender_type !== mode &&
            document.visibilityState === 'visible'
          ) {
            markReadRef.current(selectedConversation);
          }

          if (mode === 'influencer' && newMsg.sender_type === 'brand') {
            const currentConv = conversations.find(c => c.id === selectedConversation);
            const emailToCheck = currentConv?.brand_email || (brandEmail as string | undefined);
            if (emailToCheck) checkBrandStatus(emailToCheck);
          }
          if (mode === 'brand' && newMsg.sender_type === 'influencer') {
            const currentConv = conversations.find((c) => c.id === selectedConversation);
            const idToCheck = currentConv?.influencer_id || influencerId;
            if (idToCheck) checkInfluencerStatus(idToCheck);
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation}`
        }, (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, read: updated.read } : m))
          );
        })
        .subscribe((status) => {
          realtimeOk = status === 'SUBSCRIBED';
        });

      const typingChannel = supabase.channel(`typing:${selectedConversation}`);
      typingChannelRef.current = typingChannel;
      typingChannel.on('broadcast', { event: 'typing' }, ({ payload }) => {
        const role = (payload as { role?: string } | null)?.role;
        if (role && role !== mode) {
          setOtherTyping(true);
          window.setTimeout(() => setOtherTyping(false), 2500);
        }
      }).subscribe();

      const fallback = window.setInterval(() => {
        if (!realtimeOk && selectedConversation) void loadMessages(selectedConversation);
      }, 25_000);

      const activityInterval = setInterval(() => {
        updateActivityTimestamp();
      }, 30000);

      return () => {
        subscription.unsubscribe();
        typingChannel.unsubscribe();
        typingChannelRef.current = null;
        clearInterval(activityInterval);
        window.clearInterval(fallback);
        setOtherTyping(false);
      };
    } else {
      setShowActionsMenu(false);
      setShowEndConfirm(false);
    }
  }, [selectedConversation]);

  // Inbox list follows this user's conversations only (not every message in the project).
  useEffect(() => {
    const filter =
      mode === 'influencer' && influencerId
        ? `influencer_id=eq.${influencerId}`
        : mode === 'brand' && brandEmail
          ? `brand_email=eq.${brandEmail.toLowerCase().trim()}`
          : null;
    if (!filter) return;
    const channel = supabase
      .channel(`inbox-conv:${mode}:${influencerId || brandEmail}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter },
        () => {
          void loadConversations(true);
        }
      )
      .subscribe();
    const poll = window.setInterval(() => {
      if (document.hidden) return;
      void loadConversations(true);
    }, 120000);
    const onFocus = () => {
      void loadConversations(true);
    };
    const onVisibility = () => {
      if (!document.hidden) void loadConversations(true);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      channel.unsubscribe();
      window.clearInterval(poll);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [mode, influencerId, brandEmail]);

  useEffect(() => {
    if (!onUnreadCountChange) return;
    const total = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    onUnreadCountChange(total);
  }, [conversations, onUnreadCountChange]);

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
        const response = await sessionFetch(`/api/conversations/check-inactive?conversationId=${selectedConversation}`);
        
        if (response.ok) {
          const result = await response.json();
          
          // Αν inactive και ανοιχτή: κλείσιμο μέσω close-if-inactive (χωρίς CRON_SECRET)
          if (result.isInactive && !result.isClosed) {
            try {
              const closeRes = await sessionFetch(`/api/conversations/close-if-inactive?conversationId=${selectedConversation}`);
              if (closeRes.ok) {
                const closeData = await closeRes.json();
                if (closeData.closed) {
                  setConversationClosed(true);
                }
              }
            } catch {
              // Ignore - Supabase pg_cron ή Vercel cron θα το κλείσει αργότερα
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
        const response = await sessionFetch(`/api/conversations/check-inactive?conversationId=${selectedConversation}`);
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

  const loadConversations = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let query = supabase
        .from('conversations')
        .select('*');

      if (mode === 'influencer') {
        query = query.eq('influencer_id', influencerId);
      } else if (mode === 'brand' && brandEmail) {
        query = query.ilike('brand_email', brandEmail.toLowerCase().trim());
      }

      // Order: open conversations first (nulls), then by last_message_at desc
      const { data, error } = await query
        .order('closed_at', { ascending: true, nullsFirst: true })
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('[Load Conversations] ❌ ERROR:', error);
        throw error;
      }

      const rows = (data || []) as Conversation[];
      const enriched = await enrichConversationRows(rows);
      setConversations(enriched);

      if (silent) return;

      // Auto-select: deep-link / desktop first; mobile keeps list until user picks.
      if (mode === 'brand' && brandEmail && enriched.length === 0 && influencerId) {
        // Νέα συνομιλία — το πρώτο μήνυμα δημιουργεί conversation
      } else if (enriched.length > 0 && !selectedConversation) {
        if (mode === 'brand' && influencerId) {
          const match = enriched.find((c) => c.influencer_id === influencerId);
          if (match) setSelectedConversation(match.id);
        } else if (typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches) {
          setSelectedConversation(enriched[0].id);
          if (mode === 'influencer' && enriched[0]?.brand_email) {
            setTimeout(() => checkBrandStatus(enriched[0].brand_email), 200);
          }
        }
      } else if (mode === 'influencer' && enriched.length > 0 && selectedConversation) {
        const currentConv = enriched.find(c => c.id === selectedConversation);
        if (currentConv?.brand_email) {
          setTimeout(() => {
            checkBrandStatus(currentConv.brand_email);
          }, 200);
        }
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const enrichConversationRows = async (rows: Conversation[]): Promise<Conversation[]> => {
    if (!rows.length) return [];
    const ids = rows.map((c) => c.id);

    const [{ data: unreadRows }, { data: recent }] = await Promise.all([
      supabase
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', ids)
        .or('read.eq.false,read.is.null')
        .neq('sender_type', mode)
        .limit(1000),
      supabase
        .from('messages')
        .select('conversation_id, content, created_at')
        .in('conversation_id', ids)
        .order('created_at', { ascending: false })
        .limit(Math.min(400, Math.max(ids.length, 1) * 8)),
    ]);

    const unreadMap = new Map<string, number>();
    for (const row of unreadRows || []) {
      const id = String((row as { conversation_id: string }).conversation_id);
      unreadMap.set(id, (unreadMap.get(id) || 0) + 1);
    }

    const previewMap = new Map<string, string>();
    for (const row of recent || []) {
      const id = String((row as { conversation_id: string }).conversation_id);
      if (previewMap.has(id)) continue;
      previewMap.set(id, String((row as { content?: string }).content || ''));
    }

    return rows.map((c) => ({
      ...c,
      last_message_preview: previewMap.get(c.id) || '',
      unread_count: unreadMap.get(c.id) || 0,
    }));
  };

  const applyInboxMessage = useCallback((newMsg: Message) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === newMsg.conversation_id);
      if (idx < 0) {
        return prev;
      }
      const isFromOther = newMsg.sender_type !== mode;
      const isOpen = selectedConversation === newMsg.conversation_id;
      const viewing = isOpen && typeof document !== 'undefined' && document.visibilityState === 'visible';
      const updated = [...prev];
      const current = updated[idx];
      updated[idx] = {
        ...current,
        last_message_at: newMsg.created_at,
        last_message_preview: newMsg.content,
        closed_at: null,
        unread_count: isFromOther && !viewing
          ? (current.unread_count || 0) + 1
          : viewing
            ? 0
            : current.unread_count || 0,
      };
      updated.sort((a, b) => {
        const ac = a.closed_at ? 1 : 0;
        const bc = b.closed_at ? 1 : 0;
        if (ac !== bc) return ac - bc;
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
      });
      return updated;
    });
  }, [mode, selectedConversation]);
  applyInboxMessageRef.current = applyInboxMessage;

  const loadProposalInfo = async (id = proposalId) => {
    if (!id) return;
    try {
      const response = await sessionFetch(`/api/proposals?id=${encodeURIComponent(String(id))}`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.proposal) {
        setProposalInfo(null);
        return;
      }
      setProposalInfo(result.proposal as ProposalInfo);
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
    const activeProposalId = activeProposalIdRef.current || proposalId;
    if (!activeProposalId || !agreementAccepted) {
      alert(lang === 'el' 
        ? 'Παρακαλώ διαβάστε και αποδεχτείτε τους όρους χρήσης'
        : 'Please read and accept the terms of service');
      return;
    }

    setSavingAgreement(true);
    try {
      const response = await sessionFetch('/api/proposals/agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: activeProposalId,
          userType: mode,
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
      stickToBottomRef.current = true;
      scrollToBottom(true);
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        markReadRef.current(convId);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const markVisibleAsRead = async (convId: string) => {
    if (!convId || document.visibilityState !== 'visible') return;
    try {
      const response = await sessionFetch('/api/messages/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, as: mode }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) return;
      const ids: string[] = Array.isArray(result.ids) ? result.ids : [];
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      setMessages((prev) => prev.map((m) => (idSet.has(m.id) ? { ...m, read: true } : m)));
      setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c)));
      window.dispatchEvent(new CustomEvent('messagesRead', {
        detail: { conversationId: convId, count: ids.length },
      }));
    } catch (error) {
      console.error('Error marking messages read:', error);
    }
  };
  markReadRef.current = (convId: string) => {
    void markVisibleAsRead(convId);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newMessage.trim();
    const filesToUpload = [...pendingFiles];
    if ((!text && filesToUpload.length === 0) || sending) return;
    if (mode === "influencer" && !influencerId) return;

    setSending(true);
    setSendError(null);
    const tmpId = `tmp-${Date.now()}`;
    const convAtSend = selectedConversation;
    if (convAtSend) {
      stickToBottomRef.current = true;
      setMessages((prev) => [
        ...prev,
        {
          id: tmpId,
          conversation_id: convAtSend,
          sender_id: mode === 'influencer' ? influencerId || '' : brandEmail || '',
          sender_type: mode,
          content: text,
          read: false,
          created_at: new Date().toISOString(),
          localStatus: 'sending',
        },
      ]);
      setNewMessage('');
      setPendingFiles([]);
      scrollToBottom(true);
    }

    try {
      let convId = convAtSend;
      const uploadFiles = async (targetConvId: string) => {
        const out: MessageAttachment[] = [];
        for (const file of filesToUpload) {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('conversation_id', targetConvId);
          const up = await sessionFetch('/api/messages/upload', { method: 'POST', body: fd });
          const upJson = await up.json();
          if (!up.ok || !upJson.success || !upJson.attachment?.url) {
            throw new Error(upJson.error || 'Upload failed');
          }
          out.push(upJson.attachment as MessageAttachment);
        }
        return out;
      };

      const uploaded = filesToUpload.length ? await uploadFiles(convId || 'temp') : [];
      const response = await sessionFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          convId
            ? { conversationId: convId, senderType: mode, content: text, attachments: uploaded }
            : {
                influencerId,
                brandEmail,
                brandName: brandName || brandEmail,
                senderType: mode,
                content: text,
                attachments: uploaded,
                proposalId,
              }
        ),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Send failed');

      const saved = result.message as Message | undefined;
      convId = result.conversationId || convId;
      lastSentMessageRef.current = text || uploaded[0]?.filename || 'file';
      playSendSound();
      setConversationClosed(false);
      setConversationClosedByInactivity(false);
      setShowInactivityWarning(false);

      if (saved && convAtSend) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === saved.id)) return prev.filter((m) => m.id !== tmpId);
          if (!prev.some((m) => m.id === tmpId)) return [...prev, { ...saved, localStatus: undefined }];
          return prev.map((m) => (m.id === tmpId ? { ...saved, localStatus: undefined } : m));
        });
      }
      if (convId && convId !== convAtSend) {
        setSelectedConversation(convId);
      }
      void loadConversations(true);
      if (!convAtSend) {
        setNewMessage('');
        setPendingFiles([]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setSendError(txt.sendFailed);
      if (convAtSend) {
        setMessages((prev) => prev.filter((m) => m.id !== tmpId));
      }
      setNewMessage(text);
      setPendingFiles(filesToUpload);
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = (force = false) => {
    if (!force && !stickToBottomRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const onMessageListScroll = () => {
    const el = messageListRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickToBottomRef.current = nearBottom;
    if (nearBottom) setUnseenBelow(0);
  };

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  const notifyTyping = () => {
    const channel = typingChannelRef.current;
    if (!channel) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    void channel.send({ type: 'broadcast', event: 'typing', payload: { role: mode } });
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
    const id = idToCheck || (mode === 'brand' && selectedConversation
      ? conversations.find(c => c.id === selectedConversation)?.influencer_id
      : undefined);
    const gen = ++influencerWatchGen.current;

    if (!id || (mode === 'brand' && viewerUserId && id === viewerUserId)) {
      if (gen === influencerWatchGen.current) {
        setIsInfluencerOnline(false);
        setInfluencerLastSeen(null);
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from('influencer_presence')
        .select('influencer_id, is_online, last_seen')
        .eq('influencer_id', id)
        .maybeSingle();

      if (gen !== influencerWatchGen.current) return;

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking influencer status:', error);
        setIsInfluencerOnline(false);
        setInfluencerLastSeen(null);
        return;
      }

      const row = counterpartyInfluencerPresence(id, data, mode === 'brand' ? viewerUserId : null);
      setInfluencerLastSeen(row?.last_seen || null);
      setIsInfluencerOnline(presenceOnline(row));
    } catch (error) {
      if (gen !== influencerWatchGen.current) return;
      console.error('Error checking influencer status:', error);
      setIsInfluencerOnline(false);
      setInfluencerLastSeen(null);
    }
  };

  const checkBrandStatus = async (emailToCheck?: string) => {
    const email = emailToCheck || (mode === 'influencer' && selectedConversation
      ? conversations.find(c => c.id === selectedConversation)?.brand_email
      : undefined);
    const gen = ++brandWatchGen.current;

    if (!email) {
      if (gen === brandWatchGen.current) {
        setIsBrandOnline(false);
        setBrandLastSeen(null);
      }
      return;
    }

    const emailLower = email.toLowerCase().trim();
    try {
      const { data: presenceData, error: presenceError } = await supabase
        .from('brand_presence')
        .select('is_online, last_seen, brand_email')
        .eq('brand_email', emailLower)
        .maybeSingle();

      if (gen !== brandWatchGen.current) return;

      if (presenceError && presenceError.code !== 'PGRST116') {
        console.error('Error checking brand status:', presenceError);
        setIsBrandOnline(false);
        setBrandLastSeen(null);
        return;
      }

      const row = counterpartyBrandPresence(emailLower, presenceData);
      setBrandLastSeen(row?.last_seen || null);
      setIsBrandOnline(presenceOnline(row));
    } catch (error) {
      if (gen !== brandWatchGen.current) return;
      console.error('Error checking brand status:', error);
      setIsBrandOnline(false);
      setBrandLastSeen(null);
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
    ? currentConversation?.brand_name || txt.brandFallback
    : displayNameForLang(currentConversation?.influencer_name, lang || 'el');

  const isComposingNew =
    mode === 'brand' && !!influencerId && !!brandEmail && !selectedConversation && !initialConversationId;
  const showMobileList = !selectedConversation && !isComposingNew;
  const showThreadPane = !!selectedConversation || isComposingNew;

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-slate-200 h-[min(720px,calc(100vh-12rem))] min-h-[480px] flex flex-col overflow-hidden">
      {/* Shared file picker — used by both existing-thread and compose-new composers */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,text/plain"
        className="hidden"
        multiple
        onChange={(e) => {
          const list = Array.from(e.target.files || []).slice(0, 5);
          if (list.length) setPendingFiles((prev) => [...prev, ...list].slice(0, 5));
          e.target.value = '';
        }}
      />
      <div className="px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
        <h2 className="text-base sm:text-lg font-semibold text-slate-900">{txt.messages}</h2>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        <div
          className={`w-full sm:w-72 border-r border-slate-200 overflow-y-auto bg-slate-50 flex-shrink-0 ${
            showMobileList ? 'flex flex-col' : 'hidden'
          } sm:flex sm:flex-col`}
        >
          {loading ? (
            <div className="p-4 text-center text-sm text-slate-500">{txt.loading}</div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">{txt.noConversations}</div>
          ) : (
            conversations.map((conv) => {
              const isClosed = !!conv.closed_at;
              const isActive = selectedConversation === conv.id;
              const name =
                mode === 'influencer'
                  ? conv.brand_name || txt.brandFallback
                  : displayNameForLang(conv.influencer_name, lang || 'el');
              const unread = conv.unread_count || 0;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setSelectedConversation(conv.id)}
                  className={`w-full text-left px-3 py-3 border-b border-slate-100 transition-colors flex gap-3 items-start ${
                    isActive ? 'bg-white border-l-2 border-l-blue-600' : 'hover:bg-white/80'
                  } ${isClosed ? 'opacity-70' : ''}`}
                >
                  <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-semibold shrink-0">
                    {chatInitial(name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${unread > 0 ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}>
                        {name}
                      </span>
                      <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                        {formatChatRelativeTime(conv.last_message_at, lang)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-xs text-slate-500 truncate">
                        {clipChatPreview(conv.last_message_preview || '') || '—'}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        {isClosed && (
                          <span className="text-[10px] text-red-600 font-medium">{txt.closedBadge}</span>
                        )}
                        {unread > 0 && (
                          <span className="min-w-[1.15rem] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-semibold flex items-center justify-center">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div
          className={`flex-1 flex flex-col min-w-0 min-h-0 ${
            showThreadPane ? 'flex' : 'hidden sm:flex'
          }`}
        >
          {selectedConversation ? (
            <>
              <div className="px-3 sm:px-4 py-2.5 border-b border-slate-200 bg-white relative z-20">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedConversation(null);
                      setShowActionsMenu(false);
                      setShowEndConfirm(false);
                    }}
                    className="sm:hidden shrink-0 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    ← {txt.back}
                  </button>
                  <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-semibold shrink-0">
                    {chatInitial(otherPartyName || '?')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-semibold text-slate-900 truncate">{otherPartyName}</h3>
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          (mode === 'brand' ? isInfluencerOnline : isBrandOnline)
                            ? 'bg-green-500'
                            : 'bg-slate-300'
                        }`}
                      />
                      <span className="text-[11px] text-slate-500">
                        {otherTyping
                          ? txt.typing
                          : formatActiveLabel(
                              mode === 'brand' ? influencerLastSeen : brandLastSeen,
                              mode === 'brand' ? isInfluencerOnline : isBrandOnline,
                              lang,
                              Date.now() + presenceTick * 0
                            )}
                      </span>
                    </div>
                  </div>
                  <div className="relative shrink-0" ref={actionsMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowActionsMenu((v) => !v)}
                      className="min-w-11 min-h-11 px-2 rounded-lg text-slate-600 hover:bg-slate-100 flex items-center justify-center gap-1 text-lg font-bold"
                      aria-label={txt.moreActions}
                      aria-expanded={showActionsMenu}
                      aria-haspopup="menu"
                    >
                      <span aria-hidden="true">···</span>
                      <span className="hidden sm:inline text-xs font-semibold">{txt.moreActions}</span>
                    </button>
                    {showActionsMenu && (
                      <div
                        role="menu"
                        className="absolute right-0 top-full mt-1 z-30 w-56 max-w-[calc(100vw-1.5rem)] bg-white border border-slate-200 rounded-xl shadow-lg py-1"
                      >
                        {proposalInfo && needsAgreement && (
                          <button
                            type="button"
                            role="menuitem"
                            className="w-full text-left px-3 min-h-11 py-2.5 text-sm text-amber-800 hover:bg-amber-50"
                            onClick={() => {
                              setShowAgreementModal(true);
                              setShowActionsMenu(false);
                            }}
                          >
                            {txt.acceptAgreement}
                          </button>
                        )}
                        {canShowAgreementSummary && proposalInfo && (
                          <button
                            type="button"
                            role="menuitem"
                            className="w-full text-left px-3 min-h-11 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                            onClick={() => {
                              setShowAgreementModal(true);
                              setShowActionsMenu(false);
                            }}
                          >
                            {txt.agreementSummary}
                          </button>
                        )}
                        {proposalInfo && hasAgreement && !bothAccepted && (
                          <div className="px-3 py-2.5 text-xs text-blue-700">{txt.agreementPending}</div>
                        )}
                        {proposalInfo && bothAccepted && (
                          <div className="px-3 py-2.5 text-xs text-green-700">{txt.agreementAccepted}</div>
                        )}
                        {!conversationClosed && (
                          <button
                            type="button"
                            role="menuitem"
                            className="w-full text-left px-3 min-h-11 py-2.5 text-sm text-red-600 hover:bg-red-50"
                            onClick={() => endConversation(false)}
                            disabled={endingConversation}
                          >
                            {endingConversation ? txt.endingConversation : txt.endConversation}
                          </button>
                        )}
                        {conversationClosed && (
                          <div className="px-3 py-2.5 text-xs text-slate-500">{txt.conversationClosed}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {showEndConfirm && (
                  <div className="mt-2 p-3 rounded-lg border border-red-200 bg-red-50">
                    <p className="text-sm font-medium text-red-900">{txt.endConfirmTitle}</p>
                    <p className="text-xs text-red-700 mt-0.5">{txt.endConfirmBody}</p>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => void confirmEndConversation()}
                        disabled={endingConversation}
                        className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        {endingConversation ? txt.endingConversation : txt.endConfirmYes}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEndConfirm(false)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white rounded-lg"
                      >
                        {txt.endConfirmNo}
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'brand' && selectedConversation && (influencerId || currentConversation?.influencer_id) && !isInfluencerOnline && !conversationClosed && (
                  <p className="text-xs text-amber-700 mt-2">{txt.offlineNotice}</p>
                )}
                {mode === 'influencer' && selectedConversation && !isBrandOnline && !conversationClosed && (
                  <p className="text-xs text-amber-700 mt-2">{txt.brandOfflineNotice}</p>
                )}
                {showInactivityWarning && !conversationClosed && (
                  <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-800">{txt.inactivityWarning}</p>
                  </div>
                )}
                {conversationClosed && (
                  <div className="mt-2 p-2.5 bg-slate-100 border border-slate-200 rounded-lg">
                    <p className="text-xs text-slate-700">
                      {conversationClosedByInactivity ? txt.conversationClosedInactivity : txt.conversationClosed}
                    </p>
                  </div>
                )}

                {proposalInfo && (
                  <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-[11px] font-semibold text-slate-700 mb-0.5">{txt.proposalCardTitle}</p>
                    <p className="text-xs text-slate-600">
                      <strong>{proposalInfo.service_type}</strong>
                      {' · '}
                      {txt.proposalOffered}: <strong>{proposalInfo.budget}€</strong>
                      {proposalInfo.counter_proposal_budget && proposalInfo.counter_proposal_status === 'pending' && (
                        <span className="text-amber-700">
                          {' · '}
                          {txt.proposalCounter}: <strong>{proposalInfo.counter_proposal_budget}€</strong>
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              <div
                ref={messageListRef}
                onScroll={onMessageListScroll}
                className="relative flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-1 bg-slate-50/80 pb-4"
              >
                {messages.length === 0 && (
                  <p className="text-center text-sm text-slate-500 py-8">{txt.emptyThread}</p>
                )}
                {messages.map((msg, index) => {
                  const isOwn =
                    (mode === 'influencer' && msg.sender_type === 'influencer') ||
                    (mode === 'brand' && msg.sender_type === 'brand');
                  const prev = messages[index - 1];
                  const showDay = !prev || !sameChatDay(prev.created_at, msg.created_at);

                  return (
                    <div key={msg.id}>
                      {showDay && (
                        <div className="flex justify-center my-3">
                          <span className="text-[10px] font-medium text-slate-500 bg-white/90 border border-slate-200 px-2.5 py-0.5 rounded-full">
                            {formatChatDayLabel(msg.created_at, lang)}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1.5`}>
                        <div
                          className={`max-w-[85%] sm:max-w-xs lg:max-w-md px-3.5 py-2 rounded-2xl ${
                            isOwn
                              ? 'bg-blue-600 text-white rounded-br-md'
                              : 'bg-white text-slate-900 border border-slate-200 rounded-bl-md shadow-sm'
                          }`}
                        >
                          {msg.content ? (
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          ) : null}
                          {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                            <div className={`mt-1.5 space-y-1.5 ${msg.content ? '' : ''}`}>
                              {msg.attachments.map((att, ai) => {
                                const isImg = String(att.content_type || '').startsWith('image/') ||
                                  /\.(webp|png|jpe?g|gif)$/i.test(att.url || '');
                                return (
                                  <a
                                    key={`${att.url}-${ai}`}
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`block text-xs underline-offset-2 hover:underline ${
                                      isOwn ? 'text-blue-100' : 'text-blue-700'
                                    }`}
                                  >
                                    {isImg ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={att.url}
                                        alt={att.filename || 'attachment'}
                                        className="max-h-40 rounded-lg border border-white/20 object-cover"
                                      />
                                    ) : (
                                      <span>📎 {att.filename || 'File'}</span>
                                    )}
                                  </a>
                                );
                              })}
                            </div>
                          )}
                          <div
                            className={`flex items-center gap-1.5 mt-1 ${
                              isOwn ? 'justify-end text-blue-100' : 'justify-start text-slate-400'
                            }`}
                          >
                            <span className="text-[10px] tabular-nums">
                              {new Date(msg.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {isOwn && (
                              <span className="text-[10px]">
                                {msg.localStatus === 'sending'
                                  ? txt.sending
                                  : msg.read
                                    ? `✓✓ ${txt.seen}`
                                    : `✓ ${txt.sent}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
                {unseenBelow > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      stickToBottomRef.current = true;
                      setUnseenBelow(0);
                      scrollToBottom(true);
                    }}
                    className="sticky bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-blue-600 text-white text-xs font-medium shadow"
                  >
                    {unseenBelow} {txt.newMessages}
                  </button>
                )}
              </div>

              <form onSubmit={sendMessage} className="px-3 sm:px-4 py-3 border-t border-slate-200 bg-white">
                {conversationClosed && (
                  <div className="mb-2 p-2 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-xs text-blue-700">{txt.reopenHint}</p>
                  </div>
                )}
                {pendingFiles.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {pendingFiles.map((f, i) => (
                      <span
                        key={`${f.name}-${i}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700"
                      >
                        📎 {f.name}
                        <button
                          type="button"
                          className="text-slate-500 hover:text-red-600"
                          onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          aria-label={txt.removeFile}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  <button
                    type="button"
                    title={txt.attachHint}
                    aria-label={txt.attach}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shrink-0 transition-colors"
                  >
                    <FaPaperclip className="w-4 h-4" aria-hidden />
                  </button>
                  <textarea
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      notifyTyping();
                    }}
                    onKeyDown={onComposerKeyDown}
                    placeholder={conversationClosed ? txt.reopenPlaceholder : txt.placeholder}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-slate-900 bg-white text-sm"
                    rows={2}
                  />
                  <button
                    type="submit"
                    disabled={sending || (!newMessage.trim() && pendingFiles.length === 0)}
                    className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm shrink-0"
                  >
                    {sending ? txt.sending : txt.send}
                  </button>
                </div>
                {sendError && (
                  <p className="mt-2 text-xs text-red-600">
                    {sendError}{' '}
                    <button type="submit" className="underline font-medium">{txt.retry}</button>
                  </p>
                )}
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {isComposingNew && influencerName && (
                <div className="px-4 py-3 border-b border-slate-200 bg-white shrink-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {displayNameForLang(influencerName || 'Influencer', lang || 'el')}
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isInfluencerOnline ? 'bg-green-500' : 'bg-slate-300'
                        }`}
                      />
                      <span className="text-[11px] text-slate-500">
                        {formatActiveLabel(influencerLastSeen, isInfluencerOnline, lang, Date.now() + presenceTick * 0)}
                      </span>
                    </div>
                  </div>
                  {!isInfluencerOnline && (
                    <p className="text-xs text-amber-700 mt-1">{txt.offlineNotice}</p>
                  )}
                </div>
              )}
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-4 min-h-0">
                <p className="text-center text-sm">
                  {isComposingNew
                    ? lang === 'el'
                      ? 'Γράψε παρακάτω για να ανοίξει η συνομιλία.'
                      : 'Type below to open the conversation.'
                    : txt.selectConversation}
                </p>
              </div>

              {influencerId && brandEmail && (
                <form onSubmit={sendMessage} className="px-3 sm:px-4 py-3 border-t border-slate-200 bg-white shrink-0">
                  {pendingFiles.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {pendingFiles.map((f, i) => (
                        <span
                          key={`${f.name}-${i}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700"
                        >
                          📎 {f.name}
                          <button
                            type="button"
                            className="text-slate-500 hover:text-red-600"
                            onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                            aria-label={txt.removeFile}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 items-end">
                    <button
                      type="button"
                      title={txt.attachHint}
                      aria-label={txt.attach}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shrink-0 transition-colors"
                    >
                      <FaPaperclip className="w-4 h-4" aria-hidden />
                    </button>
                    <textarea
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        notifyTyping();
                      }}
                      onKeyDown={onComposerKeyDown}
                      placeholder={txt.placeholder}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-slate-900 text-sm"
                      rows={2}
                    />
                    <button
                      type="submit"
                      disabled={sending || (!newMessage.trim() && pendingFiles.length === 0)}
                      className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm shrink-0"
                    >
                      {sending ? txt.sending : txt.send}
                    </button>
                  </div>
                  {sendError && (
                    <p className="mt-2 text-xs text-red-600">
                      {sendError}{' '}
                      <button type="submit" className="underline font-medium">{txt.retry}</button>
                    </p>
                  )}
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

