"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { appendDictation, transcriptFromResults, type SpeechResultLike } from "@/lib/dictation";
import { Mic, Send } from 'lucide-react';
import { FaPaperclip } from 'react-icons/fa';
import { supabase } from '@/lib/supabaseClient';
import { displayNameForLang } from '@/lib/greeklish';
import {
  formatChatRelativeTime,
  formatChatDayLabel,
  sameChatDay,
  clipChatPreview,
} from '@/lib/chatTime';
import { formatTime } from '@/lib/formatDateTime';
import { isTimeoutError, withTimeout } from '@/lib/withTimeout';
import ToastViewport, { useToasts } from '@/components/ui/Toast';
import { formatActiveLabel, presenceOnline } from '@/lib/presenceStatus';
import { counterpartyBrandPresence } from '@/lib/presenceIdentity';
import { getInfluencerPresenceCached } from '@/lib/presenceCache';
import { sessionFetch } from '@/lib/sessionFetch';
import { unreadAfterRefresh, type ReadMark } from '@/lib/messageRead';
import { formatEuroAmount } from '@/lib/formatEuro';
import { displayServiceType } from '@/lib/campaignServiceLabel';
import { displayProposalThread } from '@/lib/proposalThreadCopy';
import { formatProposalExtrasLine } from '@/lib/proposalFloor';
import AgreementTerms from '@/components/AgreementTerms';
import dynamic from 'next/dynamic';
import ChatAvatar from '@/components/ChatAvatar';
import ImageLightbox from '@/components/ImageLightbox';
import LinkPreview from '@/components/LinkPreview';
import { openDockedChat } from '@/components/ChatDock';
import { firstLink, splitLinks } from '@/lib/linkify';
import { insertAtCursor } from '@/lib/emojiData';

const EmojiPicker = dynamic(() => import('@/components/EmojiPicker'), { ssr: false });

function SendMessageButton({
  sending,
  disabled,
  label,
}: {
  sending: boolean;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-busy={sending}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-blue-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
    >
      {sending ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" aria-hidden />
      ) : (
        <Send className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      )}
    </button>
  );
}

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
  selected_extras?: unknown;
  publish_deadline?: string | null;
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
  emptyCta?: { label: string; onClick: () => void } | null;
  onLeaveThread?: () => void;
  /** Thread-only view for the desktop docked chat window. */
  compact?: boolean;
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
    dictate: "Φωνητική πληκτρολόγηση",
    micDenied: "Δεν δόθηκε άδεια μικροφώνου.",
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
    dictate: "Voice typing",
    micDenied: "Microphone access was denied.",
  }
};

type SpeechResultList = SpeechResultLike;

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function speechRecognitionCtor(): (new () => BrowserSpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  return host.SpeechRecognition || host.webkitSpeechRecognition || null;
}

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
  emptyCta = null,
  onLeaveThread,
  compact = false,
}: MessagingProps) {
  const txt = t[lang];
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();
  const notify = useCallback(
    (message: string, tone: 'success' | 'error' | 'info' = 'info') => pushToast(message, tone),
    [pushToast]
  );
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);
  const [sending, setSending] = useState(false);
  const [isInfluencerOnline, setIsInfluencerOnline] = useState(false);
  const [isBrandOnline, setIsBrandOnline] = useState(false);
  const [influencerLastSeen, setInfluencerLastSeen] = useState<string | null>(null);
  const [brandLastSeen, setBrandLastSeen] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [unseenBelow, setUnseenBelow] = useState(0);
  const [sendError, setSendError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const wantDictationRef = useRef(false);
  const dictationPrefixRef = useRef("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [avatarMap, setAvatarMap] = useState<{ influencers: Record<string, string>; brands: Record<string, string> }>({ influencers: {}, brands: {} });
  const [avatarLightbox, setAvatarLightbox] = useState(false);
  const [imageLightbox, setImageLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [convSearch, setConvSearch] = useState('');
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const newMessageRef = useRef("");
  newMessageRef.current = newMessage;
  const [presenceTick, setPresenceTick] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef(0);
  const lastSentMessageRef = useRef<string>('');
  const applyInboxMessageRef = useRef<(msg: Message) => void>(() => {});
  const markReadRef = useRef<(convId: string) => void>(() => {});
  const readMarksRef = useRef(new Map<string, ReadMark>());
  const selectedConversationRef = useRef<string | null>(selectedConversation);
  selectedConversationRef.current = selectedConversation;
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
  // NOTE: depends on `mode` only (never `lang`) so a language flip does not
  // re-trigger the loading gate. The timer is a safety net so the list can
  // never stay on "Loading…" if a request hangs.
  useEffect(() => {
    let finished = false;
    const safety = window.setTimeout(() => {
      if (finished) return;
      setLoading(false);
      setLoadError(lang === 'el' ? 'Η φόρτωση άργησε.' : 'Loading took too long.');
    }, 20000);
    void loadConversations().finally(() => {
      finished = true;
      window.clearTimeout(safety);
    });
    return () => {
      finished = true;
      window.clearTimeout(safety);
    };
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

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let interval = 0;

    const subscribe = () => {
      if (channel) return;
      channel = supabase
        .channel(`influencer_presence_watch:${watchedInfluencerId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'influencer_presence',
            filter: `influencer_id=eq.${watchedInfluencerId}`,
          },
          () => {
            void checkInfluencerStatus(watchedInfluencerId);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'influencer_presence',
            filter: `influencer_id=eq.${watchedInfluencerId}`,
          },
          () => {
            void checkInfluencerStatus(watchedInfluencerId);
          }
        )
        .subscribe();
    };

    const teardown = () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };

    const startFallback = () => {
      window.clearInterval(interval);
      interval = window.setInterval(() => {
        if (document.hidden) return;
        void checkInfluencerStatus(watchedInfluencerId);
      }, 120_000);
    };

    void checkInfluencerStatus(watchedInfluencerId);
    if (!document.hidden) {
      subscribe();
      startFallback();
    }

    const onVisibility = () => {
      if (document.hidden) {
        teardown();
        window.clearInterval(interval);
        interval = 0;
      } else {
        void checkInfluencerStatus(watchedInfluencerId);
        subscribe();
        startFallback();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
      teardown();
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

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let interval = 0;
    const emailFilter = `brand_email=eq.${watchedBrandEmail.toLowerCase().trim()}`;

    const subscribe = () => {
      if (channel) return;
      channel = supabase
        .channel(`brand_presence_watch:${watchedBrandEmail}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'brand_presence',
            filter: emailFilter,
          },
          () => {
            void checkBrandStatus(watchedBrandEmail);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'brand_presence',
            filter: emailFilter,
          },
          () => {
            void checkBrandStatus(watchedBrandEmail);
          }
        )
        .subscribe();
    };

    const teardown = () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };

    const startFallback = () => {
      window.clearInterval(interval);
      interval = window.setInterval(() => {
        if (document.hidden) return;
        void checkBrandStatus(watchedBrandEmail);
      }, 120_000);
    };

    void checkBrandStatus(watchedBrandEmail);
    if (!document.hidden) {
      subscribe();
      startFallback();
    }

    const onVisibility = () => {
      if (document.hidden) {
        teardown();
        window.clearInterval(interval);
        interval = 0;
      } else {
        void checkBrandStatus(watchedBrandEmail);
        subscribe();
        startFallback();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
      teardown();
    };
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
      notify(lang === 'el' 
        ? 'Αποτυχία τερματισμού συνομιλίας. Παρακαλώ δοκιμάστε ξανά.'
        : 'Failed to end conversation. Please try again.', 'error');
    } finally {
      setEndingConversation(false);
    }
  }, [selectedConversation, endingConversation, lang, notify]);

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
      notify(lang === 'el'
        ? 'Αποτυχία τερματισμού συνομιλίας. Παρακαλώ δοκιμάστε ξανά.'
        : 'Failed to end conversation. Please try again.', 'error');
    } finally {
      setEndingConversation(false);
    }
  }, [selectedConversation, endingConversation, lang, notify]);

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
      if (document.visibilityState === 'visible') {
        markReadRef.current(selectedConversation);
      }
      (async () => {
        await loadActivityTimestamps(selectedConversation);
        await loadMessages(selectedConversation);
      })();
      // NOTE: We do NOT update activity timestamp when opening conversation
      // Activity should only be updated on actual user actions (typing, sending, etc.)
      // Realtime for this thread only. Tear down while the tab is hidden.
      let realtimeOk = false;
      let subscription: ReturnType<typeof supabase.channel> | null = null;
      let typingChannel: ReturnType<typeof supabase.channel> | null = null;
      let fallback = 0;
      let activityInterval = 0;
      const convId = selectedConversation;

      const onInsert = (payload: { new: Message }) => {
        const newMsg = payload.new as Message;
        const isOurMessage =
          lastSentMessageRef.current && newMsg.content.trim() === lastSentMessageRef.current;

        if (!isOurMessage) {
          playNotificationSound();
        } else {
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

        if (!isOurMessage && newMsg.sender_type !== mode && document.visibilityState === 'visible') {
          markReadRef.current(convId);
        }

        if (mode === 'influencer' && newMsg.sender_type === 'brand') {
          const currentConv = conversations.find((c) => c.id === convId);
          const emailToCheck = currentConv?.brand_email || (brandEmail as string | undefined);
          if (emailToCheck) void checkBrandStatus(emailToCheck);
        }
        if (mode === 'brand' && newMsg.sender_type === 'influencer') {
          const currentConv = conversations.find((c) => c.id === convId);
          const idToCheck = currentConv?.influencer_id || influencerId;
          if (idToCheck) void checkInfluencerStatus(idToCheck);
        }
      };

      const onUpdate = (payload: { new: Message }) => {
        const updated = payload.new as Message;
        setMessages((prev) =>
          prev.map((m) => (m.id === updated.id ? { ...m, read: updated.read } : m))
        );
      };

      const teardownRealtime = () => {
        if (subscription) {
          supabase.removeChannel(subscription);
          subscription = null;
        }
        if (typingChannel) {
          supabase.removeChannel(typingChannel);
          typingChannel = null;
          typingChannelRef.current = null;
        }
        realtimeOk = false;
      };

      const startRealtime = () => {
        if (subscription) return;
        subscription = supabase
          .channel(`messages:${convId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=eq.${convId}`,
            },
            onInsert
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=eq.${convId}`,
            },
            onUpdate
          )
          .subscribe((status) => {
            realtimeOk = status === 'SUBSCRIBED';
          });

        typingChannel = supabase.channel(`typing:${convId}`);
        typingChannelRef.current = typingChannel;
        typingChannel
          .on('broadcast', { event: 'typing' }, ({ payload }) => {
            const role = (payload as { role?: string } | null)?.role;
            if (role && role !== mode) {
              setOtherTyping(true);
              window.setTimeout(() => setOtherTyping(false), 2500);
            }
          })
          .subscribe();
      };

      const startTimers = () => {
        window.clearInterval(fallback);
        window.clearInterval(activityInterval);
        // Fallback only when Realtime is down; never under 2 minutes.
        fallback = window.setInterval(() => {
          if (document.hidden || realtimeOk) return;
          void loadMessages(convId);
        }, 120_000);
        activityInterval = window.setInterval(() => {
          if (document.hidden) return;
          updateActivityTimestamp();
        }, 120_000);
      };

      if (!document.hidden) {
        startRealtime();
        startTimers();
      }

      const onVisibility = () => {
        if (document.hidden) {
          teardownRealtime();
          window.clearInterval(fallback);
          window.clearInterval(activityInterval);
          fallback = 0;
          activityInterval = 0;
        } else {
          void loadMessages(convId);
          startRealtime();
          startTimers();
        }
      };
      document.addEventListener('visibilitychange', onVisibility);

      return () => {
        document.removeEventListener('visibilitychange', onVisibility);
        teardownRealtime();
        window.clearInterval(activityInterval);
        window.clearInterval(fallback);
        setOtherTyping(false);
      };
    } else {
      setShowActionsMenu(false);
      setShowEndConfirm(false);
    }
  }, [selectedConversation]);

  // Inbox list: mount + Realtime only (no interval). Pause channel while hidden.
  useEffect(() => {
    const filter =
      mode === 'influencer' && influencerId
        ? `influencer_id=eq.${influencerId}`
        : mode === 'brand' && brandEmail
          ? `brand_email=eq.${brandEmail.toLowerCase().trim()}`
          : null;
    if (!filter) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const onChange = () => {
      void loadConversations(true);
    };

    const subscribe = () => {
      if (channel) return;
      channel = supabase
        .channel(`inbox-conv:${mode}:${influencerId || brandEmail}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'conversations', filter },
          onChange
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'conversations', filter },
          onChange
        )
        .subscribe();
    };

    const teardown = () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };

    if (!document.hidden) subscribe();

    const onFocus = () => {
      void loadConversations(true);
    };
    const onVisibility = () => {
      if (document.hidden) {
        teardown();
      } else {
        void loadConversations(true);
        subscribe();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      teardown();
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
        if (document.hidden) return;
        void checkInactivity();
      }, 60 * 1000);

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
      if (document.hidden) return;
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
              // Ignore - Vercel cron θα το κλείσει αργότερα
            }
          }
          
          // Refresh conversation state to reflect any closures
          if (selectedConversation) {
            await loadActivityTimestamps(selectedConversation);
            await loadConversations(true);
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
    if (!silent) {
      setLoading(true);
      setLoadError(null);
    }
    const fetchStartedAt = Date.now();
    try {
      const enriched = await withTimeout((async () => {
      let query = supabase
        .from('conversations')
        .select(
          'id, influencer_id, influencer_name, influencer_email, brand_email, brand_name, last_message_at, last_activity_influencer, last_activity_brand, closed_at, proposal_id'
        );

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
      return enrichConversationRows(rows);
      })(), 20000);
      setLoadError(null);
      setConversations(
        enriched.map((c) => ({
          ...c,
          unread_count:
            c.id === selectedConversationRef.current
              ? unreadAfterRefresh(
                  c.unread_count || 0,
                  readMarksRef.current.get(c.id),
                  fetchStartedAt,
                )
              : c.unread_count || 0,
        })),
      );

      if (silent) return;

      // Auto-select: deep-link / desktop first; mobile keeps list until user picks.
      if (mode === 'brand' && brandEmail && enriched.length === 0 && influencerId) {
        // Νέα συνομιλία — το πρώτο μήνυμα δημιουργεί conversation
      } else if (enriched.length > 0 && !selectedConversation) {
        if (mode === 'brand' && influencerId) {
          const match = enriched.find((c) => c.influencer_id === influencerId);
          if (match) setSelectedConversation(match.id);
        } else if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
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
      if (!silent) {
        setLoadError(
          isTimeoutError(error)
            ? lang === 'el'
              ? 'Η φόρτωση άργησε. Δοκίμασε ξανά.'
              : 'This took too long. Try again.'
            : lang === 'el'
              ? 'Τα μηνύματα δεν φορτώθηκαν.'
              : 'Messages could not be loaded.'
        );
      }
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
      notify(lang === 'el'
        ? 'Διάβασε και αποδέξου τους όρους της συμφωνίας.'
        : 'Read and accept the agreement terms.', 'error');
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
        notify(lang === 'el'
          ? mode === 'influencer'
            ? 'Η συμφωνία έγινε αποδεκτή. Η επιχείρηση θα προστεθεί στις συνεργασίες σας όταν αποδεχτεί και εκείνη.'
            : 'Η συμφωνία έγινε αποδεκτή. Θα προστεθείτε στις συνεργασίες του δημιουργού όταν αποδεχτεί και εκείνος.'
          : mode === 'influencer'
            ? 'Agreement accepted. The brand will be added to your collaborations once they accept too.'
            : 'Agreement accepted. You will be added to the creator’s collaborations once they accept too.', 'success');
      } else {
        throw new Error(result.error || (lang === 'el' ? 'Σφάλμα αποδοχής συμφωνίας' : 'Error accepting agreement'));
      }
    } catch (error: any) {
      console.error('Error accepting agreement:', error);
      notify(lang === 'el' 
        ? 'Σφάλμα: ' + error.message 
        : 'Error: ' + error.message, 'error');
    } finally {
      setSavingAgreement(false);
    }
  };

  const loadMessages = async (convId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, sender_type, content, attachments, read, created_at')
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
    const startedAt = Date.now();
    readMarksRef.current.set(convId, { startedAt, confirmedAt: null });
    setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c)));
    const stillThisAttempt = () => readMarksRef.current.get(convId)?.startedAt === startedAt;
    try {
      const response = await sessionFetch('/api/messages/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, as: mode }),
      });
      const result = await response.json().catch(() => ({}));
      if (!stillThisAttempt()) return;
      if (!response.ok || !result.success) {
        readMarksRef.current.delete(convId);
        void loadConversations(true);
        return;
      }
      const ids: string[] = Array.isArray(result.ids) ? result.ids : [];
      readMarksRef.current.set(convId, { startedAt, confirmedAt: Date.now() });
      if (ids.length > 0) {
        const idSet = new Set(ids);
        setMessages((prev) => prev.map((m) => (idSet.has(m.id) ? { ...m, read: true } : m)));
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.conversation_id === convId && m.sender_type !== mode ? { ...m, read: true } : m
          )
        );
      }
      if (selectedConversationRef.current === convId) {
        setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c)));
      }
      window.dispatchEvent(new CustomEvent('messagesRead', {
        detail: { conversationId: convId, count: ids.length },
      }));
    } catch (error) {
      console.error('Error marking messages read:', error);
      if (!stillThisAttempt()) return;
      readMarksRef.current.delete(convId);
      void loadConversations(true);
    }
  };
  markReadRef.current = (convId: string) => {
    void markVisibleAsRead(convId);
  };

  const stopDictation = useCallback(() => {
    wantDictationRef.current = false;
    setListening(false);
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    try {
      recognition?.abort();
    } catch {
      /* already stopped */
    }
  }, []);

  const toggleDictation = useCallback(() => {
    if (wantDictationRef.current) {
      stopDictation();
      return;
    }
    const Ctor = speechRecognitionCtor();
    if (!Ctor) return;
    setMicDenied(false);
    dictationPrefixRef.current = newMessageRef.current;
    const recognition = new Ctor();
    recognition.lang = lang === "en" ? "en-US" : "el-GR";
    recognition.interimResults = true;
    // Single session: continuous mode on Android restarts/beeps and repeats words cumulatively.
    recognition.continuous = false;
    recognition.onresult = (event) => {
      if (!wantDictationRef.current || recognitionRef.current !== recognition) return;
      const { text } = transcriptFromResults(event.results);
      setNewMessage(appendDictation(dictationPrefixRef.current, text));
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setMicDenied(true);
      }
      wantDictationRef.current = false;
      setListening(false);
    };
    recognition.onend = () => {
      // No auto-restart (that caused the repeated beeps); user taps the mic again to continue.
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      wantDictationRef.current = false;
      setListening(false);
    };
    recognitionRef.current = recognition;
    wantDictationRef.current = true;
    try {
      recognition.start();
      setListening(true);
    } catch {
      wantDictationRef.current = false;
      recognitionRef.current = null;
      setListening(false);
    }
  }, [lang, stopDictation]);

  const avatarKey = conversations.map((c) => c.id).join(',');
  useEffect(() => {
    if (!avatarKey) return;
    let alive = true;
    sessionFetch('/api/messages/avatars')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setAvatarMap({ influencers: d.influencers || {}, brands: d.brands || {} });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [avatarKey]);

  useEffect(() => {
    setSpeechSupported(speechRecognitionCtor() != null);
    return () => {
      wantDictationRef.current = false;
      try {
        recognitionRef.current?.abort();
      } catch {
        /* already stopped */
      }
    };
  }, []);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    stopDictation();
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
      if (convId) {
        const reopenedId = convId;
        setConversations((prev) =>
          prev.map((c) => (c.id === reopenedId ? { ...c, closed_at: null } : c))
        );
      }

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
    setPinnedToBottom(nearBottom);
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
      const row = await getInfluencerPresenceCached(id, { force: true });
      if (gen !== influencerWatchGen.current) return;
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

  const avatarFor = (c?: Conversation | null): string | null => {
    if (!c) return null;
    return mode === 'influencer'
      ? avatarMap.brands[String(c.brand_email || '').toLowerCase()] || null
      : avatarMap.influencers[c.influencer_id] || null;
  };
  const insertEmoji = (emoji: string) => {
    const el = composerRef.current;
    const cur = newMessageRef.current;
    const { value, caret } = insertAtCursor(cur, emoji, el ? el.selectionStart : null, el ? el.selectionEnd : null);
    setNewMessage(value);
    requestAnimationFrame(() => {
      if (!el) return;
      try { el.setSelectionRange(caret, caret); } catch { /* noop */ }
    });
  };

  const currentConversation = conversations.find(c => c.id === selectedConversation);
  const otherPartyAvatar = avatarFor(currentConversation);
  const otherPartyName = mode === 'influencer' 
    ? currentConversation?.brand_name || txt.brandFallback
    : displayNameForLang(currentConversation?.influencer_name, lang || 'el');

  const isComposingNew =
    mode === 'brand' && !!influencerId && !!brandEmail && !selectedConversation && !initialConversationId;
  const showMobileList = !selectedConversation && !isComposingNew;
  const showThreadPane = !!selectedConversation || isComposingNew;

  return (
    <div className={compact ? "bg-white h-full flex flex-col overflow-hidden" : "bg-white rounded-xl sm:rounded-2xl shadow-lg border border-slate-200 h-[min(720px,calc(100vh-12rem))] min-h-[480px] flex flex-col overflow-hidden"}>
      {otherPartyAvatar ? (
        <ImageLightbox src={otherPartyAvatar} alt={otherPartyName || ''} open={avatarLightbox} onClose={() => setAvatarLightbox(false)} lang={lang === 'en' ? 'en' : 'el'} />
      ) : null}
<ImageLightbox src={imageLightbox?.src || ''} alt={imageLightbox?.alt || ''} open={!!imageLightbox} onClose={() => setImageLightbox(null)} lang={lang === 'en' ? 'en' : 'el'} />
      <ToastViewport toasts={toasts} onDismiss={dismissToast} dismissLabel={lang === 'el' ? 'Κλείσιμο' : 'Dismiss'} />
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
      <div className={`px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2 ${compact ? 'hidden' : ''}`}>
        <h2 className="text-base sm:text-lg font-semibold text-slate-900">{txt.messages}</h2>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        <div
          className={`w-full md:w-72 border-r border-slate-200 overflow-y-auto bg-slate-50 flex-shrink-0 ${
            compact ? 'hidden' : showMobileList ? 'flex flex-col' : 'hidden'
          } ${compact ? '' : 'md:flex md:flex-col'}`}
        >
          {conversations.length > 3 ? (
            <div className="p-2 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
              <input
                type="search"
                value={convSearch}
                onChange={(e) => setConvSearch(e.target.value)}
                placeholder={lang === 'en' ? 'Search conversations' : 'Αναζήτηση συνομιλίας'}
                aria-label={lang === 'en' ? 'Search conversations' : 'Αναζήτηση συνομιλίας'}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
              />
            </div>
          ) : null}
          {loadError && conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-600">
              <p>{loadError}</p>
              <button
                type="button"
                onClick={() => void loadConversations()}
                className="mt-3 inline-flex min-h-11 items-center px-4 rounded-lg bg-slate-900 text-white text-sm font-medium"
              >
                {lang === 'el' ? 'Δοκίμασε ξανά' : 'Try again'}
              </button>
            </div>
          ) : loading && conversations.length === 0 ? (
            <div className="p-3 space-y-2" aria-busy="true">
              <div className="h-16 rounded-lg bg-slate-200 animate-pulse" />
              <div className="h-16 rounded-lg bg-slate-200 animate-pulse" />
              <div className="h-16 rounded-lg bg-slate-200 animate-pulse" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              <p>{txt.noConversations}</p>
              {emptyCta ? (
                <button
                  type="button"
                  onClick={emptyCta.onClick}
                  className="mt-4 inline-flex min-h-11 items-center px-4 rounded-lg bg-slate-900 text-white text-sm font-medium"
                >
                  {emptyCta.label}
                </button>
              ) : null}
            </div>
          ) : (
            conversations.filter((conv) => {
              const q = convSearch.trim().toLowerCase();
              if (!q) return true;
              const nm = mode === 'influencer' ? conv.brand_name || '' : displayNameForLang(conv.influencer_name, lang || 'el');
              return `${nm} ${conv.last_message_preview || ''}`.toLowerCase().includes(q);
            }).map((conv) => {
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
                  className={`w-full text-left min-h-11 px-3 py-3 border-b border-slate-100 transition-colors flex gap-3 items-start ${
                    isActive ? 'bg-white border-l-2 border-l-blue-600' : 'hover:bg-white/80'
                  } ${isClosed ? 'opacity-70' : ''}`}
                >
                  <ChatAvatar src={avatarFor(conv)} name={name} size={40} />
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
                        {clipChatPreview(displayProposalThread(conv.last_message_preview || '', lang)) || '—'}
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
            showThreadPane ? 'flex' : 'hidden md:flex'
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
                    className={`${compact ? 'hidden' : 'md:hidden'} shrink-0 inline-flex min-h-11 items-center px-3 text-sm text-slate-600 hover:bg-slate-100 rounded-lg`}
                  >
                    ← {txt.back}
                  </button>
                  <ChatAvatar src={otherPartyAvatar} name={otherPartyName || '?'} size={36} onClick={() => setAvatarLightbox(true)} />
                  {!compact && selectedConversation ? (
                    <button
                      type="button"
                      onClick={() => openDockedChat({ id: selectedConversation, name: otherPartyName || '' })}
                      title="Άνοιγμα σε παράθυρο"
                      aria-label="Άνοιγμα σε παράθυρο"
                      className="order-last hidden lg:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M11 3h6v6M17 3l-7 7M9 5H4v11h11v-5" /></svg>
                    </button>
                  ) : null}
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
                      <strong>{displayServiceType(proposalInfo.service_type, lang)}</strong>
                      {' · '}
                      {txt.proposalOffered}: <strong>{formatEuroAmount(proposalInfo.budget, lang === 'en' ? 'en' : 'el')}</strong>
                      {proposalInfo.counter_proposal_budget && proposalInfo.counter_proposal_status === 'pending' && (
                        <span className="text-amber-700">
                          {' · '}
                          {txt.proposalCounter}: <strong>{formatEuroAmount(proposalInfo.counter_proposal_budget, lang === 'en' ? 'en' : 'el')}</strong>
                        </span>
                      )}
                    </p>
                    {formatProposalExtrasLine(proposalInfo.selected_extras, lang === 'en' ? 'en' : 'el') ? (
                      <p className="mt-1 text-xs text-slate-600">
                        {formatProposalExtrasLine(proposalInfo.selected_extras, lang === 'en' ? 'en' : 'el')}
                      </p>
                    ) : null}
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
                  const next = messages[index + 1];
                  const lastOfGroup = !next || next.sender_type !== msg.sender_type || !sameChatDay(msg.created_at, next.created_at);
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
                      <div className={`flex items-end gap-1.5 ${isOwn ? 'justify-end' : 'justify-start'} mb-1.5`}>
                        {!isOwn && (
                          <span className="w-7 shrink-0">
                            {lastOfGroup ? <ChatAvatar src={otherPartyAvatar} name={otherPartyName || '?'} size={28} /> : null}
                          </span>
                        )}
                        <div
                          className={`max-w-[85%] sm:max-w-xs lg:max-w-md px-3.5 py-2 rounded-2xl ${
                            isOwn
                              ? 'bg-blue-600 text-white rounded-br-md'
                              : 'bg-white text-slate-900 border border-slate-200 rounded-bl-md shadow-sm'
                          }`}
                        >
                          {msg.content ? (
                            <>
                              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                                {splitLinks(displayProposalThread(msg.content, lang)).map((part, pi) =>
                                  part.type === 'link' ? (
                                    <a key={pi} href={part.value} target="_blank" rel="noopener noreferrer" className={`underline underline-offset-2 break-all ${isOwn ? 'text-white' : 'text-blue-700'}`}>
                                      {part.value}
                                    </a>
                                  ) : (
                                    <span key={pi}>{part.value}</span>
                                  )
                                )}
                              </p>
                              {firstLink(msg.content) ? <LinkPreview url={firstLink(msg.content) as string} own={isOwn} /> : null}
                            </>
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
                                    onClick={(e) => {
                                      if (!isImg) return;
                                      e.preventDefault();
                                      setImageLightbox({ src: att.url, alt: att.filename || '' });
                                    }}
                                    className={`block text-xs underline-offset-2 hover:underline ${
                                      isOwn ? 'text-blue-100' : 'text-blue-700'
                                    }`}
                                  >
                                    {isImg ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={att.url}
                                        alt={att.filename || 'attachment'}
                                        loading="lazy"
                                        className="max-h-40 rounded-lg border border-white/20 object-cover cursor-zoom-in"
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
                              {formatTime(msg.created_at, lang)}
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
                {(!pinnedToBottom || unseenBelow > 0) && (
                  <button
                    type="button"
                    aria-label={lang === 'el' ? 'Μετάβαση στα τελευταία' : 'Jump to latest'}
                    onClick={() => {
                      stickToBottomRef.current = true;
                      setPinnedToBottom(true);
                      setUnseenBelow(0);
                      scrollToBottom(true);
                    }}
                    className="sticky bottom-2 left-1/2 -translate-x-1/2 inline-flex min-h-11 items-center px-4 rounded-full bg-blue-600 text-white text-xs font-medium shadow"
                  >
                    {unseenBelow > 0
                      ? `${unseenBelow} ${txt.newMessages}`
                      : (lang === 'el' ? 'Τελευταία' : 'Latest')}
                  </button>
                )}
              </div>

              <form onSubmit={sendMessage} className="px-3 sm:px-4 py-3 border-t border-slate-200 bg-white">
                {conversationClosed ? (
                  <p className="mb-2 text-xs text-slate-600 text-center">{txt.reopenHint}</p>
                ) : null}
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
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      data-emoji-toggle
                      onClick={() => setEmojiOpen((v) => !v)}
                      aria-label="Emoji"
                      title="Emoji"
                      aria-expanded={emojiOpen}
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-xl transition-colors ${emojiOpen ? 'bg-slate-100' : 'hover:bg-slate-100'}`}
                    >
                      <span aria-hidden>😊</span>
                    </button>
                    {emojiOpen ? <EmojiPicker onPick={insertEmoji} onClose={() => setEmojiOpen(false)} /> : null}
                  </div>
                  <textarea
                    ref={composerRef}
                    value={newMessage}
                    onChange={(e) => {
                      if (wantDictationRef.current) stopDictation();
                      setNewMessage(e.target.value);
                      notifyTyping();
                    }}
                    onKeyDown={onComposerKeyDown}
                    placeholder={txt.placeholder}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 resize-none text-slate-900 bg-white text-sm"
                    rows={2}
                  />
                  {speechSupported ? (
                    <button
                      type="button"
                      onClick={toggleDictation}
                      aria-label={txt.dictate}
                      title={txt.dictate}
                      aria-pressed={listening}
                      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
                        listening
                          ? "animate-pulse bg-red-50 text-red-600 ring-2 ring-red-200"
                          : "text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      <Mic className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                    </button>
                  ) : null}
                  <SendMessageButton
                    sending={sending}
                    disabled={sending || (!newMessage.trim() && pendingFiles.length === 0)}
                    label={txt.send}
                  />
                </div>
                {micDenied ? <p className="mt-2 text-xs text-red-600">{txt.micDenied}</p> : null}
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
                    <div className="flex items-center gap-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => onLeaveThread?.()}
                      className="md:hidden inline-flex min-h-11 items-center px-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      ← {txt.back}
                    </button>
                    <h3 className="text-sm font-semibold text-slate-900 truncate">
                      {displayNameForLang(influencerName || 'Influencer', lang || 'el')}
                    </h3>
                    </div>
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
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        data-emoji-toggle
                        onClick={() => setEmojiOpen((v) => !v)}
                        aria-label="Emoji"
                        title="Emoji"
                        aria-expanded={emojiOpen}
                        className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-xl transition-colors ${emojiOpen ? 'bg-slate-100' : 'hover:bg-slate-100'}`}
                      >
                        <span aria-hidden>😊</span>
                      </button>
                      {emojiOpen ? <EmojiPicker onPick={insertEmoji} onClose={() => setEmojiOpen(false)} /> : null}
                    </div>
                    <textarea
                      ref={composerRef}
                      value={newMessage}
                      onChange={(e) => {
                        if (wantDictationRef.current) stopDictation();
                        setNewMessage(e.target.value);
                        notifyTyping();
                      }}
                      onKeyDown={onComposerKeyDown}
                      placeholder={txt.placeholder}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 resize-none text-slate-900 text-sm"
                      rows={2}
                    />
                    {speechSupported ? (
                      <button
                        type="button"
                        onClick={toggleDictation}
                        aria-label={txt.dictate}
                        title={txt.dictate}
                        aria-pressed={listening}
                        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
                          listening
                            ? "animate-pulse bg-red-50 text-red-600 ring-2 ring-red-200"
                            : "text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        <Mic className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                      </button>
                    ) : null}
                    <SendMessageButton
                      sending={sending}
                      disabled={sending || (!newMessage.trim() && pendingFiles.length === 0)}
                      label={txt.send}
                    />
                  </div>
                  {micDenied ? <p className="mt-2 text-xs text-red-600">{txt.micDenied}</p> : null}
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
        <AgreementTerms
          lang={lang === 'en' ? 'en' : 'el'}
          proposalId={proposalInfo.id}
          brandName={proposalInfo.brand_name || brandName || ''}
          creatorName={displayNameForLang(influencerName || currentConversation?.influencer_name, lang === 'en' ? 'en' : 'el')}
          serviceType={proposalInfo.service_type}
          budget={proposalInfo.budget}
          counterProposalBudget={proposalInfo.counter_proposal_budget}
          counterProposalStatus={proposalInfo.counter_proposal_status}
          selectedExtras={proposalInfo.selected_extras}
          publishDeadline={proposalInfo.publish_deadline}
          accepted={agreementAccepted}
          onAcceptedChange={setAgreementAccepted}
          saving={savingAgreement}
          onCancel={() => {
            setShowAgreementModal(false);
            setAgreementAccepted(false);
          }}
          onAccept={handleAcceptAgreement}
        />
      )}


    </div>
  );
}

