"use client";

import { useEffect, useState, use, Suspense, useRef } from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { Influencer } from "@/components/Directory"; 
import { supabase } from "@/lib/supabaseClient";
import { getVideoThumbnail, isVideoUrl, isDefinitelyVideo, isDefinitelyImage, detectProvider, getIframelyEmbedUrl } from "@/lib/videoThumbnail";
import VideoThumbnail from "@/components/VideoThumbnail";
import SocialEmbedCard from "@/components/SocialEmbedCard";
import { getBadges, getBadgeStyles } from "@/lib/badges";
import Avatar from "@/components/Avatar";
import { getStoredLanguage, setStoredLanguage } from "@/lib/language";
import { categoryTranslations } from "@/components/categoryTranslations";

type Params = Promise<{ id: string }>;

interface ProInfluencer extends Influencer {
  video_thumbnails?: Record<string, string> | null;
  contact_email?: string;
  engagement_rate?: string | { [key: string]: string }; // Can be per-platform object or legacy string
  avg_likes?: string | { [key: string]: string }; // Can be per-platform object or legacy string
  audience_data?: { male: number; female: number; top_age: string };
  rate_card?: { story?: string; post?: string; reel?: string; facebook?: string; youtube?: string };
  past_brands?: string[];
  avg_rating?: number;
  total_reviews?: number;
  avg_response_time?: number;
  completion_rate?: number;
  availability_status?: string;
  skills?: string[];
  certifications?: string[];
  service_packages?: Array<{ name: string; description: string; price: string; includes: string[] }>;
  calculatedCompletionRate?: number;
  created_at?: string;
  /** Gemini audit from Auditpr (updated only when followers/engagement/avg_likes are refreshed). */
  auditpr_audit?: { scoreBreakdown: string[]; brandSafe: boolean; niche?: string };
}

// --- SOCIAL MEDIA ICONS ---
const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
);
const TiktokIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"></path></svg>
);
const YoutubeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
);
const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
);
const TwitterIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c1 1 2.45 1.53 4 1.53a10.66 10.66 0 0 0 10-5.83v-.57a4.48 4.48 0 0 0 2-1.39z"></path></svg>
);

// Helper για μορφοποίηση αριθμών (15000 -> 15k)
const formatNum = (num?: number) => {
  if (num === undefined || num === null) return "";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
};

const t = {
  el: {
    back: "← Επιστροφή",
    contact: "Συνεργασία",
    contact_btn: "Ζήτησε Προσφορά",
    verified: "Επαληθευμένος",
    male: "Άνδρας",
    female: "Γυναίκα",
    lang: "Γλώσσες",
    foll: "Followers",
    about: "Σχετικά",
    portfolio: "Portfolio / Highlights",
    connect: "Σύνδεση",
    collabs: "Συνεργασίες",
    no_bio: "Δεν υπάρχει βιογραφικό.",
    no_vid: "Δεν έχουν ανέβει βίντεο.",
    tab_over: "Επισκοπηση",
    tab_aud: "Κοινο",
    tab_price: "Τιμές",
    tab_reviews: "Αξιολογήσεις",
    stat_eng: "Αλληλεπίδραση",
    stat_likes: "Μ.Ο. Likes",
    stat_rating: "Αξιολόγηση",
    stat_reviews: "Αξιολογήσεις",
    stat_response: "Χρόνος Απάντησης",
    stat_completion: "Ποσοστό Ολοκλήρωσης",
    aud_gen: "Φύλο Κοινού",
    aud_age: "Ηλικιακό Group",
    reviews_title: "Αξιολογήσεις",
    reviews_empty: "Δεν υπάρχουν αξιολογήσεις ακόμα.",
    reviews_add: "Προσθήκη Αξιολόγησης",
    reviews_rating: "Βαθμολογία",
    reviews_comment: "Σχόλια",
    reviews_project: "Τύπος Project",
    reviews_submit: "Υποβολή",
    review_error_no_collab: "Μπορείτε να αξιολογήσετε μόνο influencers με τους οποίους έχετε συνεργαστεί. Παρακαλώ ολοκληρώστε πρώτα μια συνεργασία.",
    review_error_already: "Έχετε ήδη αξιολογήσει αυτόν τον influencer. Μπορείτε να υποβάλετε μόνο μια αξιολόγηση ανά συνεργασία.",
    badges_verified: "Επαληθευμένος",
    badges_top: "Top Performer",
    badges_premium: "Premium Creator",
    badges_multi: "Multi-Platform",
    badges_expert: "Niche Expert",
    availability_available: "Διαθέσιμος",
    availability_busy: "Απασχολημένος",
    availability_away: "Ανενεργός",
    price_story: "Instagram Story (24h)",
    price_post: "Instagram Post",
    price_reel: "Reel / TikTok",
    price_facebook: "Facebook Post",
    price_youtube: "YouTube Video",
    price_note: "* Οι τιμές ενδέχεται να αλλάξουν ανάλογα το project.",
    min_rate: "Ελάχιστη Χρέωση",
    min_rate_desc: "Η ελάχιστη χρέωση για κάθε συνεργασία",
    modal_title: "Συνεργασία με",
    modal_sub: "Στείλε την πρότασή σου. Θα ειδοποιηθούν άμεσα.",
    modal_srv: "Επιλογή Υπηρεσίας",
    modal_brand: "Όνομα Επιχείρησης",
    modal_email: "Email Επιχείρησης",
    modal_bud: "Budget (€)",
    modal_desc: "Περιγραφή Project",
    modal_btn: "Αποστολή Πρότασης",
    modal_success: "Η πρόταση στάλθηκε!",
    modal_success_desc: "Η αίτησή σου καταχωρήθηκε. Θα λάβεις απάντηση στο email σου.",
    modal_close: "Κλείσιμο",
    modal_sending: "Αποστολή...",
    message_btn: "Μήνυμα",
    message_prompt_email: "Εισάγετε το email της επιχείρησής σας για να ξεκινήσετε τη συνομιλία:",
    message_prompt_name: "Εισάγετε το όνομα της επιχείρησής σας:",
    message_title: "Στείλτε Μήνυμα",
    message_desc: "Ξεκινήστε μια συνομιλία με αυτόν/αυτήν τον influencer",
    audit_title: "Στρατηγική Αξιολόγηση",
    audit_brand_safe: "Brand Safe",
    audit_niche: "Niche"
  },
  en: {
    back: "← Back",
    contact: "Contact for Work",
    contact_btn: "Request Custom Quote",
    verified: "Verified",
    male: "Male",
    female: "Female",
    lang: "Languages",
    foll: "Followers",
    about: "About",
    portfolio: "Portfolio / Highlights",
    connect: "Connect",
    collabs: "Collaborations",
    no_bio: "No bio available.",
    no_vid: "No videos uploaded.",
    tab_over: "Overview",
    tab_aud: "Audience",
    tab_price: "Pricing",
    tab_reviews: "Reviews",
    stat_eng: "Engagement",
    stat_likes: "Avg Likes",
    stat_rating: "Rating",
    stat_reviews: "Reviews",
    stat_response: "Response Time",
    stat_completion: "Completion Rate",
    aud_gen: "Audience Gender",
    aud_age: "Top Age Group",
    reviews_title: "Reviews",
    reviews_empty: "No reviews yet.",
    reviews_add: "Add Review",
    reviews_rating: "Rating",
    reviews_comment: "Comment",
    reviews_project: "Project Type",
    reviews_submit: "Submit",
    review_error_no_collab: "You can only review influencers you have worked with. Please complete a collaboration first.",
    review_error_already: "You have already reviewed this influencer. You can only submit one review per collaboration.",
    badges_verified: "Verified",
    badges_top: "Top Performer",
    badges_premium: "Premium Creator",
    badges_multi: "Multi-Platform",
    badges_expert: "Niche Expert",
    availability_available: "Available",
    availability_busy: "Busy",
    availability_away: "Away",
    price_story: "Instagram Story (24h)",
    price_post: "Instagram Post",
    price_reel: "Reel / TikTok",
    price_facebook: "Facebook Post",
    price_youtube: "YouTube Video",
    price_note: "* Prices may vary depending on project scope.",
    min_rate: "Minimum Rate",
    min_rate_desc: "The minimum charge for each collaboration",
    modal_title: "Work with",
    modal_sub: "Send a proposal. We'll notify them instantly.",
    modal_srv: "Select Service",
    modal_brand: "Company Name",
    modal_email: "Company Email",
    modal_bud: "Budget (€)",
    modal_desc: "Project Details",
    modal_btn: "Send Proposal",
    modal_success: "Proposal Sent!",
    modal_success_desc: "This request has been logged. You will receive an update via email.",
    modal_close: "Close Window",
    modal_sending: "Sending...",
    message_btn: "Message",
    message_prompt_email: "Enter your company email to start messaging:",
    message_prompt_name: "Enter your company name:",
    message_title: "Send Message",
    message_desc: "Start a conversation with this influencer",
    audit_title: "Strategic Audit",
    audit_brand_safe: "Brand Safe",
    audit_niche: "Niche"
  }
};

export default function InfluencerProfile(props: { params: Params }) {
  const params = use(props.params);
  const id = params.id;
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [lang, setLang] = useState<"el" | "en">("el"); // Default to Greek, will be updated in useEffect
  const txt = t[lang];

  const [activeTab, setActiveTab] = useState("overview");
  const [profile, setProfile] = useState<ProInfluencer | null>(null);
  const [loading, setLoading] = useState(true);

  // Load language from localStorage on client-side
  useEffect(() => {
    setLang(getStoredLanguage());
  }, []);
  
  // Counter proposal state
  const [counterProposalId, setCounterProposalId] = useState<string | null>(null);
  const [counterProposalAction, setCounterProposalAction] = useState<string | null>(null);
  const [counterProposal, setCounterProposal] = useState<any>(null);
  const [showCounterProposalModal, setShowCounterProposalModal] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

  // MODAL STATE
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showRegistrationRequiredModal, setShowRegistrationRequiredModal] = useState(false);
  const [proposalType, setProposalType] = useState("Instagram Story");
  const [brandName, setBrandName] = useState("");
  const [brandEmail, setBrandEmail] = useState("");
  const [budget, setBudget] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageBrandName, setMessageBrandName] = useState("");
  const [messageBrandEmail, setMessageBrandEmail] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewProjectType, setReviewProjectType] = useState("");
  const [reviewBrandName, setReviewBrandName] = useState("");
  const [reviewBrandEmail, setReviewBrandEmail] = useState("");
  const [isBrand, setIsBrand] = useState(false);

  // Check if current user is a brand
  useEffect(() => {
    const checkUserType = async () => {
      // First, check sessionStorage for immediate display (fast)
      if (typeof window !== 'undefined') {
        const sessionBrand = sessionStorage.getItem('isBrand');
        if (sessionBrand === 'true') {
          setIsBrand(true); // Show button immediately
        }
      }

      // Then verify with API (background check)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsBrand(false);
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('isBrand');
          }
          return;
        }

        // Check if user is a brand using API route to avoid hanging queries
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const response = await fetch('/api/user/profile', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          });
          if (response.ok) {
            const result = await response.json();
            const isBrandUser = result.profile?.type === 'brand';
            setIsBrand(isBrandUser); // Update state with actual value
            
            // Update sessionStorage to match actual user type
            if (typeof window !== 'undefined') {
              if (isBrandUser) {
                sessionStorage.setItem('isBrand', 'true');
              } else {
                sessionStorage.removeItem('isBrand');
              }
            }
          } else {
            setIsBrand(false);
            if (typeof window !== 'undefined') {
              sessionStorage.removeItem('isBrand');
            }
          }
        } else {
          setIsBrand(false);
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('isBrand');
          }
        }
      } catch (error) {
        console.error('Error checking user type:', error);
        // Don't hide button if sessionStorage says it's a brand (fail gracefully)
        // Only hide if sessionStorage doesn't say it's a brand
        if (typeof window === 'undefined' || sessionStorage.getItem('isBrand') !== 'true') {
          setIsBrand(false);
        }
      }
    };

    checkUserType();
  }, []);

  // Check online status - only show online if influencer is actually logged in and active
  useEffect(() => {
    if (!id) return;

    const checkOnlineStatus = async () => {
      try {
        // First check if this influencer is actually logged in
        // We can't directly check, but we can verify the presence record is recent and valid
        const { data } = await supabase
          .from('influencer_presence')
          .select('is_online, last_seen, updated_at')
          .eq('influencer_id', id)
          .single();

        if (data) {
          const lastSeen = new Date(data.last_seen);
          const updatedAt = new Date(data.updated_at);
          const now = new Date();
          const minutesSinceLastSeen = (now.getTime() - lastSeen.getTime()) / 60000;
          const minutesSinceUpdated = (now.getTime() - updatedAt.getTime()) / 60000;
          
          // Very strict: must be online AND last_seen within 1 minute (not 2)
          // AND updated_at must be recent (within 1 minute) to ensure it's actively being updated
          const secondsSinceLastSeen = (now.getTime() - lastSeen.getTime()) / 1000;
          const secondsSinceUpdated = (now.getTime() - updatedAt.getTime()) / 1000;
          const isOnline = data.is_online && 
                          secondsSinceLastSeen < 60 && 
                          secondsSinceUpdated < 60;
          
          setIsOnline(isOnline);
          
          // If presence is stale (more than 1 minute), mark as offline in database
          if (data.is_online && (secondsSinceLastSeen >= 60 || secondsSinceUpdated >= 60)) {
            // Silently update - don't wait for response
            (async () => {
              try {
                await supabase
                  .from('influencer_presence')
                  .update({
                    is_online: false,
                    last_seen: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('influencer_id', id);
                setIsOnline(false);
              } catch (err: any) {
                // Ignore errors
                console.error('Error updating stale presence:', err);
              }
            })();
          }
        } else {
          setIsOnline(false);
        }
      } catch (error) {
        console.error('Error checking online status:', error);
        setIsOnline(false);
      }
    };

    checkOnlineStatus();
    // Check every 10 seconds for more accurate status
    const interval = setInterval(checkOnlineStatus, 10000);
    return () => clearInterval(interval);
  }, [id]);

  // Load counter proposal data if query params exist
  useEffect(() => {
    const propId = searchParams?.get('counterProposal') || null;
    const action = searchParams?.get('action') || null;
    
    if (propId) {
      setCounterProposalId(propId);
      setCounterProposalAction(action);
      setShowCounterProposalModal(true);
      loadCounterProposal(propId);
    }
  }, [searchParams]);

      // Auto-open message modal after registration (if redirect param exists)
  useEffect(() => {
    const openMessage = searchParams?.get('openMessage');
    if (openMessage === 'true') {
      // Check if user is logged in and is a brand
      const checkAndOpenMessage = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user && user.email) {
            const { data: brandData } = await supabase
              .from('brands')
              .select('*')
              .eq('contact_email', user.email)
              .single();
            
            if (brandData) {
              // User is registered brand - open messaging
              setMessageBrandEmail(user.email);
              setMessageBrandName(brandData.brand_name || '');
              setShowMessageModal(true);
              
              // Clean up URL
              router.replace(`/influencer/${id}`);
            }
          }
        } catch (error) {
          console.error('Error checking brand status for auto-open:', error);
        }
      };
      
      checkAndOpenMessage();
    }
  }, [searchParams, id, router]);

  const loadCounterProposal = async (proposalId: string) => {
    try {
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', proposalId)
        .single();
      
      if (!error && data) {
        setCounterProposal(data);
        
        // Auto-execute action if specified
        const action = searchParams?.get('action');
        if (action === 'accept') {
          handleAcceptCounterProposal(proposalId);
        } else if (action === 'reject') {
          handleRejectCounterProposal(proposalId);
        } else if (action === 'message') {
          // Open message modal with brand email
          setMessageBrandEmail(data.brand_email);
          setMessageBrandName(data.brand_name);
          setShowMessageModal(true);
          setShowCounterProposalModal(false);
        }
      }
    } catch (error) {
      console.error('Error loading counter proposal:', error);
    }
  };

  const handleAcceptCounterProposal = async (proposalId: string) => {
    setProcessingAction(true);
    try {
      const response = await fetch('/api/proposals/counter/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId })
      });
      
      const result = await response.json();
      if (result.success) {
        alert('Η αντιπρόταση αποδεχτήθηκε! Η πρόταση ενημερώθηκε με την νέα τιμή.');
        setShowCounterProposalModal(false);
        // Remove query params
        router.push(`/influencer/${id}`);
      } else {
        alert('Σφάλμα: ' + (result.error || 'Αποτυχία αποδοχής αντιπρότασης'));
      }
    } catch (error: any) {
      console.error('Error accepting counter proposal:', error);
      alert('Σφάλμα: ' + error.message);
    } finally {
      setProcessingAction(false);
    }
  };

  const handleRejectCounterProposal = async (proposalId: string) => {
    setProcessingAction(true);
    try {
      const response = await fetch('/api/proposals/counter/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId })
      });
      
      const result = await response.json();
      if (result.success) {
        alert('Η αντιπρόταση απορρίφθηκε. Η αρχική πρόταση παραμένει ενεργή.');
        setShowCounterProposalModal(false);
        // Remove query params
        router.push(`/influencer/${id}`);
      } else {
        alert('Σφάλμα: ' + (result.error || 'Αποτυχία απόρριψης αντιπρότασης'));
      }
    } catch (error: any) {
      console.error('Error rejecting counter proposal:', error);
      alert('Σφάλμα: ' + error.message);
    } finally {
      setProcessingAction(false);
    }
  };

  // Function to fetch and parse profile data (extracted for reuse)
  const fetchProfile = async () => {
    if (!id) return;

    // Fetch influencer data - Works with both UUIDs (new influencers) and numeric IDs (if any)
    // Try to fetch by id (works for both UUIDs and numeric IDs)
    const { data, error } = await supabase.from("influencers").select("*").eq("id", id).single();
    
    // Calculate completion rate from proposals
    let calculatedCompletionRate: number | undefined;
    if (data && !error) {
      const { data: proposals } = await supabase
        .from("proposals")
        .select("status")
        .eq("influencer_id", id);
      
      if (proposals && proposals.length > 0) {
        const total = proposals.length;
        const completed = proposals.filter((p: any) => p.status === 'completed' || p.status === 'accepted').length;
        calculatedCompletionRate = Math.round((completed / total) * 100);
      }
    }
    
    if (data && !error) {
      const socialsObj: { [key: string]: string } = {};
      if (Array.isArray(data.accounts)) {
         data.accounts.forEach((acc: any) => { if(acc.platform) socialsObj[acc.platform.toLowerCase()] = acc.username; });
      }
      
      // Build followers object from accounts, engagement rates and avg likes per platform
      const followersObj: { [key: string]: number } = {};
      const engagementRatesObj: { [key: string]: string } = {};
      const avgLikesObj: { [key: string]: string } = {};
      if (Array.isArray(data.accounts)) {
        data.accounts.forEach((acc: any) => {
          if (acc.platform && acc.followers) {
            const platform = acc.platform.toLowerCase();
            // Parse followers string (e.g., "15k" -> 15000, "1.5M" -> 1500000, "14.600" -> 14600)
            // Support both "k" and "κ" (Greek kappa), and handle dots as thousands separator
            let followersNum = 0;
            // Remove spaces and commas, then convert to lowercase
            let followersStr = acc.followers.toString().toLowerCase().replace(/\s/g, '').replace(/,/g, '');
            
            // Check if it has 'm' or 'M' (millions)
            if (followersStr.includes('m')) {
              followersNum = parseFloat(followersStr) * 1000000;
            } 
            // Check if it has 'k' or 'κ' (thousands) - Greek kappa support
            else if (followersStr.includes('k') || followersStr.includes('κ')) {
              followersNum = parseFloat(followersStr) * 1000;
            } 
            // No suffix - could be plain number or number with dot as thousands separator
            else {
              // If it has a dot, check if it's thousands separator (e.g., "14.600" -> 14600)
              // or decimal (e.g., "14.6" -> 14.6)
              if (followersStr.includes('.')) {
                const parts = followersStr.split('.');
                // If the part after dot has 3 digits, it's likely thousands separator (e.g., "14.600")
                if (parts.length === 2 && parts[1].length === 3 && /^\d+$/.test(parts[1])) {
                  // Thousands separator: remove dot and parse as integer
                  followersNum = parseInt(parts[0] + parts[1], 10) || 0;
                } else {
                  // Decimal number: parse normally
                  followersNum = parseFloat(followersStr) || 0;
                }
              } else {
                // No dot, parse as integer
                followersNum = parseFloat(followersStr) || 0;
              }
            }
            followersObj[platform] = Math.round(followersNum);
            
            // Store engagement rate per platform if available
            if (acc.engagement_rate) {
              engagementRatesObj[platform] = acc.engagement_rate;
            }
            
            // Store avg likes per platform if available
            if (acc.avg_likes) {
              avgLikesObj[platform] = acc.avg_likes;
            }
          }
        });
      }
      
      setProfile({
        id: data.id,
        name: data.display_name,
        bio: data.bio || "",
        bio_en: data.bio_en || null,
        avatar: data.avatar_url || null,
        verified: data.analytics_verified || false, // Use analytics_verified for verified badge
        contact_email: data.contact_email,
        socials: socialsObj,
        followers: followersObj,
        categories: data.category 
          ? (data.category.includes(',') ? data.category.split(',').map((c: string) => c.trim()) : [data.category])
          : ["Creator"],
        platform: "Instagram",
        gender: data.gender,
        location: data.location,
        languages: data.languages 
          ? (typeof data.languages === 'string' 
            ? (data.languages.includes(',') ? data.languages.split(',').map((l: string) => l.trim()) : [data.languages.trim()])
            : (Array.isArray(data.languages) ? data.languages : []))
          : [],
        min_rate: data.min_rate,
        videos: Array.isArray(data.videos) ? data.videos : [],
        video_thumbnails: data.video_thumbnails || null,
        engagement_rate: Object.keys(engagementRatesObj).length > 0 ? engagementRatesObj : (data.engagement_rate || undefined), // Store as object per platform, fallback to legacy string
        avg_likes: Object.keys(avgLikesObj).length > 0 ? avgLikesObj : (data.avg_likes || undefined), // Store as object per platform, fallback to legacy string
        audience_data: {
          male: data.audience_male_percent || 50,
          female: data.audience_female_percent || 50,
          top_age: data.audience_top_age || "?"
        },
        rate_card: data.rate_card || { story: "Ρώτησε", post: "Ρώτησε", reel: "Ρώτησε", facebook: "Ρώτησε" },
        past_brands: data.past_brands || [],
        avg_rating: data.avg_rating || 0,
        total_reviews: data.total_reviews || 0,
        avg_response_time: data.avg_response_time || 24,
        completion_rate: data.completion_rate || 100,
        availability_status: data.availability_status || 'available',
        skills: data.skills || [],
        certifications: data.certifications || [],
        service_packages: data.service_packages || [],
        calculatedCompletionRate: calculatedCompletionRate,
        created_at: data.created_at,
        auditpr_audit: data.auditpr_audit ?? undefined,
      });
    }
    setLoading(false);
  };

  // Initial load
  useEffect(() => {
    setLoading(true);
    fetchProfile();
  }, [id]);

  // Track profile view after profile loads
  useEffect(() => {
    if (!id || !profile) return;

    const trackProfileView = async () => {
      try {
        // Get brand info if user is a brand
        let brandEmail = null;
        let brandName = null;
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              const response = await fetch('/api/user/profile', {
                headers: {
                  'Authorization': `Bearer ${session.access_token}`
                }
              });
              if (response.ok) {
                const result = await response.json();
                if (result.profile?.type === 'brand') {
                  brandEmail = user.email || null;
                  brandName = result.profile.brand_name || null;
                }
              }
            }
          }
        } catch (e) {
          // Ignore errors
        }

        // Track profile view
        await fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            influencerId: id,
            eventType: 'profile_view',
            brandEmail: brandEmail,
            brandName: brandName,
            metadata: { source: 'profile_page' }
          })
        }).catch(() => {}); // Fail silently
      } catch (err) {
        // Fail silently - analytics tracking should not break the page
      }
    };

    trackProfileView();
  }, [id, profile]);

  // Refresh when window gets focus (user might have edited in another tab)
  useEffect(() => {
    const handleFocus = () => {
      // Refresh data when user comes back to the tab (in case admin edited data)
      fetchProfile();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [id]);

  // Also refresh periodically (every 30 seconds) to catch updates from admin dashboard
  useEffect(() => {
    const interval = setInterval(() => {
      fetchProfile();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [id]);

  // Load reviews
  useEffect(() => {
    const loadReviews = async () => {
      if (!id) return;
      try {
        const response = await fetch(`/api/reviews?influencerId=${id}`);
        const data = await response.json();
        if (data.reviews) {
          setReviews(data.reviews);
        }
      } catch (error) {
        console.error('Error loading reviews:', error);
      }
    };
    loadReviews();
  }, [id]);

  // --- HANDLER: SEND PROPOSAL (UPDATED) ---
  const handleSendProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
        // 1. Save Proposal in DB
        // Note: influencer_id should match the type in your proposals table
        // If it's UUID (string), use id directly; if it's integer, we need to handle differently
        const proposalData: any = {
            influencer_id: id, // Use id as-is (works for both UUID and numeric)
            brand_name: brandName,
            brand_email: brandEmail,
            service_type: proposalType,
            budget: budget,
            message: message,
            status: 'pending'
        };
        
        const { data: proposalResult, error } = await supabase.from("proposals").insert([proposalData]).select().single();
        
        if (error) {
            console.error(error);
            alert(lang === 'el' ? "Κάτι πήγε στραβά. Παρακαλώ δοκιμάστε ξανά." : "Something went wrong. Please try again.");
            setSending(false);
            return;
        }
        
        // Send email to influencer about new proposal
        try {
            await fetch('/api/emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    type: 'proposal_influencer_notification',
                    email: profile?.contact_email || '',
                    influencerName: profile?.name || 'Influencer',
                    brandName: brandName,
                    brandEmail: brandEmail,
                    proposalType: proposalType,
                    budget: budget,
                    message: message
                })
            });
        } catch (emailError) {
            console.error("Influencer notification email failed:", emailError);
        }

        // 1.5. Auto-create conversation from proposal
        // NOTE: senderType should be 'brand' because the brand is sending the proposal
        if (proposalResult && proposalResult.id) {
            try {
                await fetch('/api/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        influencerId: id,
                        brandEmail: brandEmail,
                        brandName: brandName,
                        senderType: 'brand',
                        senderId: brandEmail,
                        content: `Νέα πρόταση: ${proposalType} | Budget: €${budget}\n\n${message}`,
                        proposalId: proposalResult.id
                    })
                });
            } catch (convError) {
                console.error("Auto-create conversation failed:", convError);
                // Don't fail the proposal if conversation creation fails
            }
        }

        // 2. Send Brand Confirmation Email
        try {
            await fetch('/api/emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    type: 'proposal_brand_confirmation', 
                    email: brandEmail,
                    brandName: brandName,
                    influencerName: profile?.name,
                    proposalType: proposalType
                })
            });
        } catch (mailError) {
             console.error("Brand Confirmation Email failed:", mailError);
        }

        // 3. Send Admin Notification Email
        try {
            await fetch('/api/emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    type: 'proposal_admin_notification', 
                    email: brandEmail,
                    brandName: brandName,
                    influencerName: profile?.name || 'Unknown',
                    influencerId: id,
                    proposalType: proposalType,
                    budget: budget,
                    message: message
                })
            });
        } catch (mailError) {
             console.error("Admin Notification Email failed:", mailError);
        }

        // 4. Track analytics: proposal_sent
        try {
            await fetch('/api/analytics/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    influencerId: id,
                    eventType: 'proposal_sent',
                    brandEmail: brandEmail,
                    brandName: brandName,
                    metadata: { proposal_id: proposalResult.id, service_type: proposalType, budget: budget }
                })
            }).catch(() => {}); // Fail silently
        } catch (err) {
            // Fail silently - analytics tracking should not break the flow
        }

        // 5. Update brand dashboard stats (proposalsSent) - only after successful submission
        try {
            if (typeof window !== 'undefined') {
                const saved = localStorage.getItem('brandDashboardStats');
                if (saved) {
                    try {
                        const stats = JSON.parse(saved);
                        const updated = {
                            ...stats,
                            proposalsSent: (stats.proposalsSent || 0) + 1
                        };
                        localStorage.setItem('brandDashboardStats', JSON.stringify(updated));
                    } catch (e) {
                        console.error('Error updating proposal stats:', e);
                    }
                }
            }
        } catch (statsError) {
            console.error("Failed to update proposal stats:", statsError);
        }

        setSent(true);
    } catch (err) {
        console.error("Error sending proposal:", err);
        alert("Something went wrong. Please try again.");
    } finally {
        setSending(false);
    }
  };

  // --- HANDLER: SUBMIT REVIEW ---
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewBrandEmail || !reviewRating) {
      alert(lang === 'el' ? 'Παρακαλώ συμπληρώστε email και βαθμολογία' : 'Please fill in email and rating');
      return;
    }

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          influencerId: id,
          brandEmail: reviewBrandEmail,
          brandName: reviewBrandName || reviewBrandEmail,
          rating: reviewRating,
          reviewText: reviewText,
          projectType: reviewProjectType,
          lang: lang
        })
      });

      const result = await response.json();
      if (result.success) {
        alert(lang === 'el' ? 'Η αξιολόγηση υποβλήθηκε!' : 'Review submitted!');
        setShowReviewModal(false);
        setReviewRating(5);
        setReviewText("");
        setReviewProjectType("");
        setReviewBrandName("");
        setReviewBrandEmail("");
        // Reload reviews
        const reloadResponse = await fetch(`/api/reviews?influencerId=${id}`);
        const reloadData = await reloadResponse.json();
        if (reloadData.reviews) setReviews(reloadData.reviews);
        // Reload profile to update stats
        window.location.reload();
      } else {
        // Use translated error message from API or fallback to translation keys
        const errorMsg = result.error || (lang === 'el' ? txt.review_error_no_collab : 'Error submitting review');
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      console.error('Error submitting review:', err);
      alert(lang === 'el' ? 'Σφάλμα: ' + err.message : 'Error: ' + err.message);
    }
  };

  // --- HANDLER: SEND MESSAGE ---
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageBrandEmail || !messageContent.trim()) {
      alert(lang === 'el' ? 'Παρακαλώ συμπληρώστε email και μήνυμα' : 'Please fill in email and message');
      return;
    }

    setMessageSending(true);
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          influencerId: id,
          brandEmail: messageBrandEmail,
          brandName: messageBrandName || messageBrandEmail,
          senderType: 'influencer',
          senderId: id,
          content: messageContent,
        })
      });

      const result = await response.json();
      if (result.success) {
        alert(lang === 'el' ? 'Το μήνυμα στάλθηκε! Θα μεταφερθείτε στη σελίδα συνομιλιών.' : 'Message sent! Redirecting to conversation...');
        window.location.href = `/messages?influencer=${id}&brandEmail=${encodeURIComponent(messageBrandEmail)}&brandName=${encodeURIComponent(messageBrandName || messageBrandEmail)}`;
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      alert(lang === 'el' ? 'Σφάλμα: ' + err.message : 'Error: ' + err.message);
    } finally {
      setMessageSending(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading Profile...</div>;
  if (!profile) return <div className="min-h-screen flex items-center justify-center text-slate-500">Influencer not found.</div>;

  return (
    <div className="bg-white min-h-screen pb-20 font-sans relative text-slate-900">
      
      {/* LANG TOGGLE */}
      <div className="fixed top-6 right-6 z-50">
          <button 
            onClick={() => {
              const newLang = lang === "el" ? "en" : "el";
              setLang(newLang);
              setStoredLanguage(newLang);
            }} 
            className="text-xs font-medium border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 text-slate-600 transition-colors bg-white shadow-sm"
            aria-label="Toggle language"
          >
            {lang === "el" ? "EN" : "EL"}
          </button>
      </div>

      {/* PROPOSAL MODAL */}
      {showProposalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative">
                <button 
                    onClick={() => { setShowProposalModal(false); setSent(false); }}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-xl z-10"
                >✕</button>

                {!sent ? (
                    <div className="p-8">
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">{txt.modal_title} {profile.name}</h3>
                        <p className="text-slate-500 text-sm mb-6">{txt.modal_sub}</p>
                        
                        <form onSubmit={handleSendProposal} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{txt.modal_srv}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['Story', 'Post', 'Reel'].map((type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setProposalType(type)}
                                            className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all ${proposalType === type ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200 hover:border-blue-300'}`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{txt.modal_brand}</label>
                                    <input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" placeholder="Brand" value={brandName} onChange={e => setBrandName(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{txt.modal_email}</label>
                                    <input required type="email" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" placeholder="Email" value={brandEmail} onChange={e => setBrandEmail(e.target.value)} />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{txt.modal_bud}</label>
                                <input required type="number" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" placeholder={profile?.min_rate ? profile.min_rate : "200"} value={budget} onChange={e => setBudget(e.target.value)} />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{txt.modal_desc}</label>
                                <textarea required rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" placeholder="..." value={message} onChange={e => setMessage(e.target.value)}></textarea>
                            </div>

                            <button type="submit" disabled={sending} className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3 rounded-xl transition-all shadow-lg disabled:opacity-50">
                                {sending ? txt.modal_sending : txt.modal_btn}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">🚀</div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">{txt.modal_success}</h3>
                        <p className="text-slate-500 mb-6">{txt.modal_success_desc}</p>
                        <button onClick={() => { setShowProposalModal(false); setSent(false); }} className="text-blue-600 font-bold hover:underline">
                            {txt.modal_close}
                        </button>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* REVIEW MODAL */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative">
            <button 
              onClick={() => { 
                setShowReviewModal(false); 
                setReviewRating(5);
                setReviewText("");
                setReviewProjectType("");
                setReviewBrandName("");
                setReviewBrandEmail("");
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-xl z-10"
            >✕</button>

            <div className="p-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">{txt.reviews_add}</h2>
              <p className="text-slate-500 mb-6">{lang === 'el' ? 'Αξιολόγησε αυτόν τον influencer' : 'Rate this influencer'}</p>
              
              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{txt.modal_brand}</label>
                  <input 
                    required 
                    type="text" 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900" 
                    placeholder={txt.modal_brand}
                    value={reviewBrandName}
                    onChange={e => setReviewBrandName(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{txt.modal_email}</label>
                  <input 
                    required 
                    type="email" 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900" 
                    placeholder={txt.modal_email}
                    value={reviewBrandEmail}
                    onChange={e => setReviewBrandEmail(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{txt.reviews_rating}</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className={`text-4xl transition-transform hover:scale-110 ${
                          star <= reviewRating ? 'text-amber-400' : 'text-slate-300'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{txt.reviews_project}</label>
                  <select 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                    value={reviewProjectType}
                    onChange={e => setReviewProjectType(e.target.value)}
                  >
                    <option value="">{lang === 'el' ? 'Επιλέξτε...' : 'Select...'}</option>
                    <option value="Instagram Story">Instagram Story</option>
                    <option value="Instagram Post">Instagram Post</option>
                    <option value="Reel / TikTok">Reel / TikTok</option>
                    <option value="Campaign">{lang === 'el' ? 'Καμπάνια' : 'Campaign'}</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{txt.reviews_comment}</label>
                  <textarea 
                    rows={4} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 resize-none" 
                    placeholder={lang === 'el' ? 'Γράψτε την άποψή σας...' : 'Write your review...'}
                    value={reviewText}
                    onChange={e => setReviewText(e.target.value)}
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg"
                >
                  {txt.reviews_submit}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MESSAGE MODAL */}
      {/* Registration Required Modal - Modern & Professional */}
      {showRegistrationRequiredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative transform transition-all">
            {/* Close Button */}
            <button 
              onClick={() => setShowRegistrationRequiredModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-xl z-10 transition-colors"
            >
              ✕
            </button>

            {/* Content */}
            <div className="p-8">
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-4xl">🔒</span>
                </div>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-slate-900 text-center mb-3">
                {lang === 'el' ? 'Εγγραφή Απαιτείται' : 'Registration Required'}
              </h2>

              {/* Description */}
              <p className="text-slate-600 text-center mb-6 leading-relaxed">
                {lang === 'el' 
                  ? 'Για να στείλετε μήνυμα σε αυτόν τον influencer, χρειάζεται να έχετε εγγραφεί ως επιχείρηση. Η εγγραφή είναι δωρεάν και γρήγορη!'
                  : 'To send a message to this influencer, you need to register as a business. Registration is free and quick!'}
              </p>

              {/* Benefits List */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-5 mb-6 border border-blue-100">
                <p className="text-sm font-semibold text-slate-900 mb-3">
                  {lang === 'el' ? 'Με την εγγραφή θα έχετε:' : 'By registering you will have:'}
                </p>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{lang === 'el' ? 'Άμεση επικοινωνία με influencers' : 'Direct messaging with influencers'}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{lang === 'el' ? 'Dashboard για διαχείριση προτάσεων' : 'Dashboard to manage proposals'}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{lang === 'el' ? 'Έξυπνη υπηρεσία προτάσεων AI (ΔΩΡΕΑΝ)' : 'AI-powered influencer suggestions (FREE)'}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{lang === 'el' ? 'Αναλυτικά στατιστικά και reports' : 'Detailed analytics and reports'}</span>
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={async () => {
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      const email = user?.email || '';
                      const redirectUrl = `/influencer/${id}?openMessage=true`;
                      router.push(`/brand/signup?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(redirectUrl)}`);
                    } catch (error) {
                      console.error('Error getting user email:', error);
                      const redirectUrl = `/influencer/${id}?openMessage=true`;
                      router.push(`/brand/signup?redirect=${encodeURIComponent(redirectUrl)}`);
                    }
                  }}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
                >
                  <span className="text-lg">✨</span>
                  <span>{lang === 'el' ? 'Εγγραφή Επιχείρησης' : 'Register Business'}</span>
                </button>
                
                <button
                  onClick={() => setShowRegistrationRequiredModal(false)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 px-6 rounded-xl transition-colors"
                >
                  {lang === 'el' ? 'Ακύρωση' : 'Cancel'}
                </button>
              </div>

              {/* Footer Note */}
              <p className="text-xs text-slate-500 text-center mt-4">
                {lang === 'el' 
                  ? 'Η εγγραφή είναι 100% δωρεάν και διαρκεί λιγότερο από 2 λεπτά'
                  : 'Registration is 100% free and takes less than 2 minutes'}
              </p>
            </div>
          </div>
        </div>
      )}

      {showMessageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative">
                <button 
                    onClick={() => { 
                      setShowMessageModal(false); 
                      setMessageBrandEmail("");
                      setMessageBrandName("");
                      setMessageContent("");
                    }}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-xl z-10"
                >✕</button>

                <div className="p-8">
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">{txt.message_title}</h2>
                    <p className="text-slate-500 mb-6">{txt.message_desc}</p>
                    
                    <form onSubmit={handleSendMessage} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                {txt.modal_brand}
                            </label>
                            <input 
                                required 
                                type="text" 
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900" 
                                placeholder={txt.modal_brand}
                                value={messageBrandName}
                                onChange={e => setMessageBrandName(e.target.value)}
                            />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                {txt.modal_email}
                            </label>
                            <input 
                                required 
                                type="email" 
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900" 
                                placeholder={txt.modal_email}
                                value={messageBrandEmail}
                                onChange={e => setMessageBrandEmail(e.target.value)}
                            />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                {txt.modal_desc}
                            </label>
                            <textarea 
                                required 
                                rows={4} 
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 resize-none" 
                                placeholder="..."
                                value={messageContent}
                                onChange={e => setMessageContent(e.target.value)}
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={messageSending} 
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg disabled:opacity-50"
                        >
                            {messageSending ? txt.modal_sending : txt.message_btn}
                        </button>
                    </form>
                </div>
            </div>
        </div>
      )}

      {/* PROFESSIONAL HERO HEADER */}
      <div className="relative w-full h-64 md:h-80 bg-slate-900 overflow-hidden">
        {/* Real collaboration image - happy young people, influencers, business collaboration */}
        <Image 
          src="https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=2000&q=80" 
          alt="Influencer & Brand Collaboration" 
          fill 
          className="object-cover opacity-75" 
          priority
        />
        
        {/* Subtle overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/50 to-slate-900/30"></div>
        
        {/* Network circles visualization overlay - showing connections like in chemistry */}
        <div className="absolute inset-0 z-10 opacity-30">
          <svg width="100%" height="100%" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-0">
            <defs>
              <linearGradient id="circleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.3" />
              </linearGradient>
            </defs>
            
            {/* Network nodes - circles */}
            <circle cx="150" cy="100" r="8" fill="url(#circleGradient)" stroke="white" strokeWidth="1.5" />
            <circle cx="350" cy="120" r="6" fill="url(#circleGradient)" stroke="white" strokeWidth="1.5" />
            <circle cx="600" cy="80" r="10" fill="url(#circleGradient)" stroke="white" strokeWidth="2" />
            <circle cx="850" cy="100" r="6" fill="url(#circleGradient)" stroke="white" strokeWidth="1.5" />
            <circle cx="1050" cy="120" r="8" fill="url(#circleGradient)" stroke="white" strokeWidth="1.5" />
            <circle cx="250" cy="250" r="6" fill="url(#circleGradient)" stroke="white" strokeWidth="1.5" />
            <circle cx="750" cy="280" r="7" fill="url(#circleGradient)" stroke="white" strokeWidth="1.5" />
            <circle cx="450" cy="300" r="6" fill="url(#circleGradient)" stroke="white" strokeWidth="1.5" />
            <circle cx="950" cy="300" r="6" fill="url(#circleGradient)" stroke="white" strokeWidth="1.5" />
            
            {/* Connection lines between circles */}
            <line x1="150" y1="100" x2="350" y2="120" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="350" y1="120" x2="600" y2="80" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="600" y1="80" x2="850" y2="100" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="850" y1="100" x2="1050" y2="120" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="150" y1="100" x2="250" y2="250" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="600" y1="80" x2="450" y2="300" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="850" y1="100" x2="750" y2="280" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="1050" y1="120" x2="950" y2="300" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="250" y1="250" x2="450" y2="300" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="450" y1="300" x2="750" y2="280" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="750" y1="280" x2="950" y2="300" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="350" y1="120" x2="450" y2="300" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
            <line x1="600" y1="80" x2="750" y2="280" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
          </svg>
        </div>
        
        {/* Back button */}
        <div className="absolute top-6 left-6 z-20">
          <a href="/" className="text-white bg-white/20 backdrop-blur-md px-4 py-2 rounded-lg font-medium hover:bg-white/30 transition shadow-lg">
            {txt.back}
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 relative -mt-24 z-10">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Top Section: Avatar, Name, Info */}
          <div className="p-6 md:p-8 flex flex-col md:flex-row items-center md:items-end gap-6 border-b border-slate-100">
            <div className="relative w-40 h-40 rounded-full border-4 border-white shadow-lg overflow-hidden bg-slate-100 -mt-6 md:mb-0 flex-shrink-0">
                <Avatar src={profile.avatar} alt={profile.name} size={160} className="w-full h-full" />
            </div>
            <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold text-slate-900 flex items-center justify-center md:justify-start gap-2">
                    {profile.name}
                </h1>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-1">
                    <p className="text-slate-500">{profile.location} • {profile.gender === "Male" ? txt.male : txt.female}</p>
                    {isOnline && (
                        <span className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 px-3 py-1 rounded-full text-xs font-semibold animate-pulse">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            {lang === 'el' ? 'Online Τώρα !' : 'Online Now !'}
                        </span>
                    )}
                </div>
                {/* Categories */}
                {profile.categories && profile.categories.length > 0 && (
                  <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3">
                    {profile.categories.map((cat, i) => {
                      const translatedCat = categoryTranslations[cat]?.[lang] || cat;
                      return (
                        <span key={i} className="text-xs uppercase font-semibold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-200">
                          {translatedCat}
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3">
                    {profile.languages && Array.isArray(profile.languages) && profile.languages.map((l, i) => (
                      <span key={i} className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">
                        {typeof l === 'string' ? l.trim() : l}
                      </span>
                    ))}
                    {profile.skills && profile.skills.length > 0 && profile.skills.map((skill, i) => (
                      <span key={`skill-${i}`} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium">{skill}</span>
                    ))}
                </div>
                {profile.certifications && profile.certifications.length > 0 && (
                  <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
                    {profile.certifications.map((cert, i) => (
                      <span key={`cert-${i}`} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-medium">
                        🎓 {cert}
                      </span>
                    ))}
                  </div>
                )}
            </div>
            <div className="relative flex flex-col items-end gap-3">
              {/* Badges - Top Right above buttons */}
              {(() => {
                // Calculate account age in days
                let accountAgeDays = 999;
                if (profile.created_at) {
                  try {
                    const createdDate = new Date(profile.created_at);
                    // Check if date is valid
                    if (!isNaN(createdDate.getTime())) {
                      const now = new Date();
                      const diffTime = now.getTime() - createdDate.getTime();
                      accountAgeDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                      // Ensure non-negative
                      if (accountAgeDays < 0) accountAgeDays = 0;
                    }
                  } catch (e) {
                    console.error('Error calculating account age:', e);
                  }
                }
                const badges = getBadges({
                  verified: profile.verified,
                  followers: profile.followers,
                  engagement_rate: profile.engagement_rate,
                  total_reviews: profile.total_reviews || 0,
                  avg_rating: profile.avg_rating || 0,
                  past_brands: profile.past_brands || [],
                  account_created_days: accountAgeDays,
                  min_rate: profile.min_rate,
                }, lang);
                
                // Debug: log badge calculation (always log for debugging)
                console.log('Badge calculation:', {
                  verified: profile.verified,
                  accountAgeDays,
                  created_at: profile.created_at,
                  badgesCount: badges.length,
                  badges: badges.map(b => b.type),
                  profileData: {
                    created_at: profile.created_at,
                    verified: profile.verified,
                    followers: profile.followers,
                    engagement_rate: profile.engagement_rate
                  }
                });
                
                return badges.length > 0 ? (
                  <div className="flex flex-wrap gap-2 justify-end mb-2">
                    {badges.map((badge, idx) => (
                      <span
                        key={idx}
                        className={getBadgeStyles(badge) + " text-xs px-3 py-1.5"}
                        title={badge.label}
                      >
                        <span>{badge.icon}</span>
                        <span>{badge.label}</span>
                      </span>
                    ))}
                  </div>
                ) : null;
              })()}
              {/* Action Buttons */}
              <div className="flex gap-3 flex-col md:flex-row">
                {/* Back to Proposals button for brands only */}
                {isBrand && (
                  <a 
                    href="/brand/dashboard"
                    className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-transform hover:-translate-y-1 flex items-center justify-center gap-2 text-sm"
                  >
                    <span>←</span> {lang === 'el' ? 'Πίσω στις Προτάσεις' : 'Back to Proposals'}
                  </a>
                )}
                <button onClick={() => setShowProposalModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-transform hover:-translate-y-1 flex items-center gap-2">
                    <span>⚡</span> {txt.contact}
                </button>
                <button 
                    onClick={async () => {
                      try {
                        // Check if user is logged in and is a brand
                        const { data: { user } } = await supabase.auth.getUser();
                        
                        if (!user || !user.email) {
                          // Not logged in or no email - show registration required modal
                          setShowRegistrationRequiredModal(true);
                          return;
                        }
                        
                        // Check if user is a registered brand
                        const { data: brandData } = await supabase
                          .from('brands')
                          .select('*')
                          .eq('contact_email', user.email)
                          .single();
                        
                        if (!brandData) {
                          // Not a registered brand - show registration required modal
                          setShowRegistrationRequiredModal(true);
                          return;
                        }
                        
                        // User is a registered brand - redirect to messages page with brand data
                        const brandEmail = user.email;
                        const brandName = brandData.brand_name || '';
                        router.push(`/messages?influencer=${id}&brandEmail=${encodeURIComponent(brandEmail)}&brandName=${encodeURIComponent(brandName)}`);
                      } catch (error) {
                        console.error('Error checking brand status:', error);
                        // On error, show registration modal
                        setShowRegistrationRequiredModal(true);
                      }
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-transform hover:-translate-y-1 flex items-center gap-2"
                >
                    <span>💬</span> {txt.message_btn}
                </button>
              </div>
            </div>
          </div>
          
          {/* Statistics Section */}
          <div className="px-6 md:px-8 py-6 bg-gradient-to-br from-slate-50 to-blue-50/30">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Engagement Rate */}
              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-slate-200/50 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📈</span>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === 'el' ? 'Αλληλεπίδραση' : 'Engagement'}</span>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {(() => {
                    const followers = profile.followers || {};
                    const engagementRates = (typeof profile.engagement_rate === 'object' && profile.engagement_rate !== null && !Array.isArray(profile.engagement_rate)) 
                      ? profile.engagement_rate as { [key: string]: string }
                      : {};
                    const platforms = [
                      { key: 'instagram', icon: InstagramIcon, color: 'text-pink-600' },
                      { key: 'tiktok', icon: TiktokIcon, color: 'text-black' },
                      { key: 'youtube', icon: YoutubeIcon, color: 'text-red-600' },
                      { key: 'facebook', icon: FacebookIcon, color: 'text-blue-700' },
                      { key: 'twitter', icon: TwitterIcon, color: 'text-slate-800' },
                    ];
                    
                    const availablePlatforms = platforms.filter(platform => followers[platform.key as keyof typeof followers]);
                    
                    if (availablePlatforms.length === 0) {
                      return <span className="text-sm text-slate-400">-</span>;
                    }
                    
                    return availablePlatforms.map((platform) => {
                      const Icon = platform.icon;
                      let engagementRate = engagementRates[platform.key] || '-';
                      // Add % if not already present
                      if (engagementRate !== '-' && !engagementRate.includes('%')) {
                        engagementRate = engagementRate + '%';
                      }
                      return (
                        <div key={platform.key} className="flex items-center gap-1.5">
                          <span className={platform.color}>
                            <Icon />
                          </span>
                          <span className="text-sm font-bold text-blue-600">{engagementRate}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
              
              {/* Followers */}
              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-slate-200/50 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">👥</span>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === 'el' ? 'Ακόλουθοι' : 'Followers'}</span>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {(() => {
                    const followers = profile.followers || {};
                    const platforms = [
                      { key: 'instagram', icon: InstagramIcon, color: 'text-pink-600' },
                      { key: 'tiktok', icon: TiktokIcon, color: 'text-black' },
                      { key: 'youtube', icon: YoutubeIcon, color: 'text-red-600' },
                      { key: 'facebook', icon: FacebookIcon, color: 'text-blue-700' },
                      { key: 'twitter', icon: TwitterIcon, color: 'text-slate-800' },
                    ];
                    
                    const availablePlatforms = platforms.filter(platform => followers[platform.key as keyof typeof followers]);
                    
                    if (availablePlatforms.length === 0) {
                      return <span className="text-sm text-slate-400">-</span>;
                    }
                    
                    return availablePlatforms.map((platform) => {
                      const Icon = platform.icon;
                      const count = followers[platform.key as keyof typeof followers] || 0;
                      return (
                        <div key={platform.key} className="flex items-center gap-1.5">
                          <span className={platform.color}>
                            <Icon />
                          </span>
                          <span className="text-sm font-bold text-slate-900">{formatNum(count)}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
              
              {/* Avg Likes */}
              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-slate-200/50 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">❤️</span>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === 'el' ? 'Μ.Ο. Likes' : 'Avg Likes'}</span>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {(() => {
                    const followers = profile.followers || {};
                    const avgLikes = (typeof profile.avg_likes === 'object' && profile.avg_likes !== null && !Array.isArray(profile.avg_likes)) 
                      ? profile.avg_likes as { [key: string]: string }
                      : {};
                    const platforms = [
                      { key: 'instagram', icon: InstagramIcon, color: 'text-pink-600' },
                      { key: 'tiktok', icon: TiktokIcon, color: 'text-black' },
                      { key: 'youtube', icon: YoutubeIcon, color: 'text-red-600' },
                      { key: 'facebook', icon: FacebookIcon, color: 'text-blue-700' },
                      { key: 'twitter', icon: TwitterIcon, color: 'text-slate-800' },
                    ];
                    
                    const availablePlatforms = platforms.filter(platform => followers[platform.key as keyof typeof followers]);
                    
                    if (availablePlatforms.length === 0) {
                      return <span className="text-sm text-slate-400">-</span>;
                    }
                    
                    return availablePlatforms.map((platform) => {
                      const Icon = platform.icon;
                      const avgLikesValue = avgLikes[platform.key] || '-';
                      return (
                        <div key={platform.key} className="flex items-center gap-1.5">
                          <span className={platform.color}>
                            <Icon />
                          </span>
                          <span className="text-sm font-bold text-slate-900">{avgLikesValue}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
              
              {/* Collaborations */}
              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-slate-200/50 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🤝</span>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{txt.collabs}</span>
                </div>
                <p className="text-2xl font-extrabold text-purple-600">{profile.past_brands?.length || 0}</p>
              </div>
            </div>
            
            {/* Additional Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {/* Rating - Only show if there are reviews */}
              {profile.total_reviews && profile.total_reviews > 0 && profile.avg_rating && profile.avg_rating > 0 ? (
                <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-slate-200/50 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">⭐</span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{txt.stat_rating}</span>
                  </div>
                  <p className="text-2xl font-extrabold text-amber-600">{profile.avg_rating.toFixed(1)}</p>
                  <p className="text-xs text-slate-500">{profile.total_reviews} {txt.stat_reviews}</p>
                </div>
              ) : (
                <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-slate-200/50 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">⭐</span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{txt.stat_rating}</span>
                  </div>
                  <p className="text-2xl font-extrabold text-slate-400">{lang === 'el' ? '-' : '-'}</p>
                  <p className="text-xs text-slate-400">{lang === 'el' ? 'Δεν υπάρχουν αξιολογήσεις' : 'No reviews yet'}</p>
                </div>
              )}
              
              {/* Response Time */}
              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-slate-200/50 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">⚡</span>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{txt.stat_response}</span>
                </div>
                <p className="text-2xl font-extrabold text-green-600">{profile.avg_response_time || 24}h</p>
              </div>
              
              {/* Completion Rate - Calculate from proposals */}
              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-slate-200/50 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">✅</span>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{txt.stat_completion}</span>
                </div>
                <p className="text-2xl font-extrabold text-emerald-600">
                  {profile.calculatedCompletionRate !== undefined ? `${profile.calculatedCompletionRate}%` : '-'}
                </p>
              </div>
              
              {/* Availability */}
              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-slate-200/50 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📅</span>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === 'el' ? 'Κατάσταση' : 'Status'}</span>
                </div>
                <p className={`text-lg font-bold ${profile.availability_status === 'available' ? 'text-green-600' : profile.availability_status === 'busy' ? 'text-amber-600' : 'text-slate-400'}`}>
                  {profile.availability_status === 'available' ? txt.availability_available : 
                   profile.availability_status === 'busy' ? txt.availability_busy : txt.availability_away}
                </p>
              </div>
              
              {/* Minimum Rate */}
              {profile.min_rate && (
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 rounded-xl border-2 border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">💰</span>
                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">{txt.min_rate}</span>
                  </div>
                  <p className="text-2xl font-extrabold text-blue-700">{profile.min_rate}€</p>
                  <p className="text-xs text-blue-600 mt-1">{txt.min_rate_desc}</p>
                </div>
              )}
            </div>
            
          </div>
        </div>

        {/* TABS */}
        <div className="mt-8 border-b border-slate-200">
            <nav className="flex gap-8 overflow-x-auto">
                <button onClick={() => setActiveTab("overview")} className={`pb-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === "overview" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-700 hover:text-slate-900"}`}>{txt.tab_over}</button>
                <button onClick={() => setActiveTab("audience")} className={`pb-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === "audience" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-700 hover:text-slate-900"}`}>{txt.tab_aud}</button>
                <button onClick={() => setActiveTab("pricing")} className={`pb-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === "pricing" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-700 hover:text-slate-900"}`}>{txt.tab_price}</button>
                <button onClick={() => setActiveTab("reviews")} className={`pb-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === "reviews" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-700 hover:text-slate-900"}`}>{txt.tab_reviews} {profile.total_reviews ? `(${profile.total_reviews})` : ''}</button>
            </nav>
        </div>

        {/* CONTENT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
            <div className="lg:col-span-2 space-y-8">
                {activeTab === "overview" && (
                    <>
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                            <h2 className="text-xl font-bold text-slate-900 mb-4">{txt.about}</h2>
                            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                                {lang === 'en' && profile.bio_en ? profile.bio_en : (profile.bio || txt.no_bio)}
                            </p>
                        </div>
                        {profile.auditpr_audit && Array.isArray(profile.auditpr_audit.scoreBreakdown) && profile.auditpr_audit.scoreBreakdown.length > 0 && (
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                                <div className="flex flex-wrap items-center gap-3 mb-4">
                                    <h2 className="text-xl font-bold text-slate-900">{txt.audit_title}</h2>
                                    {profile.auditpr_audit.brandSafe && (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
                                            {txt.audit_brand_safe}
                                        </span>
                                    )}
                                    {profile.auditpr_audit.niche && (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                            {profile.auditpr_audit.niche}
                                        </span>
                                    )}
                                </div>
                                <ul className="space-y-2 text-slate-600 text-sm leading-relaxed list-none">
                                    {profile.auditpr_audit.scoreBreakdown.map((item, idx) => (
                                        <li key={idx} className="flex gap-2">
                                            <span className="text-indigo-500 mt-0.5 shrink-0">•</span>
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                         <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-4">{txt.portfolio}</h3>
                            {profile.videos && profile.videos.length > 0 && profile.videos[0] !== "" ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {profile.videos.map((vid, i) => {
                                        const isVideo = isDefinitelyVideo(vid);
                                        const isImage = isDefinitelyImage(vid);
                                        // For Instagram posts (p/), we can't be sure if it's video or photo, so don't show play button
                                        const isInstagramPost = /instagram\.com\/p\//i.test(vid);
                                        
                                        // Component to load image and adapt container to natural dimensions
                                        const AdaptiveImage = ({ imageUrl, alt }: { imageUrl: string; alt: string }) => {
                                            const [imgSrc, setImgSrc] = useState<string | null>(null);
                                            const [error, setError] = useState(false);
                                            
                                            useEffect(() => {
                                                // For direct image URLs, use them directly
                                                if (isDefinitelyImage(imageUrl)) {
                                                    setImgSrc(imageUrl);
                                                    return;
                                                }
                                                
                                                // For Instagram/TikTok URLs, fetch thumbnail
                                                const fetchThumbnail = async () => {
                                                    try {
                                                        const thumbnail = getVideoThumbnail(imageUrl);
                                                        if (thumbnail && !thumbnail.startsWith('/api/')) {
                                                            setImgSrc(thumbnail);
                                                        } else {
                                                            const apiUrl = `/api/video-thumbnail?url=${encodeURIComponent(imageUrl)}`;
                                                            const response = await fetch(apiUrl);
                                                            const data = await response.json();
                                                            if (data.thumbnail) {
                                                                setImgSrc(data.thumbnail);
                                                            } else {
                                                                setError(true);
                                                            }
                                                        }
                                                    } catch (err) {
                                                        console.error('Error fetching thumbnail:', err);
                                                        setError(true);
                                                    }
                                                };
                                                
                                                fetchThumbnail();
                                            }, [imageUrl]);
                                            
                                            if (error || !imgSrc) {
                                                // Fallback to VideoThumbnail component
                                                return (
                                                    <div className="relative w-full flex items-center justify-center p-4 min-h-[200px]">
                                                        <VideoThumbnail 
                                                            url={imageUrl}
                                                            alt={alt}
                                                            fill={false}
                                                            width={800}
                                                            height={600}
                                                            className="!relative !w-auto !h-auto max-w-full max-h-[500px] object-contain"
                                                        />
                                                    </div>
                                                );
                                            }
                                            
                                            return (
                                                <div className="w-full flex items-center justify-center p-4">
                                                    <img 
                                                        src={imgSrc}
                                                        alt={alt}
                                                        className="max-w-full max-h-[600px] w-auto h-auto object-contain rounded"
                                                        loading="lazy"
                                                        style={{ display: 'block' }}
                                                    />
                                                </div>
                                            );
                                        };
                                        
                                        const provider = detectProvider(vid);
                                        const embedUrl = provider ? getIframelyEmbedUrl(vid) : null;
                                        
                                        // Use SocialEmbedCard for social media videos
                                        if (provider && embedUrl && !isImage) {
                                            return (
                                                <div key={i} className="w-full">
                                                    <SocialEmbedCard
                                                        provider={provider}
                                                        embedUrl={embedUrl}
                                                        originalUrl={vid}
                                                    />
                                                </div>
                                            );
                                        }
                                        
                                        // Use VideoThumbnail for images or non-social media URLs
                                        return (
                                            <a 
                                                key={i} 
                                                href={vid} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className={`group relative rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow bg-slate-100 ${
                                                    isImage 
                                                        ? 'flex flex-col items-center justify-center w-full' 
                                                        : 'w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.67rem)] aspect-square'
                                                }`}
                                            >
                                                {isImage ? (
                                                    <AdaptiveImage imageUrl={vid} alt={`Portfolio item ${i+1}`} />
                                                ) : (
                                                    <VideoThumbnail 
                                                        url={vid}
                                                        alt={`Portfolio item ${i+1}`}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                )}
                                                {isVideo && !isInstagramPost && (
                                                    <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors pointer-events-none z-10">
                                                        <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                                            <span className="text-sm text-slate-900 ml-0.5">▶</span>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="absolute bottom-0 left-0 right-0 w-full p-3 bg-gradient-to-t from-black/80 to-transparent text-white text-sm font-medium pointer-events-none z-10">
                                                    {isVideo ? `Video ${i+1}` : isImage ? `Photo ${i+1}` : isInstagramPost ? `Instagram Post ${i+1}` : `Highlight ${i+1}`}
                                                </div>
                                            </a>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400">{txt.no_vid}</div>
                            )}
                        </div>
                    </>
                )}
                {activeTab === "audience" && (
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                        <h2 className="text-xl font-bold text-slate-900 mb-6">{txt.aud_gen}</h2>
                        
                        {/* Gender Chart using CSS */}
                        <div className="mb-8">
                            <div className="flex justify-between mb-2 font-medium text-slate-700">
                                <span>{txt.female} ({profile.audience_data?.female}%)</span>
                                <span>{txt.male} ({profile.audience_data?.male}%)</span>
                            </div>
                            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex">
                                <div style={{ width: `${profile.audience_data?.female}%` }} className="bg-pink-400 h-full"></div>
                                <div style={{ width: `${profile.audience_data?.male}%` }} className="bg-blue-400 h-full"></div>
                            </div>
                        </div>

                        {/* Age Group */}
                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="bg-white p-3 rounded-full shadow-sm text-2xl">🎯</div>
                            <div>
                                <p className="text-slate-500 text-sm">{txt.aud_age}</p>
                                <p className="text-xl font-bold text-slate-900">{profile.audience_data?.top_age}</p>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === "pricing" && (
                     <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                        <h2 className="text-xl font-bold text-slate-900 mb-6">{txt.tab_price}</h2>
                        
                        {/* Minimum Rate - Prominent Display */}
                        {profile.min_rate && (
                          <div className="mb-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 shadow-md">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-2xl">💰</span>
                              <h3 className="text-lg font-bold text-slate-900">{txt.min_rate}</h3>
                            </div>
                            <p className="text-4xl font-extrabold text-blue-700 mb-2">{profile.min_rate}€</p>
                            <p className="text-sm text-slate-600">{txt.min_rate_desc}</p>
                          </div>
                        )}
                        
                        {/* Service Packages */}
                        {profile.service_packages && profile.service_packages.length > 0 && (
                          <div className="mb-8">
                            <h3 className="text-lg font-semibold text-slate-900 mb-4">{lang === 'el' ? 'Προσφορές Πακέτων' : 'Service Packages'}</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                              {profile.service_packages.map((pkg: any, i: number) => (
                                <div key={i} className="border-2 border-blue-200 rounded-xl p-6 bg-gradient-to-br from-blue-50 to-white">
                                  <h4 className="font-bold text-slate-900 text-lg mb-2">{pkg.name}</h4>
                                  <p className="text-slate-600 text-sm mb-4">{pkg.description}</p>
                                  <p className="text-2xl font-extrabold text-blue-600 mb-4">{pkg.price}</p>
                                  {pkg.includes && Array.isArray(pkg.includes) && (
                                    <ul className="space-y-2 mb-4">
                                      {pkg.includes.map((item: string, j: number) => (
                                        <li key={j} className="flex items-center gap-2 text-sm text-slate-700">
                                          <span className="text-green-600">✓</span> {item}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                  <button onClick={() => setShowProposalModal(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition-colors">
                                    {lang === 'el' ? 'Επιλογή Πακέτου' : 'Select Package'}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Pricing Table - Dynamic based on platforms */}
                        <div className="space-y-4">
                            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                <div className="divide-y divide-slate-100">
                                    {(() => {
                                        const platforms = profile.socials ? Object.keys(profile.socials).map(p => p.toLowerCase()) : [];
                                        type RateCardKey = 'story' | 'post' | 'reel' | 'facebook' | 'youtube';
                                        const serviceMap = new Map<string, { key: RateCardKey; label: string }>();
                                        
                                        // Instagram services
                                        if (platforms.includes('instagram')) {
                                            serviceMap.set('story', { key: 'story', label: txt.price_story });
                                            serviceMap.set('post-instagram', { key: 'post', label: txt.price_post });
                                            serviceMap.set('reel', { key: 'reel', label: txt.price_reel });
                                        }
                                        
                                        // TikTok services (uses reel key)
                                        if (platforms.includes('tiktok')) {
                                            serviceMap.set('reel', { key: 'reel', label: lang === 'el' ? 'TikTok Video' : 'TikTok Video' });
                                        }
                                        
                                        // YouTube services (uses reel key)
                                        if (platforms.includes('youtube')) {
                                            serviceMap.set('reel', { key: 'reel', label: lang === 'el' ? 'YouTube Video' : 'YouTube Video' });
                                        }
                                        
                                        // Facebook services
                                        if (platforms.includes('facebook')) {
                                            if (!serviceMap.has('story')) {
                                                serviceMap.set('story-fb', { key: 'story', label: lang === 'el' ? 'Facebook Story' : 'Facebook Story' });
                                            }
                                            if (!serviceMap.has('post-instagram')) {
                                                serviceMap.set('post', { key: 'post', label: txt.price_facebook });
                                            } else {
                                                serviceMap.set('post-fb', { key: 'facebook', label: txt.price_facebook });
                                            }
                                        }
                                        
                                        // Twitter services
                                        if (platforms.includes('twitter')) {
                                            if (!serviceMap.has('post-instagram') && !serviceMap.has('post')) {
                                                serviceMap.set('post', { key: 'post', label: lang === 'el' ? 'Twitter Post' : 'Twitter Post' });
                                            }
                                        }
                                        
                                        // If no platforms, show default services
                                        if (serviceMap.size === 0) {
                                            serviceMap.set('story', { key: 'story', label: txt.price_story });
                                            serviceMap.set('post', { key: 'post', label: txt.price_post });
                                            serviceMap.set('reel', { key: 'reel', label: txt.price_reel });
                                            serviceMap.set('facebook', { key: 'facebook', label: txt.price_facebook });
                                            serviceMap.set('youtube', { key: 'youtube', label: txt.price_youtube });
                                        }
                                        
                                        return Array.from(serviceMap.values()).map((service, idx) => {
                                            const price = profile.rate_card?.[service.key];
                                            const isAsk = !price || price.toLowerCase() === 'ask' || price.toLowerCase() === 'ρώτησε' || price.trim() === '';
                                            
                                            return (
                                                <div key={idx} className="flex justify-between items-center px-4 py-2.5 hover:bg-slate-50 transition-colors">
                                                    <span className="font-medium text-slate-700 text-sm">{service.label}</span>
                                                    {isAsk ? (
                                                        <button
                                                            onClick={() => {
                                                                setShowMessageModal(true);
                                                                setMessageContent(lang === 'el' ? `Ερώτηση σχετικά με ${service.label.toLowerCase()}` : `Question about ${service.label.toLowerCase()}`);
                                                            }}
                                                            className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md font-medium transition-colors"
                                                        >
                                                            {lang === 'el' ? 'Ρώτησε' : 'Ask'}
                                                        </button>
                                                    ) : (
                                                        <span className="font-bold text-lg text-slate-900">{price}</span>
                                                    )}
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </div>
                        <p className="mt-6 text-xs text-slate-400 text-center">{txt.price_note}</p>
                        <button onClick={() => setShowProposalModal(true)} className="w-full mt-6 bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-black transition-colors">
                            {txt.contact_btn}
                        </button>
                     </div>
                )}
                
                {activeTab === "reviews" && (
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">{txt.reviews_title}</h2>
                        <p className="text-sm text-slate-500 mt-1">
                          {lang === 'el' 
                            ? 'Μόνο brands που έχουν ολοκληρώσει συνεργασία μπορούν να αξιολογήσουν' 
                            : 'Only brands who have completed collaborations can review'}
                        </p>
                      </div>
                      <button 
                        onClick={() => setShowReviewModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm"
                      >
                        + {txt.reviews_add}
                      </button>
                    </div>
                    
                    {reviews.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <p className="text-lg">{txt.reviews_empty}</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {reviews.map((review: any) => (
                          <div key={review.id} className="border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-bold text-slate-900">{review.brand_name || review.brand_email}</h4>
                                <p className="text-xs text-slate-500">{new Date(review.created_at).toLocaleDateString()}</p>
                              </div>
                              <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <span key={i} className={`text-xl ${i < review.rating ? 'text-amber-400' : 'text-slate-300'}`}>★</span>
                                ))}
                              </div>
                            </div>
                            {review.project_type && (
                              <span className="inline-block bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded mb-3">
                                {review.project_type}
                              </span>
                            )}
                            {review.review_text && (
                              <p className="text-slate-700 leading-relaxed">{review.review_text}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
            </div>
            <div className="space-y-6">
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase">{txt.connect}</h3>
                    <div className="space-y-3">
                         {Object.entries(profile.socials).map(([plat, user]) => (
                            <a key={plat} href={`https://${plat}.com/${user}`} target="_blank" className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition border border-transparent hover:border-slate-200 group">
                                <span className="capitalize font-medium text-slate-700">{plat}</span>
                                <span className="text-slate-400 group-hover:text-blue-600">↗</span>
                            </a>
                        ))}
                    </div>
                 </div>
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase">{txt.collabs}</h3>
                    <div className="flex flex-wrap gap-2">
                        {profile.past_brands && profile.past_brands.length > 0 ? (
                            profile.past_brands.map((b, i) => <span key={i} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-200">{b}</span>)
                        ) : (
                            <span className="text-slate-400 text-sm">-</span>
                        )}
                    </div>
                 </div>
            </div>
        </div>
      </div>
      
      {/* Counter Proposal Modal */}
      {showCounterProposalModal && counterProposal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">💰 Αντιπρόταση</h2>
              <p className="text-slate-600">
                Ο/Η <strong>{profile?.name}</strong> σας έστειλε μια αντιπρόταση για τη συνεργασία:
              </p>
            </div>
            
            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 mb-6">
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-semibold text-slate-600">Υπηρεσία:</span>
                  <p className="text-lg font-bold text-slate-900">{counterProposal.service_type}</p>
                </div>
                <div className="flex items-center justify-between border-t border-amber-300 pt-3">
                  <div>
                    <span className="text-sm text-slate-600">Προσφερόμενη Τιμή:</span>
                    <p className="text-lg text-slate-500 line-through">€{counterProposal.budget}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-amber-700">Αντιπρόταση:</span>
                    <p className="text-2xl font-extrabold text-amber-600">€{counterProposal.counter_proposal_budget}</p>
                  </div>
                </div>
                {counterProposal.counter_proposal_message && (
                  <div className="border-t border-amber-300 pt-3">
                    <span className="text-sm font-semibold text-slate-600">Σχόλιο:</span>
                    <p className="text-slate-700 mt-1 whitespace-pre-wrap">{counterProposal.counter_proposal_message}</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handleAcceptCounterProposal(counterProposal.id)}
                disabled={processingAction}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                {processingAction ? 'Επεξεργασία...' : '✅ Αποδοχή Αντιπρότασης'}
              </button>
              <button
                onClick={() => handleRejectCounterProposal(counterProposal.id)}
                disabled={processingAction}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                {processingAction ? 'Επεξεργασία...' : '❌ Απόρριψη Αντιπρότασης'}
              </button>
              <button
                onClick={() => {
                  setMessageBrandEmail(counterProposal.brand_email);
                  setMessageBrandName(counterProposal.brand_name);
                  setShowCounterProposalModal(false);
                  setShowMessageModal(true);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                💬 Στείλε Μήνυμα
              </button>
            </div>
            
            <button
              onClick={() => {
                setShowCounterProposalModal(false);
                router.push(`/influencer/${id}`);
              }}
              className="mt-4 w-full text-slate-500 hover:text-slate-700 py-2"
            >
              Κλείσιμο
            </button>
          </div>
        </div>
      )}
    </div>
  );
}