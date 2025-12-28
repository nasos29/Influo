"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import { dummyInfluencers, Influencer } from "@/components/Directory"; 
import { supabase } from "@/lib/supabaseClient";
import { getVideoThumbnail, isVideoUrl } from "@/lib/videoThumbnail";

type Params = Promise<{ id: string }>;

interface ProInfluencer extends Influencer {
  contact_email?: string;
  engagement_rate?: string;
  avg_likes?: string;
  audience_data?: { male: number; female: number; top_age: string };
  rate_card?: { story: string; post: string; reel: string };
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
}

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
    tab_price: "Τιμες",
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
    price_note: "* Οι τιμές ενδέχεται να αλλάξουν ανάλογα το project.",
    modal_title: "Συνεργασία με",
    modal_sub: "Στείλε την πρότασή σου. Θα ειδοποιηθούν άμεσα.",
    modal_srv: "Επιλογή Υπηρεσίας",
    modal_brand: "Όνομα Brand",
    modal_email: "Email Brand",
    modal_bud: "Budget (€)",
    modal_desc: "Περιγραφή Project",
    modal_btn: "Αποστολή Πρότασης",
    modal_success: "Η πρόταση στάλθηκε!",
    modal_success_desc: "Η αίτησή σου καταχωρήθηκε. Θα λάβεις απάντηση στο email σου.",
    modal_close: "Κλείσιμο",
    modal_sending: "Αποστολή...",
    message_btn: "Μήνυμα",
    message_prompt_email: "Εισάγετε το email του brand σας για να ξεκινήσετε τη συνομιλία:",
    message_prompt_name: "Εισάγετε το όνομα του brand σας:",
    message_title: "Στείλτε Μήνυμα",
    message_desc: "Ξεκινήστε μια συνομιλία με αυτόν/αυτήν τον influencer"
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
    collabs: "Brand Collabs",
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
    price_note: "* Prices may vary depending on project scope.",
    modal_title: "Work with",
    modal_sub: "Send a proposal. We'll notify them instantly.",
    modal_srv: "Select Service",
    modal_brand: "Brand Name",
    modal_email: "Brand Email",
    modal_bud: "Budget (€)",
    modal_desc: "Project Details",
    modal_btn: "Send Proposal",
    modal_success: "Proposal Sent!",
    modal_success_desc: "This request has been logged. You will receive an update via email.",
    modal_close: "Close Window",
    modal_sending: "Sending...",
    message_btn: "Message",
    message_prompt_email: "Enter your brand email to start messaging:",
    message_prompt_name: "Enter your brand name:",
    message_title: "Send Message",
    message_desc: "Start a conversation with this influencer"
  }
};

export default function InfluencerProfile(props: { params: Params }) {
  const params = use(props.params);
  const id = params.id;
  
  const [lang, setLang] = useState<"el" | "en">("el");
  const txt = t[lang];

  const [activeTab, setActiveTab] = useState("overview");
  const [profile, setProfile] = useState<ProInfluencer | null>(null);
  const [loading, setLoading] = useState(true);

  // MODAL STATE
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
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

  // Check online status
  useEffect(() => {
    if (!id || id.toString().includes("dummy")) return;

    const checkOnlineStatus = async () => {
      try {
        const { data } = await supabase
          .from('influencer_presence')
          .select('is_online, last_seen')
          .eq('influencer_id', id)
          .single();

        if (data) {
          // Consider online if last seen within 5 minutes
          const lastSeen = new Date(data.last_seen);
          const now = new Date();
          const minutesSinceLastSeen = (now.getTime() - lastSeen.getTime()) / 60000;
          setIsOnline(data.is_online && minutesSinceLastSeen < 5);
        } else {
          setIsOnline(false);
        }
      } catch (error) {
        console.error('Error checking online status:', error);
        setIsOnline(false);
      }
    };

    checkOnlineStatus();
    // Check every 30 seconds
    const interval = setInterval(checkOnlineStatus, 30000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) return;

      // 1. DUMMY CHECK (Keep the logic as is)
      if (id.toString().includes("dummy")) {
        const found = dummyInfluencers.find((d) => String(d.id) === id);
        if (found) {
          setProfile({
            ...found,
            engagement_rate: found.engagement_rate || "5.2%",
            avg_likes: found.avg_likes || "3.2k",
            audience_data: { male: 35, female: 65, top_age: "18-34" },
            rate_card: { story: "80€", post: "150€", reel: "250€" },
            past_brands: ["Zara", "Vodafone", "e-Food"]
          });
          setLoading(false);
          return;
        }
      }

      // 2. REAL CHECK - Works with both UUIDs (new influencers) and numeric IDs (if any)
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
        
        // Build followers object from accounts
        const followersObj: { [key: string]: number } = {};
        if (Array.isArray(data.accounts)) {
          data.accounts.forEach((acc: any) => {
            if (acc.platform && acc.followers) {
              const platform = acc.platform.toLowerCase();
              // Parse followers string (e.g., "15k" -> 15000, "1.5M" -> 1500000)
              let followersNum = 0;
              const followersStr = acc.followers.toString().toLowerCase().replace(/\s/g, '');
              if (followersStr.includes('m')) {
                followersNum = parseFloat(followersStr) * 1000000;
              } else if (followersStr.includes('k')) {
                followersNum = parseFloat(followersStr) * 1000;
              } else {
                followersNum = parseFloat(followersStr) || 0;
              }
              followersObj[platform] = Math.round(followersNum);
            }
          });
        }
        
        setProfile({
          id: data.id,
          name: data.display_name,
          bio: data.bio || "",
          avatar: data.avatar_url || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=400&q=80",
          verified: data.verified,
          contact_email: data.contact_email,
          socials: socialsObj,
          followers: followersObj,
          categories: data.category ? [data.category] : ["Creator"],
          platform: "Instagram",
          gender: data.gender,
          location: data.location,
          languages: data.languages,
          min_rate: data.min_rate,
          videos: Array.isArray(data.videos) ? data.videos : [],
          engagement_rate: data.engagement_rate || "-",
          avg_likes: data.avg_likes || "-",
          audience_data: {
            male: data.audience_male_percent || 50,
            female: data.audience_female_percent || 50,
            top_age: data.audience_top_age || "?"
          },
          rate_card: data.rate_card || { story: "Ask", post: "Ask", reel: "Ask" },
          past_brands: data.past_brands || [],
          avg_rating: data.avg_rating || 0,
          total_reviews: data.total_reviews || 0,
          avg_response_time: data.avg_response_time || 24,
          completion_rate: data.completion_rate || 100,
          availability_status: data.availability_status || 'available',
          skills: data.skills || [],
          certifications: data.certifications || [],
          service_packages: data.service_packages || [],
          calculatedCompletionRate: calculatedCompletionRate
        });
      }
      setLoading(false);
    };
    fetchProfile();
  }, [id]);

  // Load reviews
  useEffect(() => {
    const loadReviews = async () => {
      if (!id || id.toString().includes("dummy")) return;
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
          senderType: 'brand',
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
            onClick={() => setLang(lang === "el" ? "en" : "el")} 
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
                                <input required type="number" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" placeholder="200" value={budget} onChange={e => setBudget(e.target.value)} />
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

      {/* COVER & HEADER (Keep the rest of the code as is) */}
      <div className="h-72 w-full relative bg-slate-900">
         <Image src="https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1500&q=80" alt="Cover" fill className="object-cover opacity-50" />
         <div className="absolute top-6 left-6 z-20">
             <a href="/" className="text-white bg-white/20 backdrop-blur-md px-4 py-2 rounded-lg font-medium hover:bg-white/30 transition">{txt.back}</a>
         </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 relative -mt-24 z-10">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Top Section: Avatar, Name, Info */}
          <div className="p-6 md:p-8 flex flex-col md:flex-row items-center md:items-end gap-6 border-b border-slate-100">
            <div className="relative w-40 h-40 rounded-full border-4 border-white shadow-lg overflow-hidden bg-slate-200 -mt-20 md:mb-0">
                <Image src={profile.avatar} alt={profile.name} fill className="object-cover object-top" />
            </div>
            <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold text-slate-900 flex items-center justify-center md:justify-start gap-2">
                    {profile.name}
                </h1>
                {profile.verified && (
                  <div className="flex items-center justify-center md:justify-start gap-1 mt-1">
                    <span className="text-blue-500 text-sm">✓</span>
                    <span className="text-xs text-blue-600 font-medium">{txt.verified}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-1">
                    <p className="text-slate-500">{profile.location} • {profile.gender === "Male" ? txt.male : txt.female}</p>
                    {isOnline && (
                        <span className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 px-3 py-1 rounded-full text-xs font-semibold animate-pulse">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            {lang === 'el' ? 'Online Τώρα !' : 'Online Now !'}
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3">
                    {profile.languages?.split(",").map((l,i) => <span key={i} className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">{l.trim()}</span>)}
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
            <div className="flex gap-3">
                <button onClick={() => setShowProposalModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-transform hover:-translate-y-1 flex items-center gap-2">
                    <span>⚡</span> {txt.contact}
                </button>
                <button 
                    onClick={() => setShowMessageModal(true)}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-transform hover:-translate-y-1 flex items-center gap-2"
                >
                    <span>💬</span> {txt.message_btn}
                </button>
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
                <p className="text-2xl font-extrabold text-blue-600">{profile.engagement_rate || '-'}</p>
              </div>
              
              {/* Followers */}
              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-slate-200/50 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">👥</span>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === 'el' ? 'Ακόλουθοι' : 'Followers'}</span>
                </div>
                <p className="text-2xl font-extrabold text-slate-900">
                  {profile.followers?.instagram ? 
                    (profile.followers.instagram >= 1000000 
                      ? (profile.followers.instagram / 1000000).toFixed(1) + 'M' 
                      : (profile.followers.instagram / 1000).toFixed(1) + 'k') 
                    : '-'}
                </p>
              </div>
              
              {/* Avg Likes */}
              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-slate-200/50 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">❤️</span>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === 'el' ? 'Μ.Ο. Likes' : 'Avg Likes'}</span>
                </div>
                <p className="text-2xl font-extrabold text-slate-900">{profile.avg_likes || '-'}</p>
              </div>
              
              {/* Collaborations */}
              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-slate-200/50 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🤝</span>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === 'el' ? 'Συνεργασίες' : 'Collabs'}</span>
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
            </div>
            
            {/* Badges */}
            {(profile.engagement_rate && parseFloat(profile.engagement_rate.replace('%', '')) > 5) ||
             (profile.past_brands && profile.past_brands.length > 5) ||
             (profile.socials && Object.keys(profile.socials).length > 2) ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.engagement_rate && parseFloat(profile.engagement_rate.replace('%', '')) > 5 && (
                  <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold">
                    🏆 {txt.badges_top}
                  </span>
                )}
                {profile.past_brands && profile.past_brands.length > 5 && (
                  <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold">
                    ⭐ {txt.badges_premium}
                  </span>
                )}
                {profile.socials && Object.keys(profile.socials).length > 2 && (
                  <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                    📱 {txt.badges_multi}
                  </span>
                )}
              </div>
            ) : null}
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
                            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{profile.bio || txt.no_bio}</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                             <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                                <p className="text-slate-400 text-xs font-bold uppercase">{txt.stat_eng}</p>
                                <p className="text-2xl font-extrabold text-blue-600">{profile.engagement_rate}</p>
                             </div>
                             <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                                <p className="text-slate-400 text-xs font-bold uppercase">{txt.stat_likes}</p>
                                <p className="text-2xl font-extrabold text-slate-800">{profile.avg_likes}</p>
                             </div>
                             <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                                <p className="text-slate-400 text-xs font-bold uppercase">{txt.foll}</p>
                                <p className="text-2xl font-extrabold text-slate-800">
                                    {profile.followers?.instagram ? (profile.followers.instagram / 1000).toFixed(1) + 'k' : 'N/A'}
                                </p>
                             </div>
                             <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                                <p className="text-slate-400 text-xs font-bold uppercase">{txt.collabs}</p>
                                <p className="text-2xl font-extrabold text-purple-600">{profile.past_brands?.length || 0}</p>
                             </div>
                        </div>
                         <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-4">{txt.portfolio}</h3>
                            {profile.videos && profile.videos.length > 0 && profile.videos[0] !== "" ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {profile.videos.map((vid, i) => {
                                        const thumbnail = getVideoThumbnail(vid);
                                        const isVideo = isVideoUrl(vid);
                                        const isImage = vid.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                                        return (
                                            <a key={i} href={vid} target="_blank" rel="noopener noreferrer" className="block group relative h-48 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                                                {thumbnail || isImage ? (
                                                    <>
                                                        <Image 
                                                            src={thumbnail || vid} 
                                                            alt={`Portfolio item ${i+1}`} 
                                                            fill 
                                                            className="object-cover" 
                                                            unoptimized
                                                        />
                                                        {isVideo && (
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                                                                <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                                                    <span className="text-3xl text-slate-900 ml-1">▶</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-black/80 to-transparent text-white text-sm font-medium">
                                                            {isVideo ? `Video ${i+1}` : `Photo ${i+1}`}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                                                        <div className="text-center">
                                                            <span className="text-5xl opacity-80 group-hover:scale-110 transition-transform block mb-2">▶</span>
                                                            <span className="text-white text-sm opacity-75">Video Link</span>
                                                        </div>
                                                        <div className="absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-black/80 to-transparent text-white text-sm font-medium">
                                                            Highlight #{i+1}
                                                        </div>
                                                    </div>
                                                )}
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
                        
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-4 border-b border-slate-100">
                                <span className="font-medium text-slate-700">{txt.price_story}</span>
                                <span className="font-bold text-xl text-slate-900">{profile.rate_card?.story}</span>
                            </div>
                            <div className="flex justify-between items-center p-4 border-b border-slate-100">
                                <span className="font-medium text-slate-700">{txt.price_post}</span>
                                <span className="font-bold text-xl text-slate-900">{profile.rate_card?.post}</span>
                            </div>
                            <div className="flex justify-between items-center p-4 border-b border-slate-100">
                                <span className="font-medium text-slate-700">{txt.price_reel}</span>
                                <span className="font-bold text-xl text-slate-900">{profile.rate_card?.reel}</span>
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
    </div>
  );
}