"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient"; 
import Image from "next/image";

interface DbInfluencer {
  id: number;
  created_at: string;
  display_name: string;
  gender: string;
  contact_email: string;
  verified: boolean;
  accounts: { platform: string; username: string; followers: string }[] | null; 
  avatar_url: string | null;
  avg_likes: string | null; 
  location: string | null;
  followers_count: string | null; 
  insights_urls: string[] | null; 
  videos: string[] | null;
  min_rate: string | null;
  languages: string | null;
  bio: string | null;
  engagement_rate: string | null;
  audience_male_percent: number | null;
  audience_female_percent: number | null;
  audience_top_age: string | null;
  category?: string;
}

interface Proposal {
  id: number;
  created_at: string;
  brand_name: string;
  budget: string;
  service_type: string;
  status: string;
  influencer_id: number;
  influencers: { display_name: string };
}

interface Conversation {
  id: string;
  influencer_id: string;
  influencer_name: string;
  influencer_email: string;
  brand_email: string;
  brand_name: string | null;
  proposal_id: number | null;
  created_at: string;
  last_message_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: 'influencer' | 'brand';
  content: string;
  read: boolean;
  sent_via_email: boolean;
  created_at: string;
}

interface Brand {
  id: string;
  brand_name: string;
  contact_email: string;
  contact_person: string | null;
  website: string | null;
  industry: string | null;
  afm: string;
  logo_url: string | null;
  verified: boolean;
  created_at: string;
}

interface BlogPost {
  slug: string;
  title: { el: string; en: string };
  excerpt: { el: string; en: string };
  date: string;
  category: { el: string; en: string };
  readTime: { el: string; en: string };
  image: string;
  content?: { el: string; en: string };
}

const t = {
  el: {
    title: "Admin Dashboard",
    sub: "Επισκόπηση & Διαχείριση",
    back: "Πίσω στο Site",
    users: "Συνολικοί Χρήστες",
    pending: "Εκκρεμούν",
    verified: "Εγκεκριμένοι",
    reach: "Απήχηση",
    pipeline: "Pipeline",
    tab_inf: "Influencers",
    tab_deals: "Proposals",
    tab_brands: "Companies",
    tab_blog: "Blog",
    col_inf: "Influencer",
    col_loc: "Τοποθεσία",
    col_status: "Status",
    col_act: "Ενέργειες",
    btn_approve: "Έγκριση",
    btn_unverify: "Ανάκληση",
    btn_delete: "Διαγραφή",
    cleanup_test: "Cleanup Test Users",
    sql_helper: "SQL Helper",
    export: "Export",
    search: "Αναζήτηση...",
    filter: "Φίλτρο",
    select_all: "Επιλογή όλων",
    bulk_approve: "Έγκριση επιλεγμένων",
    bulk_delete: "Διαγραφή επιλεγμένων",
    no_data: "Δεν υπάρχουν δεδομένα",
    modal_basic: "Βασικές Πληροφορίες",
    modal_insights: "Insights",
    modal_view: "Προβολή",
    modal_followers: "Followers",
    modal_minrate: "Ελάχιστη Χρέωση",
    modal_gender: "Φύλο",
    modal_bio: "Bio",
    modal_socials: "Socials",
    modal_screenshots: "Screenshots",
    edit: "Επεξεργασία",
    view: "Προβολή",
    email: "Email",
    created: "Ημερομηνία",
    category: "Κατηγορία",
    engagement: "Engagement",
    min_rate_label: "Min Rate",
    col_brand: "Brand",
    col_bud: "Budget",
    col_srv: "Υπηρεσία",
    col_date: "Ημερομηνία",
    blog_add: "Νέο Άρθρο",
    blog_edit: "Επεξεργασία",
    blog_delete: "Διαγραφή",
    blog_title: "Τίτλος",
    blog_slug: "Slug",
    blog_category: "Κατηγορία",
    blog_date: "Ημερομηνία",
    blog_actions: "Ενέργειες"
  },
  en: {
    title: "Admin Dashboard",
    sub: "Overview & Management",
    back: "Back to Site",
    users: "Total Users",
    pending: "Pending",
    verified: "Verified",
    reach: "Total Reach",
    pipeline: "Pipeline",
    tab_inf: "Influencers",
    tab_deals: "Proposals",
    tab_brands: "Companies",
    tab_blog: "Blog",
    col_inf: "Influencer",
    col_loc: "Location",
    col_status: "Status",
    col_act: "Actions",
    btn_approve: "Approve",
    btn_unverify: "Unverify",
    btn_delete: "Delete",
    cleanup_test: "Cleanup Test Users",
    sql_helper: "SQL Helper",
    export: "Export",
    search: "Search...",
    filter: "Filter",
    select_all: "Select All",
    bulk_approve: "Approve Selected",
    bulk_delete: "Delete Selected",
    no_data: "No data available",
    modal_basic: "Basic Info",
    modal_insights: "Insights",
    modal_view: "View",
    modal_followers: "Followers",
    modal_minrate: "Min Rate",
    modal_gender: "Gender",
    modal_bio: "Bio",
    modal_socials: "Socials",
    modal_screenshots: "Screenshots",
    edit: "Edit",
    view: "View",
    email: "Email",
    created: "Created",
    category: "Category",
    engagement: "Engagement",
    min_rate_label: "Min Rate",
    col_brand: "Brand",
    col_bud: "Budget",
    col_srv: "Service",
    col_date: "Date",
    blog_add: "New Article",
    blog_edit: "Edit",
    blog_delete: "Delete",
    blog_title: "Title",
    blog_slug: "Slug",
    blog_category: "Category",
    blog_date: "Date",
    blog_actions: "Actions"
  }
};

const EditProfileModal = ({ user, onClose, onSave }: { user: DbInfluencer, onClose: () => void, onSave: (updatedUser: DbInfluencer) => void }) => {
    const [name, setName] = useState(user.display_name);
    const [bio, setBio] = useState(user.bio || "");
    const [minRate, setMinRate] = useState(user.min_rate || "");
    const [location, setLocation] = useState(user.location || "");
    const [avgLikes, setAvgLikes] = useState(user.avg_likes || "");
    const [engage, setEngage] = useState(user.engagement_rate || "");
    const [gender, setGender] = useState(user.gender || "Female");
    const [category, setCategory] = useState(user.category || "Lifestyle");
    const [languages, setLanguages] = useState(user.languages || "");
    const [accounts, setAccounts] = useState<{ platform: string; username: string; followers: string }[]>(user.accounts || [{ platform: "Instagram", username: "", followers: "" }]);
    const [videos, setVideos] = useState<string[]>(Array.isArray(user.videos) ? user.videos : []);
    const [malePercent, setMalePercent] = useState(user.audience_male_percent?.toString() || "");
    const [femalePercent, setFemalePercent] = useState(user.audience_female_percent?.toString() || "");
    const [topAge, setTopAge] = useState(user.audience_top_age || "");
    const [loading, setLoading] = useState(false);

    const CATEGORIES = ["Lifestyle", "Beauty", "Fashion", "Food", "Travel", "Gaming", "Tech", "Fitness", "Education", "Comedy", "Music", "Art", "Photography", "DIY", "Business", "Family", "Animals", "Sports", "Other"];

    const handleAccountChange = (i: number, field: keyof typeof accounts[0], value: string) => {
        const copy = [...accounts]; 
        copy[i][field] = value; 
        setAccounts(copy);
    };
    const addAccount = () => setAccounts([...accounts, { platform: "Instagram", username: "", followers: "" }]);
    const removeAccount = (i: number) => { 
        const copy = [...accounts]; 
        copy.splice(i, 1); 
        setAccounts(copy); 
    };

    const handleVideoChange = (i: number, value: string) => {
        const copy = [...videos]; 
        copy[i] = value; 
        setVideos(copy);
    };
    const addVideo = () => setVideos([...videos, ""]);
    const removeVideo = (i: number) => { 
        const copy = [...videos]; 
        copy.splice(i, 1); 
        setVideos(copy); 
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { data, error } = await supabase
            .from('influencers')
            .update({ 
                display_name: name, 
                bio: bio, 
                min_rate: minRate,
                location: location, 
                avg_likes: avgLikes, 
                engagement_rate: engage,
                gender: gender,
                category: category,
                languages: languages,
                accounts: accounts,
                videos: videos.filter(v => v !== ""),
                audience_male_percent: parseInt(malePercent) || 0,
                audience_female_percent: parseInt(femalePercent) || 0,
                audience_top_age: topAge,
            })
            .eq('id', user.id)
            .select()
            .single();

        setLoading(false);

        if (error) {
            alert("Error saving: " + error.message);
        } else if (data) {
            onSave(data as DbInfluencer);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-900">Edit Profile - {user.display_name}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-6">
                        {/* Avatar Preview */}
                        {user.avatar_url && (
                            <div className="flex items-center gap-4 pb-4 border-b border-slate-200">
                                <div className="relative w-20 h-20 rounded-full overflow-hidden bg-slate-200">
                                    <Image 
                                        src={user.avatar_url} 
                                        alt={user.display_name} 
                                        width={80} 
                                        height={80} 
                                        className="object-cover w-full h-full"
                                        unoptimized
                                    />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-900">Profile Photo</p>
                                    <p className="text-xs text-slate-500">Current avatar</p>
                                </div>
                            </div>
                        )}

                        {/* Basic Info */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase mb-3">Basic Information</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">Full Name</label>
                                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">Location</label>
                                    <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">Gender</label>
                                    <select value={gender} onChange={e => setGender(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900">
                                        <option value="Female">Female</option>
                                        <option value="Male">Male</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">Category</label>
                                    <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900">
                                        {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">Languages</label>
                                    <input type="text" value={languages} onChange={e => setLanguages(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" placeholder="e.g. Greek, English" />
                                </div>
                            </div>
                        </div>

                        {/* Bio */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-1">Bio</label>
                            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-slate-900" />
                        </div>

                        {/* Social Accounts */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase mb-3">Social Accounts</h3>
                            {accounts.map((account, i) => (
                                <div key={i} className="flex gap-2 mb-3 items-end">
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Platform</label>
                                        <select value={account.platform} onChange={e => handleAccountChange(i, 'platform', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900">
                                            <option value="Instagram">Instagram</option>
                                            <option value="TikTok">TikTok</option>
                                            <option value="YouTube">YouTube</option>
                                            <option value="Facebook">Facebook</option>
                                            <option value="Twitter">Twitter/X</option>
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Username</label>
                                        <input type="text" value={account.username} onChange={e => handleAccountChange(i, 'username', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" placeholder="username" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Followers</label>
                                        <input type="text" value={account.followers} onChange={e => handleAccountChange(i, 'followers', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" placeholder="e.g. 15k" />
                                    </div>
                                    <button type="button" onClick={() => removeAccount(i)} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">✕</button>
                                </div>
                            ))}
                            <button type="button" onClick={addAccount} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm">+ Add Account</button>
                        </div>

                        {/* Analytics */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase mb-3">Analytics</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">Min Rate (€)</label>
                                    <input type="text" value={minRate} onChange={e => setMinRate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">Engagement Rate (%)</label>
                                    <input type="text" value={engage} onChange={e => setEngage(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">Avg Likes/Views</label>
                                    <input type="text" value={avgLikes} onChange={e => setAvgLikes(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
                                </div>
                            </div>
                        </div>

                        {/* Audience Data */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase mb-3">Audience Demographics</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">Male (%)</label>
                                    <input type="number" value={malePercent} onChange={e => setMalePercent(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" min="0" max="100" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">Female (%)</label>
                                    <input type="number" value={femalePercent} onChange={e => setFemalePercent(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" min="0" max="100" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">Top Age Group</label>
                                    <input 
                                        type="text" 
                                        value={topAge} 
                                        onChange={(e) => {
                                            let value = e.target.value;
                                            // Allow only numbers and dashes
                                            value = value.replace(/[^0-9-]/g, '');
                                            // Auto-add dash after 2 digits if not already present
                                            if (value.length === 2 && !value.includes('-')) {
                                                value = value + '-';
                                            }
                                            setTopAge(value);
                                        }}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" 
                                        placeholder="e.g. 18-24" 
                                        maxLength={6}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Videos */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase mb-3">Video Links / Φωτογραφίες</h3>
                            {videos.map((video, i) => {
                                // Try to get thumbnail for YouTube videos
                                const isYoutube = video && /youtube\.com|youtu\.be/.test(video);
                                const youtubeId = video?.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
                                const thumbnail = youtubeId ? `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg` : null;
                                const isVideo = video && /youtube\.com|youtu\.be|tiktok\.com|instagram\.com.*reel/.test(video.toLowerCase());
                                return (
                                    <div key={i} className="mb-3">
                                        <div className="flex gap-2 items-end">
                                            <div className="flex-1">
                                                <label className="block text-xs font-semibold text-slate-700 mb-1">Video/Photo URL</label>
                                                <input type="url" value={video} onChange={e => handleVideoChange(i, e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" placeholder="https://..." />
                                            </div>
                                            <button type="button" onClick={() => removeVideo(i)} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">✕</button>
                                        </div>
                                        {video && (
                                            <div className="mt-2 relative w-full h-32 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                                                {thumbnail ? (
                                                    <>
                                                        <img src={thumbnail} alt="Video thumbnail" className="w-full h-full object-cover" />
                                                        {isVideo && (
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                                                <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                                                                    <span className="text-2xl text-slate-900">▶</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : video.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                                    <img src={video} alt="Photo" className="w-full h-full object-cover" />
                                                ) : video && (
                                                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                                                        {isVideo ? "Video link (no preview)" : "Image/Video link"}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            <button type="button" onClick={addVideo} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm">+ Προσθήκη Video Link / Φωτογραφίας</button>
                        </div>

                        {/* Insights Screenshots */}
                        {user.insights_urls && user.insights_urls.length > 0 && (
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 uppercase mb-3">Insights Screenshots</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    {user.insights_urls.map((url, i) => (
                                        <div key={i} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-slate-300">
                                            <Image 
                                                src={url} 
                                                alt={`Insight ${i + 1}`} 
                                                fill
                                                className="object-cover"
                                                unoptimized
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
                        <button type="button" onClick={onClose} className="px-6 py-2 text-slate-900 hover:bg-slate-100 rounded-lg font-semibold transition-colors border border-slate-300">Cancel</button>
                        <button type="submit" disabled={loading} className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold disabled:opacity-50 transition-colors">
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default function AdminDashboardContent({ adminEmail }: { adminEmail: string }) {
  const [lang, setLang] = useState<"el" | "en">("el");
  const txt = t[lang];

  const [activeTab, setActiveTab] = useState("influencers");
  const [users, setUsers] = useState<DbInfluencer[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandSearchQuery, setBrandSearchQuery] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversationMessages, setConversationMessages] = useState<Message[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [blogSearchQuery, setBlogSearchQuery] = useState("");
  const [selectedBlogPost, setSelectedBlogPost] = useState<BlogPost | null>(null);
  const [showBlogEditModal, setShowBlogEditModal] = useState(false);
  const [isNewBlogPost, setIsNewBlogPost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "verified" | "pending">("all");
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  
  const [selectedUser, setSelectedUser] = useState<DbInfluencer | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const [stats, setStats] = useState({ 
    total: 0, 
    pending: 0, 
    verified: 0, 
    reach: "0",
    pipeline: "0€" 
  });
  const [pendingProposalsCount, setPendingProposalsCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const fetchConversationMessages = async (convId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setConversationMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchBrands = async () => {
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setBrands(data || []);
    } catch (error) {
      console.error('Error fetching brands:', error);
    }
  };

  const fetchBlogPosts = async () => {
    try {
      // Initialize with initial posts if localStorage is empty
      const { initializeBlogPosts, getBlogPosts } = await import('@/lib/blogPosts');
      initializeBlogPosts();
      const posts = getBlogPosts();
      setBlogPosts(posts);
    } catch (error) {
      console.error('Error fetching blog posts:', error);
      // Fallback to localStorage
      const stored = localStorage.getItem('blogPosts');
      if (stored) {
        try {
          setBlogPosts(JSON.parse(stored));
        } catch {
          setBlogPosts([]);
        }
      } else {
        setBlogPosts([]);
      }
    }
  };

  const saveBlogPost = async (post: BlogPost) => {
    try {
      const updated = isNewBlogPost 
        ? [...blogPosts, post]
        : blogPosts.map(p => p.slug === post.slug ? post : p);
      
      setBlogPosts(updated);
      localStorage.setItem('blogPosts', JSON.stringify(updated));
      // Dispatch event to notify blog pages
      window.dispatchEvent(new Event('blogPostsUpdated'));
      setShowBlogEditModal(false);
      setSelectedBlogPost(null);
      setIsNewBlogPost(false);
      alert(lang === 'el' ? 'Το άρθρο αποθηκεύτηκε!' : 'Article saved!');
    } catch (error) {
      console.error('Error saving blog post:', error);
      alert(lang === 'el' ? 'Σφάλμα κατά την αποθήκευση' : 'Error saving');
    }
  };

  const deleteBlogPost = async (slug: string) => {
    if (!confirm(lang === 'el' ? 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το άρθρο;' : 'Are you sure you want to delete this article?')) {
      return;
    }
    try {
      const updated = blogPosts.filter(p => p.slug !== slug);
      setBlogPosts(updated);
      localStorage.setItem('blogPosts', JSON.stringify(updated));
      // Dispatch event to notify blog pages
      window.dispatchEvent(new Event('blogPostsUpdated'));
      alert(lang === 'el' ? 'Το άρθρο διαγράφηκε!' : 'Article deleted!');
    } catch (error) {
      console.error('Error deleting blog post:', error);
      alert(lang === 'el' ? 'Σφάλμα κατά τη διαγραφή' : 'Error deleting');
    }
  };

  const loadBlogPostContent = async (post: BlogPost): Promise<BlogPost> => {
    // If post already has content, return as is
    if (post.content?.el && post.content?.en) {
      return post;
    }

    // Try to load content from hardcoded posts
    try {
      // Dynamic import of posts from blog page (this will work on client side)
      const blogSlugModule = await import('@/app/blog/[slug]/page');
      const posts = (blogSlugModule as any).posts;
      
      if (posts && posts[post.slug]) {
        const hardcodedPost = posts[post.slug];
        return {
          ...post,
          content: hardcodedPost.content || { el: '', en: '' }
        };
      }
    } catch (error) {
      console.error('Error loading content from hardcoded posts:', error);
    }

    // Return with empty content if not found
    return {
      ...post,
      content: post.content || { el: '', en: '' }
    };
  };

  const fetchData = async () => {
    setLoading(true);
    const { data: usersData } = await supabase.from("influencers").select("*").order("created_at", { ascending: false });
    const { data: propData } = await supabase.from("proposals").select("*, influencers(display_name)").order("created_at", { ascending: false });

    if (usersData) {
      setUsers(usersData as any);
      const total = usersData.length;
      const verified = usersData.filter((u) => u.verified).length;
      
      const totalReachNum = usersData.reduce((acc, curr) => {
         let val = 0;
         if (curr.avg_likes) {
             const clean = curr.avg_likes.toLowerCase().trim().replace(/,/g, '');
             if (clean.endsWith('k')) val = parseFloat(clean) * 1000;
             else if (clean.endsWith('m')) val = parseFloat(clean) * 1000000;
             else val = parseFloat(clean);
         }
         return acc + (isNaN(val) ? 0 : val);
      }, 0);
      let formattedReach = totalReachNum > 1000000 ? (totalReachNum / 1000000).toFixed(1) + 'M' : (totalReachNum / 1000).toFixed(1) + 'k';

      let pipelineSum = 0;
      let pendingProps = 0;
      if (propData) {
          setProposals(propData as any);
          propData.forEach(p => {
              const val = parseFloat(p.budget);
              if (!isNaN(val)) pipelineSum += val;
              if (p.status === 'pending') pendingProps++;
          });
          setPendingProposalsCount(pendingProps);
      }

      setStats({ 
        total, 
        verified, 
        pending: total - verified, 
        reach: formattedReach,
        pipeline: pipelineSum.toLocaleString() + "€"
      });
    }
    setLoading(false);
  };
  
  // Load unread messages count for admin
  useEffect(() => {
    const loadUnreadMessages = async () => {
      try {
        // Count all unread messages from both brands and influencers
        const { count, error } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('read', false);
        
        if (!error && count !== null) {
          setUnreadMessagesCount(count);
        } else if (error) {
          console.error('Error counting unread messages:', error);
          setUnreadMessagesCount(0);
        }
      } catch (error) {
        console.error('Error loading unread messages count:', error);
      }
    };
    
    loadUnreadMessages();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadUnreadMessages();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchData();
    fetchConversations();
    fetchBrands();
    fetchBlogPosts();
    
    // Refresh counts periodically
    const interval = setInterval(() => {
      fetchData();
      fetchConversations();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchConversationMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  const toggleStatus = async (id: number, currentStatus: boolean, userEmail: string, userName: string) => {
    const { error } = await supabase.from("influencers").update({ verified: !currentStatus }).eq("id", id);
    
    if (!error) {
        fetchData();
        if (!currentStatus) { 
             try {
                await fetch('/api/emails', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'approved', email: userEmail, name: userName })
                });
             } catch (e) {
                 console.error('Email sending error:', e);
             }
        }
    }
    
    if(selectedUser?.id === id) {
        setSelectedUser(prev => prev ? {...prev, verified: !currentStatus} : null);
    }
  };
  
  const deleteUser = async (id: number) => {
    if (!confirm("Είσαι σίγουρος ότι θες να διαγράψεις αυτόν τον χρήστη;")) {
        return;
    }

    try {
        const response = await fetch('/api/admin/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: id }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to delete user');
        }

        fetchData();
        setSelectedUser(null);
        setSelectedUsers(selectedUsers.filter(uId => uId !== id));
    } catch (error: any) {
        console.error('Error deleting user:', error);
        alert(`Σφάλμα: ${error.message}`);
    }
  };

  const handleUserUpdate = (updatedUser: DbInfluencer) => {
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      setShowEditModal(false);
      setSelectedUser(updatedUser);
  };

  const handleCleanupTestUsers = async () => {
    const emailsInput = prompt(
      lang === "el" 
        ? "Εισάγετε τα emails (χωρισμένα με κόμμα):\n\nπ.χ. test1@example.com, test2@example.com"
        : "Enter emails (comma-separated):\n\ne.g. test1@example.com, test2@example.com"
    );

    if (!emailsInput || !emailsInput.trim()) return;

    const emails = emailsInput.split(',').map(e => e.trim()).filter(e => e.length > 0);
    if (emails.length === 0) {
      alert(lang === "el" ? "Δεν δόθηκαν έγκυρα emails." : "No valid emails provided.");
      return;
    }

    if (!confirm(
      lang === "el"
        ? `Θέλετε να διαγράψετε ${emails.length} user(s)?\n\n${emails.join('\n')}`
        : `Delete ${emails.length} user(s)?\n\n${emails.join('\n')}`
    )) return;

    try {
      const response = await fetch('/api/admin/cleanup-test-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed');

      const successful = result.results.filter((r: any) => r.success).length;
      const failed = result.results.filter((r: any) => !r.success).length;
      alert(`${lang === "el" ? "Επιτυχία" : "Success"}: ${successful}, ${lang === "el" ? "Αποτυχία" : "Failed"}: ${failed}`);
      fetchData();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleBulkAction = async (action: 'approve' | 'delete') => {
    if (selectedUsers.length === 0) {
      alert(lang === "el" ? "Επιλέξτε τουλάχιστον έναν χρήστη" : "Select at least one user");
      return;
    }

    if (action === 'delete' && !confirm(lang === "el" ? `Διαγραφή ${selectedUsers.length} χρηστών;` : `Delete ${selectedUsers.length} users?`)) {
      return;
    }

    try {
      for (const userId of selectedUsers) {
        if (action === 'approve') {
          await supabase.from("influencers").update({ verified: true }).eq("id", userId);
        } else {
          await fetch('/api/admin/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          });
        }
      }
      setSelectedUsers([]);
      fetchData();
      alert(lang === "el" ? "Ολοκληρώθηκε" : "Completed");
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const exportData = () => {
    const csv = [
      ['Name', 'Email', 'Location', 'Status', 'Min Rate', 'Created'].join(','),
      ...filteredUsers.map(u => [
        u.display_name,
        u.contact_email || '',
        u.location || '',
        u.verified ? 'Verified' : 'Pending',
        u.min_rate || '',
        u.created_at
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `influencers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = !searchQuery || 
      u.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.contact_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.location?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'verified' && u.verified) ||
      (statusFilter === 'pending' && !u.verified);
    
    return matchesSearch && matchesStatus;
  });

  const toggleUserSelection = (id: number) => {
    setSelectedUsers(prev => 
      prev.includes(id) ? prev.filter(uId => uId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-slate-600">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{txt.title}</h1>
              <p className="text-sm text-slate-500">{txt.sub}</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleCleanupTestUsers} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                {txt.cleanup_test}
              </button>
              <button 
                onClick={() => setLang(lang === "el" ? "en" : "el")} 
                className="text-xs font-medium border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 text-slate-600 transition-colors"
                aria-label="Toggle language"
              >
                {lang === "el" ? "EN" : "EL"}
              </button>
              <a href="/logout" className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">Logout</a>
              <a href="/" className="px-3 py-1.5 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">{txt.back}</a>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-500 uppercase font-medium mb-1">{txt.users}</p>
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
            <p className="text-xs text-yellow-700 uppercase font-medium mb-1">{txt.pending}</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <p className="text-xs text-green-700 uppercase font-medium mb-1">{txt.verified}</p>
            <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <p className="text-xs text-blue-700 uppercase font-medium mb-1">{txt.reach}</p>
            <p className="text-2xl font-bold text-blue-600">{stats.reach}</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
            <p className="text-xs text-purple-700 uppercase font-medium mb-1">{txt.pipeline}</p>
            <p className="text-2xl font-bold text-purple-600">{stats.pipeline}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg border border-slate-200 mb-4">
          <div className="flex items-center justify-between border-b border-slate-200 px-6">
            <div className="flex gap-1">
              <button 
                onClick={() => setActiveTab("influencers")} 
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "influencers" 
                    ? "border-slate-900 text-slate-900" 
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {txt.tab_inf} ({filteredUsers.length})
              </button>
              <button 
                onClick={() => setActiveTab("proposals")} 
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors relative ${
                  activeTab === "proposals" 
                    ? "border-slate-900 text-slate-900" 
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {txt.tab_deals} ({proposals.length})
                {pendingProposalsCount > 0 && (
                  <span className="absolute top-1 right-1 md:top-1.5 md:right-1.5 bg-red-500 text-white text-[9px] md:text-[10px] font-bold rounded-full min-w-[14px] md:min-w-[16px] h-[14px] md:h-[16px] flex items-center justify-center px-0.5">
                    {pendingProposalsCount > 99 ? '99+' : pendingProposalsCount > 9 ? '9+' : pendingProposalsCount}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setActiveTab("conversations")} 
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors relative ${
                  activeTab === "conversations" 
                    ? "border-slate-900 text-slate-900" 
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                💬 Συνομιλίες ({conversations.length})
                {unreadMessagesCount > 0 && (
                  <span className="absolute top-1 right-1 md:top-1.5 md:right-1.5 bg-red-500 text-white text-[9px] md:text-[10px] font-bold rounded-full min-w-[14px] md:min-w-[16px] h-[14px] md:h-[16px] flex items-center justify-center px-0.5">
                    {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setActiveTab("brands")} 
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "brands" 
                    ? "border-slate-900 text-slate-900" 
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {txt.tab_brands} ({brands.length})
              </button>
              <button 
                onClick={() => setActiveTab("blog")} 
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "blog" 
                    ? "border-slate-900 text-slate-900" 
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {txt.tab_blog} ({blogPosts.length})
              </button>
            </div>
          </div>

          {activeTab === "influencers" && (
            <>
              {/* Search & Filters */}
              <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder={txt.search}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">{txt.filter}: All</option>
                  <option value="verified">Verified</option>
                  <option value="pending">Pending</option>
                </select>
                <button
                  onClick={exportData}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                >
                  {txt.export}
                </button>
              </div>

              {/* Bulk Actions */}
              {selectedUsers.length > 0 && (
                <div className="px-4 py-3 bg-blue-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-sm text-slate-700">
                    {selectedUsers.length} {lang === "el" ? "επιλεγμένοι" : "selected"}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBulkAction('approve')}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    >
                      {txt.bulk_approve}
                    </button>
                    <button
                      onClick={() => handleBulkAction('delete')}
                      className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                    >
                      {txt.bulk_delete}
                    </button>
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-slate-300"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.col_inf}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.email}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.col_loc}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.col_status}</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">{txt.col_act}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">{txt.no_data}</td>
                      </tr>
                    ) : (
                      filteredUsers.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedUsers.includes(u.id)}
                              onChange={() => toggleUserSelection(u.id)}
                              className="rounded border-slate-300"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {u.avatar_url ? (
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200">
                                  <Image 
                                    src={u.avatar_url} 
                                    alt={u.display_name} 
                                    width={40} 
                                    height={40} 
                                    className="object-cover w-full h-full"
                                    unoptimized
                                  />
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center text-slate-400 text-xs">No Photo</div>
                              )}
                              <div>
                                <div className="font-medium text-slate-900">{u.display_name}</div>
                                {u.category && <div className="text-xs text-slate-600">{u.category}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-900">{u.contact_email || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-900">{u.location || '-'}</td>
                          <td className="px-4 py-3">
                            {u.verified ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Verified</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Pending</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => { setSelectedUser(u); setShowEditModal(true); }}
                                className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                              >
                                {txt.edit}
                              </button>
                              <button
                                onClick={() => toggleStatus(u.id, u.verified, u.contact_email || "", u.display_name)}
                                className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                              >
                                {u.verified ? txt.btn_unverify : txt.btn_approve}
                              </button>
                              <button
                                onClick={() => deleteUser(u.id)}
                                className="px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                              >
                                {txt.btn_delete}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === "proposals" && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.col_brand}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.col_inf}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.col_bud}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.col_status}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {proposals.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">{txt.no_data}</td>
                    </tr>
                  ) : (
                    proposals.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{p.brand_name}</td>
                        <td className="px-4 py-3 text-slate-600">{p.influencers?.display_name}</td>
                        <td className="px-4 py-3 font-medium text-green-600">{p.budget}€</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{p.status}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "brands" && (
            <>
              {/* Search */}
              <div className="p-4 border-b border-slate-200">
                <input
                  type="text"
                  placeholder={lang === 'el' ? 'Αναζήτηση επιχείρησης...' : 'Search company...'}
                  value={brandSearchQuery}
                  onChange={(e) => setBrandSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Brands Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'Εταιρεία' : 'Company'}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'Email' : 'Email'}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'ΑΦΜ' : 'Tax ID'}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'Κλάδος' : 'Industry'}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'Ημερομηνία' : 'Date'}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'Κατάσταση' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {brands.filter(b => 
                      brandSearchQuery === "" || 
                      b.brand_name.toLowerCase().includes(brandSearchQuery.toLowerCase()) ||
                      b.contact_email.toLowerCase().includes(brandSearchQuery.toLowerCase())
                    ).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">{txt.no_data}</td>
                      </tr>
                    ) : (
                      brands.filter(b => 
                        brandSearchQuery === "" || 
                        b.brand_name.toLowerCase().includes(brandSearchQuery.toLowerCase()) ||
                        b.contact_email.toLowerCase().includes(brandSearchQuery.toLowerCase())
                      ).map(b => (
                        <tr key={b.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {b.logo_url ? (
                                <img src={b.logo_url} alt={b.brand_name} className="w-8 h-8 rounded object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-slate-200 flex items-center justify-center text-slate-400 text-xs font-bold">
                                  {b.brand_name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span className="font-medium text-slate-900">{b.brand_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{b.contact_email}</td>
                          <td className="px-4 py-3 text-slate-600">{b.afm}</td>
                          <td className="px-4 py-3 text-slate-600">{b.industry || '-'}</td>
                          <td className="px-4 py-3 text-slate-600 text-sm">
                            {new Date(b.created_at).toLocaleDateString('el-GR')}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              b.verified 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {b.verified ? (lang === 'el' ? 'Επαληθευμένη' : 'Verified') : (lang === 'el' ? 'Εκκρεμεί' : 'Pending')}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === "blog" && (
            <>
              {/* Search & Add */}
              <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder={lang === 'el' ? "Αναζήτηση άρθρων..." : "Search articles..."}
                    value={blogSearchQuery}
                    onChange={(e) => setBlogSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={() => {
                    setIsNewBlogPost(true);
                    setSelectedBlogPost({
                      slug: '',
                      title: { el: '', en: '' },
                      excerpt: { el: '', en: '' },
                      date: new Date().toISOString().split('T')[0],
                      category: { el: '', en: '' },
                      readTime: { el: '', en: '' },
                      image: '',
                      content: { el: '', en: '' }
                    });
                    setShowBlogEditModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  + {txt.blog_add}
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.blog_title}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.blog_slug}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.blog_category}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.blog_date}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.blog_actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {blogPosts.filter(p => 
                      blogSearchQuery === "" ||
                      p.title.el.toLowerCase().includes(blogSearchQuery.toLowerCase()) ||
                      p.title.en.toLowerCase().includes(blogSearchQuery.toLowerCase()) ||
                      p.slug.toLowerCase().includes(blogSearchQuery.toLowerCase())
                    ).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">{txt.no_data}</td>
                      </tr>
                    ) : (
                      blogPosts.filter(p => 
                        blogSearchQuery === "" ||
                        p.title.el.toLowerCase().includes(blogSearchQuery.toLowerCase()) ||
                        p.title.en.toLowerCase().includes(blogSearchQuery.toLowerCase()) ||
                        p.slug.toLowerCase().includes(blogSearchQuery.toLowerCase())
                      ).map(post => (
                        <tr key={post.slug} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{post.title[lang]}</div>
                            <div className="text-sm text-slate-500 line-clamp-1">{post.excerpt[lang]}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-sm font-mono">{post.slug}</td>
                          <td className="px-4 py-3 text-slate-600">{post.category[lang]}</td>
                          <td className="px-4 py-3 text-slate-600 text-sm">{post.date}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  // Load content if missing
                                  const postWithContent = await loadBlogPostContent(post);
                                  setSelectedBlogPost(postWithContent);
                                  setIsNewBlogPost(false);
                                  setShowBlogEditModal(true);
                                }}
                                className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              >
                                {txt.blog_edit}
                              </button>
                              <button
                                onClick={() => deleteBlogPost(post.slug)}
                                className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                {txt.blog_delete}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === "conversations" && (
            <div className="bg-white rounded-lg border border-slate-200">
              {loading ? (
                <div className="p-8 text-center text-slate-500">Loading conversations...</div>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No conversations yet</div>
              ) : (
                <div className="flex h-[600px]">
                  {/* Conversations List */}
                  <div className="w-80 border-r border-slate-200 overflow-y-auto">
                    {conversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv)}
                        className={`w-full text-left p-4 border-b border-slate-200 hover:bg-slate-50 transition-colors ${
                          selectedConversation?.id === conv.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                        }`}
                      >
                        <div className="font-semibold text-slate-900">{conv.influencer_name}</div>
                        <div className="text-xs text-slate-500 mt-1">↔ {conv.brand_name || conv.brand_email}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          {new Date(conv.last_message_at).toLocaleDateString('el-GR')}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-6">
                    {selectedConversation ? (
                      <>
                        <div className="mb-4 pb-4 border-b border-slate-200">
                          <h3 className="font-semibold text-slate-900">
                            {selectedConversation.influencer_name} ↔ {selectedConversation.brand_name || selectedConversation.brand_email}
                          </h3>
                          <div className="text-sm text-slate-500 mt-1">
                            Influencer: {selectedConversation.influencer_email} | Brand: {selectedConversation.brand_email}
                          </div>
                        </div>
                        <div className="space-y-4">
                          {conversationMessages.length === 0 ? (
                            <div className="text-center text-slate-500 py-8">Δεν υπάρχουν μηνύματα</div>
                          ) : (
                            conversationMessages.map((msg) => {
                              const isInfluencer = msg.sender_type === 'influencer';
                              return (
                                <div
                                  key={msg.id}
                                  className={`flex ${isInfluencer ? 'justify-start' : 'justify-end'}`}
                                >
                                  <div
                                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                                      isInfluencer
                                        ? 'bg-slate-100 text-slate-900 border border-slate-200'
                                        : 'bg-blue-600 text-white'
                                    }`}
                                  >
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className={`text-xs ${isInfluencer ? 'text-slate-500' : 'text-blue-100'}`}>
                                        {new Date(msg.created_at).toLocaleString('el-GR')}
                                      </p>
                                      {msg.sent_via_email && (
                                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                                          📧 Email
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-500">
                        Επέλεξε μια συνομιλία για να δεις τα μηνύματα
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showEditModal && selectedUser && (
        <EditProfileModal
          user={selectedUser}
          onClose={() => setShowEditModal(false)}
          onSave={handleUserUpdate}
        />
      )}

      {/* Blog Post Edit Modal */}
      {showBlogEditModal && selectedBlogPost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[95vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {isNewBlogPost ? (lang === 'el' ? 'Νέο Άρθρο' : 'New Article') : (lang === 'el' ? 'Επεξεργασία Άρθρου' : 'Edit Article')}
              </h2>
              <button
                onClick={() => {
                  setShowBlogEditModal(false);
                  setSelectedBlogPost(null);
                  setIsNewBlogPost(false);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (selectedBlogPost) {
                  saveBlogPost(selectedBlogPost);
                }
              }}
              className="p-6 space-y-6"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Slug' : 'Slug'}</label>
                  <input
                    type="text"
                    value={selectedBlogPost.slug}
                    onChange={(e) => setSelectedBlogPost({...selectedBlogPost, slug: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Ημερομηνία' : 'Date'}</label>
                  <input
                    type="date"
                    value={selectedBlogPost.date}
                    onChange={(e) => setSelectedBlogPost({...selectedBlogPost, date: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Τίτλος (Ελληνικά)' : 'Title (Greek)'}</label>
                <input
                  type="text"
                  value={selectedBlogPost.title.el}
                  onChange={(e) => setSelectedBlogPost({...selectedBlogPost, title: {...selectedBlogPost.title, el: e.target.value}})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Τίτλος (Αγγλικά)' : 'Title (English)'}</label>
                <input
                  type="text"
                  value={selectedBlogPost.title.en}
                  onChange={(e) => setSelectedBlogPost({...selectedBlogPost, title: {...selectedBlogPost.title, en: e.target.value}})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Περίληψη (Ελληνικά)' : 'Excerpt (Greek)'}</label>
                <textarea
                  value={selectedBlogPost.excerpt.el}
                  onChange={(e) => setSelectedBlogPost({...selectedBlogPost, excerpt: {...selectedBlogPost.excerpt, el: e.target.value}})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Περίληψη (Αγγλικά)' : 'Excerpt (English)'}</label>
                <textarea
                  value={selectedBlogPost.excerpt.en}
                  onChange={(e) => setSelectedBlogPost({...selectedBlogPost, excerpt: {...selectedBlogPost.excerpt, en: e.target.value}})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  rows={3}
                  required
                />
              </div>

              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">{lang === 'el' ? 'Περιεχόμενο Άρθρου' : 'Article Content'}</h3>
                <p className="text-sm text-slate-600 mb-4">{lang === 'el' ? 'Χρησιμοποιήστε Markdown format. Π.χ. # για headers, ** για bold, - για lists κτλ.' : 'Use Markdown format. E.g. # for headers, ** for bold, - for lists etc.'}</p>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Περιεχόμενο (Ελληνικά)' : 'Content (Greek)'}</label>
                  <textarea
                    value={selectedBlogPost.content?.el || ''}
                    onChange={(e) => setSelectedBlogPost({
                      ...selectedBlogPost, 
                      content: {
                        el: e.target.value,
                        en: selectedBlogPost.content?.en || ''
                      }
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm"
                    rows={20}
                    placeholder={lang === 'el' ? '# Τίτλος\n\nΠεριεχόμενο άρθρου σε Markdown format...' : '# Title\n\nArticle content in Markdown format...'}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedBlogPost.content?.el?.split('\n').length || 0} {lang === 'el' ? 'γραμμές' : 'lines'}
                  </p>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Περιεχόμενο (Αγγλικά)' : 'Content (English)'}</label>
                  <textarea
                    value={selectedBlogPost.content?.en || ''}
                    onChange={(e) => setSelectedBlogPost({
                      ...selectedBlogPost, 
                      content: {
                        el: selectedBlogPost.content?.el || '',
                        en: e.target.value
                      }
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm"
                    rows={20}
                    placeholder={lang === 'el' ? '# Title\n\nArticle content in Markdown format...' : '# Title\n\nArticle content in Markdown format...'}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedBlogPost.content?.en?.split('\n').length || 0} {lang === 'el' ? 'γραμμές' : 'lines'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Κατηγορία (Ελληνικά)' : 'Category (Greek)'}</label>
                  <input
                    type="text"
                    value={selectedBlogPost.category.el}
                    onChange={(e) => setSelectedBlogPost({...selectedBlogPost, category: {...selectedBlogPost.category, el: e.target.value}})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Κατηγορία (Αγγλικά)' : 'Category (English)'}</label>
                  <input
                    type="text"
                    value={selectedBlogPost.category.en}
                    onChange={(e) => setSelectedBlogPost({...selectedBlogPost, category: {...selectedBlogPost.category, en: e.target.value}})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Χρόνος Ανάγνωσης (Ελληνικά)' : 'Read Time (Greek)'}</label>
                  <input
                    type="text"
                    value={selectedBlogPost.readTime.el}
                    onChange={(e) => setSelectedBlogPost({...selectedBlogPost, readTime: {...selectedBlogPost.readTime, el: e.target.value}})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="8 λεπτά"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Χρόνος Ανάγνωσης (Αγγλικά)' : 'Read Time (English)'}</label>
                  <input
                    type="text"
                    value={selectedBlogPost.readTime.en}
                    onChange={(e) => setSelectedBlogPost({...selectedBlogPost, readTime: {...selectedBlogPost.readTime, en: e.target.value}})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="8 min"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'URL Εικόνας' : 'Image URL'}</label>
                <input
                  type="url"
                  value={selectedBlogPost.image}
                  onChange={(e) => setSelectedBlogPost({...selectedBlogPost, image: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              {selectedBlogPost.image && (
                <div>
                  <img src={selectedBlogPost.image} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowBlogEditModal(false);
                    setSelectedBlogPost(null);
                    setIsNewBlogPost(false);
                  }}
                  className="px-6 py-2 text-slate-900 hover:bg-slate-100 rounded-lg font-semibold transition-colors border border-slate-300"
                >
                  {lang === 'el' ? 'Ακύρωση' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  {lang === 'el' ? 'Αποθήκευση' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
