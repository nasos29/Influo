"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient"; 
import Image from "next/image";
import { isDefinitelyVideo, isDefinitelyImage, detectProvider, getIframelyEmbedUrl } from "@/lib/videoThumbnail";
import VideoThumbnail from "./VideoThumbnail";
import SocialEmbedCard from "./SocialEmbedCard";
import { getStoredLanguage, setStoredLanguage } from "@/lib/language";
import { displayNameForLang } from "@/lib/greeklish";
import { categoryTranslations } from "@/components/categoryTranslations";
import { fetchInstagramFromAuditpr, fetchTiktokFromAuditpr } from "@/lib/socialRefresh";

// --- FULL CATEGORY LIST ---
const CATEGORIES = [
  "Γενικά", "Lifestyle", "Fashion & Style", "Beauty & Makeup", "Travel", "Food & Drink",
  "Health & Fitness", "Tech & Gadgets", "Business & Finance", "Gaming & Esports",
  "Parenting & Family", "Home & Decor", "Pets & Animals", "Comedy & Entertainment",
  "Art & Photography", "Music & Dance", "Education & Coaching", "Sports & Athletes",
  "DIY & Crafts", "Sustainability & Eco", "Cars & Automotive"
];

// --- LANGUAGES LIST ---
const LANGUAGES = [
  { code: "el", el: "Ελληνικά", en: "Greek" },
  { code: "en", el: "Αγγλικά", en: "English" },
  { code: "de", el: "Γερμανικά", en: "German" },
  { code: "fr", el: "Γαλλικά", en: "French" },
  { code: "es", el: "Ισπανικά", en: "Spanish" },
  { code: "it", el: "Ιταλικά", en: "Italian" },
  { code: "pt", el: "Πορτογαλικά", en: "Portuguese" },
  { code: "ru", el: "Ρωσικά", en: "Russian" },
  { code: "zh", el: "Κινεζικά", en: "Chinese" },
  { code: "ja", el: "Ιαπωνικά", en: "Japanese" },
  { code: "sq", el: "Αλβανικά", en: "Albanian" }
];

interface DbInfluencer {
  id: number;
  auth_user_id?: string | null; // UUID from auth.users(id) for announcements targeting
  created_at: string;
  display_name: string;
  gender: string;
  contact_email: string;
  verified: boolean;
  approved?: boolean;
  analytics_verified?: boolean;
  accounts: { platform: string; username: string; followers: string }[] | null; 
  avatar_url: string | null;
  avg_likes: string | null; 
  location: string | null;
  followers_count: string | null; 
  insights_urls: string[] | null; 
  videos: string[] | null;
  video_thumbnails?: Record<string, string> | null; // JSONB mapping video URL -> thumbnail URL
  min_rate: string | null;
  languages: string | null;
  bio: string | null;
  bio_en: string | null; // English bio translation
  engagement_rate: string | null;
  audience_male_percent: number | null;
  audience_female_percent: number | null;
  audience_top_age: string | null;
  category?: string;
  birth_date?: string | null;
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
    btn_unapprove: "Ακύρωση Έγκρισης",
    btn_verify_analytics: "Επαλήθευση Analytics",
    btn_unverify_analytics: "Ακύρωση Επαλήθευσης Analytics",
    btn_unverify: "Ανάκληση",
    approved: "Εγκεκριμένος",
    analytics_verified: "Επαληθευμένα Analytics",
    btn_delete: "Διαγραφή",
    cleanup_test: "Cleanup Test Users",
    migrate_languages: "Μετατροπή Γλωσσών",
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
    blog_actions: "Ενέργειες",
    tab_announcements: "Ανακοινώσεις",
    ann_title: "Τίτλος",
    ann_body: "Κείμενο",
    ann_to_all: "Όλοι οι influencers",
    ann_to_one: "Συγκεκριμένος influencer",
    ann_send: "Αποστολή ανακοινώσεως",
    ann_sent: "Απεστάλη",
    refresh_social: "Ανανέωση",
    refresh_social_all: "Ανανέωση social stats για όλους",
    backfill_audit: "Backfill Gemini audit (μία φορά για όλους)"
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
    btn_unapprove: "Unapprove",
    btn_verify_analytics: "Verify Analytics",
    btn_unverify_analytics: "Unverify Analytics",
    btn_unverify: "Unverify",
    approved: "Approved",
    analytics_verified: "Analytics Verified",
    btn_delete: "Delete",
    cleanup_test: "Cleanup Test Users",
    migrate_languages: "Migrate Languages",
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
    blog_actions: "Actions",
    tab_announcements: "Announcements",
    ann_title: "Title",
    ann_body: "Content",
    ann_to_all: "All influencers",
    ann_to_one: "Specific influencer",
    ann_send: "Send announcement",
    ann_sent: "Sent",
    refresh_social: "Refresh",
    refresh_social_all: "Refresh social stats for all",
    backfill_audit: "Backfill Gemini audit (once for all)"
  }
};

// Edit Brand Modal Component
const EditBrandModal = ({ brand, onClose, onSave, lang }: { brand: Brand, onClose: () => void, onSave: (updatedBrand: Partial<Brand>) => Promise<void>, lang: "el" | "en" }) => {
  const [brandName, setBrandName] = useState(brand.brand_name || '');
  const [contactPerson, setContactPerson] = useState(brand.contact_person || '');
  const [website, setWebsite] = useState(brand.website || '');
  const [industry, setIndustry] = useState(brand.industry || '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(brand.logo_url || null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    let logoUrl = brand.logo_url || null;
    
    // Upload new logo if selected
    if (logoFile) {
      setUploadingLogo(true);
      try {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `brand-${brand.id}-${Date.now()}.${fileExt}`;
        const filePath = fileName;

        // Delete old logo if exists
        if (brand.logo_url) {
          try {
            const urlParts = brand.logo_url.split('/');
            const oldFileName = urlParts[urlParts.length - 1];
            if (oldFileName.startsWith('brand-')) {
              await supabase.storage.from('avatars').remove([oldFileName]);
            }
          } catch (deleteErr) {
            console.warn('Could not delete old logo:', deleteErr);
          }
        }

        // Upload new logo to avatars bucket
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, logoFile, { 
            cacheControl: '3600',
            upsert: false 
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        logoUrl = publicUrl;
      } catch (err: any) {
        console.error('Error uploading logo:', err);
        alert(lang === 'el' ? `Σφάλμα κατά το ανέβασμα λογοτύπου: ${err.message}` : `Error uploading logo: ${err.message}`);
        setUploadingLogo(false);
        setSaving(false);
        return;
      } finally {
        setUploadingLogo(false);
      }
    } else if (!logoPreview && brand.logo_url) {
      // Remove logo if preview was cleared
      try {
        const urlParts = brand.logo_url.split('/');
        const oldFileName = urlParts[urlParts.length - 1];
        if (oldFileName.startsWith('brand-')) {
          await supabase.storage.from('avatars').remove([oldFileName]);
        }
        logoUrl = null;
      } catch (err) {
        console.error('Error removing logo:', err);
      }
    }

    await onSave({
      brand_name: brandName.trim(),
      contact_person: contactPerson.trim() || null,
      website: website.trim() || null,
      industry: industry.trim() || null,
      logo_url: logoUrl,
    });
    
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{lang === 'el' ? 'Επεξεργασία Επιχείρησης' : 'Edit Company'}</h2>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Brand Name */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              {lang === 'el' ? 'Όνομα Επιχείρησης' : 'Company Name'} *
            </label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          {/* Contact Person */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              {lang === 'el' ? 'Υπεύθυνος Επικοινωνίας' : 'Contact Person'}
            </label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="w-full px-4 py-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              {lang === 'el' ? 'Email' : 'Email'}
            </label>
            <input
              type="email"
              value={brand.contact_email || ''}
              disabled
              className="w-full px-4 py-3 bg-slate-100 text-slate-600 border-2 border-slate-200 rounded-xl cursor-not-allowed"
            />
          </div>

          {/* Industry/Category */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              {lang === 'el' ? 'Κλάδος' : 'Industry'}
            </label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full px-4 py-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              {lang === 'el' ? 'Ιστοσελίδα' : 'Website'}
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          {/* Logo */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              {lang === 'el' ? 'Λογότυπο' : 'Logo'}
            </label>
            {logoPreview && (
              <div className="mb-4 relative inline-block">
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="w-32 h-32 object-contain border-2 border-slate-200 rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="w-full px-4 py-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
            >
              {lang === 'el' ? 'Ακύρωση' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving || uploadingLogo}
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving || uploadingLogo 
                ? (lang === 'el' ? 'Αποθήκευση...' : 'Saving...')
                : (lang === 'el' ? 'Αποθήκευση' : 'Save')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditProfileModal = ({ user, onClose, onSave }: { user: DbInfluencer, onClose: () => void, onSave: (updatedUser: DbInfluencer) => void }) => {
    const [name, setName] = useState(user.display_name);
    const [bio, setBio] = useState(user.bio || "");
    const [bioEn, setBioEn] = useState(user.bio_en || "");
    const [minRate, setMinRate] = useState(user.min_rate || "");
    const [location, setLocation] = useState(user.location || "");
    const [birthDate, setBirthDate] = useState(user.birth_date || "");
    // Ensure gender is valid (Female, Male, or Other)
    const initialGender = (user.gender === 'Female' || user.gender === 'Male' || user.gender === 'Other') ? user.gender : 'Female';
    const [gender, setGender] = useState(initialGender);
    const [profileChanges, setProfileChanges] = useState<any[]>([]);
    const [loadingChanges, setLoadingChanges] = useState(false);
    // Support multiple categories - parse comma-separated string or use single category
    const initialCategories = user.category 
        ? (user.category.includes(',') ? user.category.split(',').map(c => c.trim()) : [user.category])
        : ["Lifestyle"];
    const [categories, setCategories] = useState<string[]>(initialCategories);
    // Parse languages from comma-separated string to array of language codes
    const parseLanguages = (langString: string | null): string[] => {
        if (!langString) return [];
        const langArray = langString.split(',').map(l => l.trim().toLowerCase());
        const codes: string[] = [];
        langArray.forEach(lang => {
            const foundLang = LANGUAGES.find(l => l.code === lang || l.el.toLowerCase() === lang || l.en.toLowerCase() === lang);
            if (foundLang) {
                codes.push(foundLang.code);
            } else {
                const partialMatch = LANGUAGES.find(l => 
                    l.el.toLowerCase().includes(lang) || 
                    l.en.toLowerCase().includes(lang) ||
                    lang.includes(l.el.toLowerCase()) ||
                    lang.includes(l.en.toLowerCase())
                );
                if (partialMatch) {
                    codes.push(partialMatch.code);
                }
            }
        });
        return codes;
    };
    const initialLanguages = parseLanguages(user.languages);
    const [selectedLanguages, setSelectedLanguages] = useState<string[]>(initialLanguages);
    const [accounts, setAccounts] = useState<{ platform: string; username: string; followers: string; engagement_rate?: string; avg_likes?: string }[]>(
        user.accounts && Array.isArray(user.accounts) && user.accounts.length > 0
            ? user.accounts.map((acc: any) => ({ ...acc, engagement_rate: acc.engagement_rate || "", avg_likes: acc.avg_likes || "" }))
            : [{ platform: "Instagram", username: "", followers: "", engagement_rate: "", avg_likes: "" }]
    );
    const [videos, setVideos] = useState<string[]>(Array.isArray(user.videos) ? user.videos : []);
    const [videoThumbnails, setVideoThumbnails] = useState<Record<string, string | { url: string; width?: number; height?: number; type?: string }>>(user.video_thumbnails || {});
    const [thumbnailFiles, setThumbnailFiles] = useState<Record<string, File | null>>({}); // Store files to upload
    const [thumbnailPreviews, setThumbnailPreviews] = useState<Record<string, string>>({}); // Preview URLs
    const [fetchingThumbnails, setFetchingThumbnails] = useState<Record<string, boolean>>({}); // Track fetching state
    const [malePercent, setMalePercent] = useState(user.audience_male_percent?.toString() || "");
    const [femalePercent, setFemalePercent] = useState(user.audience_female_percent?.toString() || "");
    const [topAge, setTopAge] = useState(user.audience_top_age || "");
    const [loading, setLoading] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar_url || null);

    const handleAccountChange = (i: number, field: keyof typeof accounts[0], value: string) => {
        const copy = [...accounts]; 
        copy[i][field] = value; 
        setAccounts(copy);
    };
    const addAccount = () => setAccounts([...accounts, { platform: "Instagram", username: "", followers: "", engagement_rate: "", avg_likes: "" }]);
    const removeAccount = (i: number) => { 
        const copy = [...accounts]; 
        copy.splice(i, 1); 
        setAccounts(copy); 
    };

    const handleVideoChange = (i: number, value: string) => {
        const copy = [...videos];
        const oldUrl = copy[i];
        copy[i] = value;
        setVideos(copy);
        
        // If video URL changed, preserve thumbnail if URL is the same, otherwise remove it
        if (oldUrl && oldUrl !== value && videoThumbnails[oldUrl]) {
            const newThumbnails = { ...videoThumbnails };
            delete newThumbnails[oldUrl];
            if (videoThumbnails[value]) {
                // Keep existing thumbnail if new URL already has one
                setVideoThumbnails({ ...newThumbnails, [value]: videoThumbnails[value] });
            } else {
                setVideoThumbnails(newThumbnails);
            }
        }
    };
    
    const handleThumbnailChange = (videoUrl: string, thumbnailUrl: string) => {
        setVideoThumbnails({ ...videoThumbnails, [videoUrl]: thumbnailUrl });
        // Clear file if URL is set
        if (thumbnailUrl) {
            setThumbnailFiles({ ...thumbnailFiles, [videoUrl]: null });
            setThumbnailPreviews({ ...thumbnailPreviews, [videoUrl]: thumbnailUrl });
        }
    };
    
    const handleFetchFromIframely = async (videoUrl: string) => {
        if (!videoUrl) return;
        
        setFetchingThumbnails({ ...fetchingThumbnails, [videoUrl]: true });
        
        try {
            const response = await fetch('/api/video-thumbnail/cache', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    videoUrl, 
                    influencerId: user.id 
                })
            });
            
            const data = await response.json();
            
            if (data.success && data.thumbnail) {
                // Store the metadata object (with url, width, height, type)
                setVideoThumbnails({ ...videoThumbnails, [videoUrl]: data.thumbnail });
                setThumbnailPreviews({ ...thumbnailPreviews, [videoUrl]: data.thumbnail.url });
                
                // Clear file upload if we got data from Iframely
                setThumbnailFiles({ ...thumbnailFiles, [videoUrl]: null });
            } else {
                alert(data.error || 'Failed to fetch thumbnail from Iframely');
            }
        } catch (error: any) {
            console.error('Error fetching from Iframely:', error);
            alert('Error: ' + (error.message || 'Failed to fetch thumbnail'));
        } finally {
            setFetchingThumbnails({ ...fetchingThumbnails, [videoUrl]: false });
        }
    };
    
    const handleThumbnailFileChange = (videoUrl: string, file: File | null) => {
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                alert('Μόνο αρχεία εικόνας επιτρέπονται (JPG, PNG, etc.)');
                return;
            }
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('Το αρχείο είναι πολύ μεγάλο. Μέγιστο μέγεθος: 5MB');
                return;
            }
            
            setThumbnailFiles({ ...thumbnailFiles, [videoUrl]: file });
            
            // Create preview
            const previewUrl = URL.createObjectURL(file);
            setThumbnailPreviews({ ...thumbnailPreviews, [videoUrl]: previewUrl });
            
            // Clear URL input if file is selected
            setVideoThumbnails({ ...videoThumbnails, [videoUrl]: '' });
        } else {
            setThumbnailFiles({ ...thumbnailFiles, [videoUrl]: null });
            const newPreviews = { ...thumbnailPreviews };
            delete newPreviews[videoUrl];
            setThumbnailPreviews(newPreviews);
        }
    };
    
    const removeThumbnail = (videoUrl: string) => {
        const newThumbnails = { ...videoThumbnails };
        delete newThumbnails[videoUrl];
        setVideoThumbnails(newThumbnails);
        
        const newFiles = { ...thumbnailFiles };
        delete newFiles[videoUrl];
        setThumbnailFiles(newFiles);
        
        const newPreviews = { ...thumbnailPreviews };
        if (newPreviews[videoUrl] && newPreviews[videoUrl].startsWith('blob:')) {
            URL.revokeObjectURL(newPreviews[videoUrl]);
        }
        delete newPreviews[videoUrl];
        setThumbnailPreviews(newPreviews);
    };

    // Fetch profile changes when modal opens
    useEffect(() => {
        const fetchChanges = async () => {
            setLoadingChanges(true);
            try {
                // Convert user.id to string (Supabase returns UUID as string, but TypeScript might think it's number)
                const influencerId = String(user.id);
                console.log('[Profile Changes] Fetching changes for influencer ID:', influencerId, '(type:', typeof user.id, ')');
                
                const response = await fetch(`/api/profile-changes?influencerId=${encodeURIComponent(influencerId)}&unreviewedOnly=true`);
                
                if (!response.ok) {
                    console.error('[Profile Changes] HTTP error:', response.status, response.statusText);
                    const errorText = await response.text();
                    console.error('[Profile Changes] Error response:', errorText);
                    setLoadingChanges(false);
                    return;
                }
                
                const data = await response.json();
                console.log('[Profile Changes] API Response:', data);
                
                if (data.success) {
                    const changes = data.data || [];
                    setProfileChanges(changes);
                    console.log('[Profile Changes] ✅ Found', changes.length, 'unreviewed changes');
                    if (changes.length === 0) {
                        console.log('[Profile Changes] ℹ️ No unreviewed changes found for this influencer');
                    }
                } else {
                    console.error('[Profile Changes] ❌ API error:', data.error);
                }
            } catch (error) {
                console.error('[Profile Changes] ❌ Exception:', error);
            } finally {
                setLoadingChanges(false);
            }
        };
        fetchChanges();
    }, [user.id]);

    // Mark changes as reviewed
    const markChangesAsReviewed = async (changeIds: string[]) => {
        try {
            const response = await fetch('/api/profile-changes', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ changeIds })
            });
            const data = await response.json();
            if (data.success) {
                // Remove reviewed changes from state
                setProfileChanges(prev => prev.filter(c => !changeIds.includes(c.id)));
            }
        } catch (error) {
            console.error('Error marking changes as reviewed:', error);
        }
    };

    // Helper function to format field values for display
    const formatFieldValue = (field: string, value: any): string => {
        if (value === null || value === undefined) return '(κενό)';
        if (field === 'accounts' || field === 'videos') {
            return Array.isArray(value) ? JSON.stringify(value, null, 2) : String(value);
        }
        return String(value);
    };

    // Helper function to get field label
    const getFieldLabel = (field: string): string => {
        const labels: Record<string, string> = {
            display_name: 'Όνομα',
            bio: 'Βιογραφικό',
            min_rate: 'Ελάχιστη Χρέωση',
            location: 'Τοποθεσία',
            engagement_rate: 'Engagement Rate',
            avg_likes: 'Μέσος Όρος Likes',
            category: 'Κατηγορία',
            languages: 'Γλώσσες',
            gender: 'Φύλο',
            accounts: 'Social Media Accounts',
            videos: 'Videos',
            avatar_url: 'Avatar',
            audience_male_percent: 'Άνδρες %',
            audience_female_percent: 'Γυναίκες %',
            audience_top_age: 'Κύρια Ηλικιακή Ομάδα',
            birth_date: 'Ημερομηνία Γέννησης'
        };
        return labels[field] || field;
    };
    
    const addVideo = () => setVideos([...videos, ""]);
    const removeVideo = (i: number) => { 
        const videoUrl = videos[i];
        const copy = [...videos]; 
        copy.splice(i, 1);
        setVideos(copy);
        
        // Remove thumbnail for deleted video
        if (videoUrl && videoThumbnails[videoUrl]) {
            const newThumbnails = { ...videoThumbnails };
            delete newThumbnails[videoUrl];
            setVideoThumbnails(newThumbnails);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let avatarUrl = user.avatar_url || null;

            // Upload avatar if new file selected
            if (avatarFile) {
                const fileName = `avatar-${Date.now()}-${avatarFile.name}`;
                const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, avatarFile);
                
                if (uploadError) {
                    throw uploadError;
                }
                
                const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
                avatarUrl = data.publicUrl;
            }

            // Upload thumbnail files and get their URLs
            const uploadedThumbnails = { ...videoThumbnails };
            for (const [videoUrl, file] of Object.entries(thumbnailFiles)) {
                if (file && videoUrl) {
                    try {
                        const fileName = `thumbnails/${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                        const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, file, {
                            cacheControl: '3600',
                            upsert: false
                        });
                        
                        if (uploadError) {
                            console.error(`Error uploading thumbnail for ${videoUrl}:`, uploadError);
                            // Continue with other uploads
                        } else {
                            const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
                            uploadedThumbnails[videoUrl] = data.publicUrl;
                        }
                    } catch (err) {
                        console.error(`Error uploading thumbnail for ${videoUrl}:`, err);
                    }
                }
            }
            
            // Clean up preview URLs
            Object.values(thumbnailPreviews).forEach(preview => {
                if (preview.startsWith('blob:')) {
                    URL.revokeObjectURL(preview);
                }
            });

            // Store categories as comma-separated string for backward compatibility
            const categoryString = categories.length > 0 ? categories.join(',') : "Lifestyle";
            
            const updateData: any = {
                display_name: name, 
                bio: bio, 
                bio_en: bioEn || null, // Store English bio
                min_rate: minRate,
                location: location,
                birth_date: birthDate || null,
                gender: gender,
                category: categoryString,
                languages: selectedLanguages.map(code => {
                    const lang = LANGUAGES.find(l => l.code === code);
                    return lang ? lang.el : code;
                }).join(", "), // Store as comma-separated string with Greek names
                accounts: (accounts || []).filter((acc: { platform?: string }) => (acc.platform || '').toLowerCase() !== 'facebook'),
                videos: videos.filter(v => v !== ""),
                video_thumbnails: uploadedThumbnails,
                audience_male_percent: parseInt(malePercent) || 0,
                audience_female_percent: parseInt(femalePercent) || 0,
                audience_top_age: topAge,
            };

            // Only update avatar_url if we have a new URL
            if (avatarUrl) {
                updateData.avatar_url = avatarUrl;
            }

            const { data, error } = await supabase
                .from('influencers')
                .update(updateData)
                .eq('id', user.id)
                .select()
                .single();

        setLoading(false);

        if (error) {
            alert("Error saving: " + error.message);
        } else if (data) {
            // Refresh Gemini audit only when metrics or audit-relevant fields changed (followers, engagement_rate, avg_likes, bio, category)
            const prevAccounts = (user.accounts ?? []) as { followers?: string; engagement_rate?: string; avg_likes?: string }[];
            const metricsChanged =
              prevAccounts.length !== (accounts?.length ?? 0) ||
              (accounts ?? []).some(
                (b: { followers?: string; engagement_rate?: string; avg_likes?: string }, i: number) => {
                  const a = prevAccounts[i];
                  if (!a) return true;
                  return (a.followers ?? '') !== (b.followers ?? '') || (a.engagement_rate ?? '') !== (b.engagement_rate ?? '') || (a.avg_likes ?? '') !== (b.avg_likes ?? '');
                }
              );
            const bioOrCategoryChanged =
              (user.bio ?? '') !== (bio ?? '') ||
              (user.category ?? '') !== (categoryString ?? '');
            if (metricsChanged || bioOrCategoryChanged) {
              try {
                const auditRes = await fetch('/api/admin/refresh-audit', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ influencerId: user.id }),
                });
                const ct = auditRes.headers.get('content-type') ?? '';
                if (auditRes.ok && ct.includes('application/json')) {
                  const auditData = await auditRes.json();
                  if (auditData.auditpr_audit) {
                    (data as Record<string, unknown>).auditpr_audit = auditData.auditpr_audit;
                  }
                }
              } catch (_) {
                // Gemini unreachable – profile save still succeeded
              }
            }
            onSave(data as DbInfluencer);
            onClose();
        }
        } catch (err: any) {
            setLoading(false);
            alert("Error saving: " + err.message);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-900">Edit Profile - {user.display_name}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                
                {/* Debug Info - Remove in production */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="px-6 py-2 bg-blue-50 border-b border-blue-200 text-xs">
                        <p><strong>Debug:</strong> User ID: {user.id} (type: {typeof user.id})</p>
                        <p>Loading: {loadingChanges ? 'Yes' : 'No'}, Changes: {profileChanges.length}</p>
                    </div>
                )}
                
                {/* Profile Changes Section */}
                {loadingChanges ? (
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                        <p className="text-sm text-slate-600">Φόρτωση αλλαγών...</p>
                    </div>
                ) : profileChanges.length > 0 ? (
                    <div className="px-6 py-4 bg-yellow-50 border-b border-yellow-200">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-yellow-900 flex items-center gap-2">
                                ⚠️ Αλλαγές που Αναμένουν Επανεξέταση ({profileChanges.length})
                            </h3>
                            <button
                                type="button"
                                onClick={() => markChangesAsReviewed(profileChanges.map(c => c.id))}
                                className="px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                            >
                                Σημάνω ως Εξετασμένα
                            </button>
                        </div>
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                            {profileChanges.map((change, idx) => (
                                <div key={change.id} className="bg-white border border-yellow-300 rounded-lg p-3">
                                    <div className="text-xs text-yellow-700 mb-2">
                                        <strong>Ημερομηνία:</strong> {new Date(change.created_at).toLocaleString('el-GR')}
                                    </div>
                                    <div className="space-y-2">
                                        {change.changed_fields && change.changed_fields.map((field: string) => (
                                            <div key={field} className="border-l-4 border-yellow-500 pl-3 py-1">
                                                <div className="text-xs font-semibold text-slate-900 mb-1">
                                                    {getFieldLabel(field)}
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div>
                                                        <div className="text-slate-600 font-medium mb-1">Παλιά Τιμή:</div>
                                                        <div className="bg-red-50 border border-red-200 rounded p-2 text-slate-900 break-words max-h-32 overflow-y-auto">
                                                            {formatFieldValue(field, change.old_values?.[field])}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-slate-600 font-medium mb-1">Νέα Τιμή:</div>
                                                        <div className="bg-green-50 border border-green-200 rounded p-2 text-slate-900 break-words max-h-32 overflow-y-auto">
                                                            {formatFieldValue(field, change.new_values?.[field])}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
                
                <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-6">
                        {/* Avatar Upload */}
                        <div className="pb-4 border-b border-slate-200">
                            <label className="block text-sm font-semibold text-slate-900 mb-2">Φωτογραφία Προφίλ</label>
                            <div className="flex items-center gap-4">
                                <div className="relative w-20 h-20 rounded-full border-2 border-slate-300 overflow-hidden bg-slate-100">
                                    {avatarPreview ? (
                                        <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                            <span className="text-gray-500 text-xs font-medium">NO PHOTO</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                setAvatarFile(file);
                                                setAvatarPreview(URL.createObjectURL(file));
                                            }
                                        }}
                                        className="w-full text-sm text-slate-900"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">PNG, JPG, GIF up to 5MB</p>
                                </div>
                            </div>
                        </div>

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
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">Ημερομηνία Γέννησης</label>
                                    <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" />
                                    <p className="text-xs text-slate-500 mt-1">Η ηλικία υπολογίζεται από αυτή την ημερομηνία</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">Gender</label>
                                    <select value={gender} onChange={e => setGender(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900">
                                        <option value="Female">Female</option>
                                        <option value="Male">Male</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">Categories *</label>
                                    <p className="text-xs text-slate-500 mb-2">Select one or more categories</p>
                                    <div className="border-2 border-slate-200 rounded-lg p-3 bg-slate-50 max-h-48 overflow-y-auto">
                                        <div className="space-y-2">
                                            {CATEGORIES.map(cat => {
                                                const isSelected = categories.includes(cat);
                                                const displayName = categoryTranslations[cat]?.en || cat;
                                                
                                                return (
                                                    <label 
                                                        key={cat} 
                                                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all text-xs ${
                                                            isSelected 
                                                                ? 'bg-blue-100 border-2 border-blue-500' 
                                                                : 'bg-white border-2 border-slate-200 hover:border-blue-300'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={(e) => {
                                                                if (cat === "Γενικά" || cat === "General") {
                                                                    if (e.target.checked) {
                                                                        setCategories([cat]);
                                                                    } else {
                                                                        setCategories(["Lifestyle"]);
                                                                    }
                                                                } else {
                                                                    const newCats = e.target.checked
                                                                        ? [...categories.filter(c => c !== "Γενικά" && c !== "General"), cat]
                                                                        : categories.filter(c => c !== cat);
                                                                    
                                                                    if (newCats.length === 0) {
                                                                        setCategories(["Lifestyle"]);
                                                                    } else {
                                                                        setCategories(newCats);
                                                                    }
                                                                }
                                                            }}
                                                            className="w-4 h-4 text-blue-600 border-2 border-slate-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                        <span className={`font-medium ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                                                            {displayName}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    {categories.length > 0 && (
                                        <p className="text-xs text-slate-600 mt-2">
                                            Selected: {categories.map(c => categoryTranslations[c]?.en || c).join(', ')}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">Languages</label>
                                    <div className="border-2 border-slate-200 rounded-lg p-3 bg-slate-50">
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                            {LANGUAGES.map(langItem => {
                                                const isSelected = selectedLanguages.includes(langItem.code);
                                                return (
                                                    <label 
                                                        key={langItem.code} 
                                                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${
                                                            isSelected 
                                                                ? 'bg-blue-100 border-2 border-blue-500' 
                                                                : 'bg-white border-2 border-slate-200 hover:border-blue-300'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedLanguages([...selectedLanguages, langItem.code]);
                                                                } else {
                                                                    setSelectedLanguages(selectedLanguages.filter(l => l !== langItem.code));
                                                                }
                                                            }}
                                                            className="w-4 h-4 text-blue-600 border-2 border-slate-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                        <span className={`text-xs font-medium ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                                                            {langItem.en}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bio - Greek */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-1">Bio (Ελληνικά)</label>
                            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-slate-900" placeholder="Βιογραφία στα Ελληνικά..." />
                        </div>

                        {/* Bio - English */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-1">Bio (English / Αγγλικά)</label>
                            <textarea value={bioEn} onChange={e => setBioEn(e.target.value)} rows={4} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-slate-900" placeholder="Biography in English..." />
                            <p className="text-xs text-slate-500 mt-1">Αυτή η βιογραφία θα εμφανίζεται όταν ο χρήστης επιλέξει Αγγλικά ως γλώσσα</p>
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
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Engagement Rate (%)</label>
                                        <input type="text" value={account.engagement_rate || ""} onChange={e => handleAccountChange(i, 'engagement_rate', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" placeholder="e.g. 5.5%" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Avg Likes</label>
                                        <input type="text" value={account.avg_likes || ""} onChange={e => handleAccountChange(i, 'avg_likes', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" placeholder="e.g. 3.2k" />
                                    </div>
                                    <button type="button" onClick={() => removeAccount(i)} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">✕</button>
                                </div>
                            ))}
                            <button type="button" onClick={addAccount} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm">+ Add Account</button>
                        </div>

                        {/* Analytics */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase mb-3">Analytics</h3>
                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-1">Min Rate (€)</label>
                                <input type="text" value={minRate} onChange={e => setMinRate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
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
                                const isVideo = isDefinitelyVideo(video);
                                const isImage = isDefinitelyImage(video);
                                const isInstagramPost = video && /instagram\.com\/p\//i.test(video);
                                
                                // Helper to get thumbnail URL string from string or object
                                const getThumbnailUrl = (thumb: string | { url: string; width?: number; height?: number; type?: string } | undefined): string => {
                                    if (!thumb) return '';
                                    if (typeof thumb === 'string') return thumb;
                                    return thumb.url || '';
                                };
                                
                                const currentThumbnail = videoThumbnails[video];
                                const thumbnailUrlString = getThumbnailUrl(currentThumbnail);
                                
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
                                            <>
                                                {/* Thumbnail Input Section */}
                                                <div className="mt-3 p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
                                                    <label className="block text-xs font-semibold text-slate-700">
                                                        Thumbnail <span className="text-slate-400 font-normal">(Optional)</span>
                                                    </label>
                                                    
                                                    {/* Option 1: Fetch from Iframely */}
                                                    <div>
                                                        <label className="block text-xs text-slate-600 mb-1">Option 1: Fetch from Iframely (Auto)</label>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleFetchFromIframely(video)}
                                                            disabled={fetchingThumbnails[video] || !!thumbnailFiles[video] || !!thumbnailUrlString}
                                                            className="w-full px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors text-sm font-semibold"
                                                        >
                                                            {fetchingThumbnails[video] ? 'Fetching...' : '🔍 Fetch Thumbnail from Iframely'}
                                                        </button>
                                                    </div>
                                                    
                                                    {/* Option 2: URL Input */}
                                                    <div>
                                                        <label className="block text-xs text-slate-600 mb-1">Option 2: Thumbnail URL (Manual)</label>
                                                        <input 
                                                            type="url" 
                                                            value={thumbnailUrlString} 
                                                            onChange={e => handleThumbnailChange(video, e.target.value)} 
                                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 text-sm" 
                                                            placeholder="https://example.com/thumbnail.jpg" 
                                                            disabled={!!thumbnailFiles[video] || fetchingThumbnails[video]}
                                                        />
                                                    </div>
                                                    
                                                    {/* Option 3: File Upload */}
                                                    <div>
                                                        <label className="block text-xs text-slate-600 mb-1">Option 3: Upload Image (JPG, PNG, max 5MB)</label>
                                                        <input 
                                                            type="file" 
                                                            accept="image/jpeg,image/jpg,image/png,image/webp"
                                                            onChange={e => handleThumbnailFileChange(video, e.target.files?.[0] || null)}
                                                            className="w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer"
                                                            disabled={!!videoThumbnails[video]}
                                                        />
                                                    </div>
                                                    
                                                    {/* Preview */}
                                                    {(currentThumbnail || thumbnailPreviews[video]) && (
                                                        <div className="mt-2">
                                                            <img 
                                                                src={thumbnailPreviews[video] || thumbnailUrlString || ""} 
                                                                alt="Thumbnail preview"
                                                                className="max-w-full h-20 object-contain border border-slate-200 rounded"
                                                            />
                                                            {typeof currentThumbnail === 'object' && currentThumbnail && currentThumbnail.width && (
                                                                <p className="text-xs text-slate-500 mt-1">
                                                                    Size: {currentThumbnail.width}×{currentThumbnail.height}px
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Clear Button */}
                                                    {(videoThumbnails[video] || thumbnailFiles[video]) && (
                                                        <button 
                                                            type="button" 
                                                            onClick={() => removeThumbnail(video)}
                                                            className="w-full px-3 py-1.5 bg-slate-400 text-white rounded-lg hover:bg-slate-500 transition-colors text-sm"
                                                        >
                                                            Clear Thumbnail
                                                        </button>
                                                    )}
                                                </div>
                                                
                                                {/* Video/Photo Preview */}
                                                {(() => {
                                                    const provider = detectProvider(video);
                                                    const embedUrl = provider ? getIframelyEmbedUrl(video) : null;
                                                    const thumbnailUrl = thumbnailPreviews[video] || thumbnailUrlString || undefined;
                                                    
                                                    // Use SocialEmbedCard for social media videos
                                                    if (provider && embedUrl && !isImage) {
                                                        return (
                                                            <div className="mt-2 w-full max-w-lg">
                                                                <SocialEmbedCard
                                                                    provider={provider}
                                                                    embedUrl={embedUrl}
                                                                    thumbnailUrl={thumbnailUrl}
                                                                    originalUrl={video}
                                                                />
                                                            </div>
                                                        );
                                                    }
                                                    
                                                    // Use VideoThumbnail for images or non-social media URLs
                                                    return (
                                                <div className="mt-2 relative w-full h-32 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                                                    <VideoThumbnail 
                                                        url={video}
                                                                manualThumbnail={thumbnailUrl}
                                                        alt="Video/Photo thumbnail"
                                                        fill
                                                        className={isImage ? "object-contain" : "object-cover"}
                                                    />
                                                    {isVideo && !isInstagramPost && (
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                                                            <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                                                                <span className="text-xl text-slate-900 ml-1">▶</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                    );
                                                })()}
                                            </>
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
  const [lang, setLang] = useState<"el" | "en">("el"); // Default to Greek, will be updated in useEffect
  const txt = t[lang];

  // Load language from localStorage on client-side
  useEffect(() => {
    setLang(getStoredLanguage());
  }, []);

  const [activeTab, setActiveTab] = useState("influencers");
  const [users, setUsers] = useState<DbInfluencer[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandSearchQuery, setBrandSearchQuery] = useState("");
  const [updatingBrand, setUpdatingBrand] = useState<string | null>(null);
  const [deletingBrand, setDeletingBrand] = useState<string | null>(null);
  const [deletingConversation, setDeletingConversation] = useState<string | null>(null);
  const [deletingProposal, setDeletingProposal] = useState<number | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversationMessages, setConversationMessages] = useState<Message[]>([]);
  const [showConversationsDrawer, setShowConversationsDrawer] = useState(false); // Mobile: toggle conversations drawer
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
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [showBrandEditModal, setShowBrandEditModal] = useState(false);

  const [stats, setStats] = useState<{
    total: number;
    pending: number;
    verified: number;
    approved?: number;
    analyticsVerified?: number;
    reach: string;
    pipeline: string;
  }>({ 
    total: 0, 
    pending: 0, 
    verified: 0,
    approved: 0,
    analyticsVerified: 0,
    reach: "0",
    pipeline: "0€"
  });
  const [pendingProposalsCount, setPendingProposalsCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [brokenThumbnails, setBrokenThumbnails] = useState<Array<{ influencerId: number; influencerName: string; videoUrl: string; thumbnailUrl: string; reason: string }>>([]);
  const [checkingThumbnails, setCheckingThumbnails] = useState(false);
  const [refreshingSocialFor, setRefreshingSocialFor] = useState<string | null>(null);
  const [refreshingSocialAll, setRefreshingSocialAll] = useState(false);
  const [backfillingAudit, setBackfillingAudit] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<string | null>(null);

  // Announcements (admin)
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementTargetType, setAnnouncementTargetType] = useState<"all" | "specific">("all");
  const [announcementTargetInfluencerId, setAnnouncementTargetInfluencerId] = useState<string>("");
  const [announcementsList, setAnnouncementsList] = useState<Array<{ id: string; title: string; body: string; created_at: string; target_type: string; target_influencer_id: string | null }>>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementSending, setAnnouncementSending] = useState(false);

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
      // Use API route with service role key to bypass RLS
      const response = await fetch('/api/admin/brands');
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        console.error('Error fetching brands:', result.error || result.details);
        setBrands([]);
        return;
      }
      
      if (result.brands) {
        console.log(`[Admin Dashboard] Fetched ${result.brands.length} brands`);
        setBrands(result.brands);
      } else {
        setBrands([]);
      }
    } catch (error: any) {
      console.error('Error fetching brands:', error);
      setBrands([]);
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

  const fetchAnnouncements = async () => {
    setAnnouncementsLoading(true);
    try {
      const res = await fetch('/api/admin/announcements');
      const data = await res.json();
      if (res.ok && Array.isArray(data.data)) {
        setAnnouncementsList(data.data);
      } else {
        setAnnouncementsList([]);
      }
    } catch (e) {
      console.error('Error fetching announcements:', e);
      setAnnouncementsList([]);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  const sendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementBody.trim()) return;
    if (announcementTargetType === 'specific' && !announcementTargetInfluencerId) {
      alert(lang === 'el' ? 'Επιλέξτε influencer για στόχευση.' : 'Select an influencer to target.');
      return;
    }
    setAnnouncementSending(true);
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: announcementTitle.trim(),
          content: announcementBody.trim(),
          target_type: announcementTargetType,
          target_influencer_id: announcementTargetType === 'specific' ? announcementTargetInfluencerId : undefined,
        }),
      });
      const result = await res.json();
      if (res.ok && result.data) {
        setAnnouncementTitle('');
        setAnnouncementBody('');
        setAnnouncementTargetInfluencerId('');
        setAnnouncementsList(prev => [result.data, ...prev]);
        alert(txt.ann_sent);
      } else {
        alert(result.error || (lang === 'el' ? 'Σφάλμα αποστολής' : 'Send failed'));
      }
    } catch (err: any) {
      console.error('Send announcement error:', err);
      alert(err.message || (lang === 'el' ? 'Σφάλμα αποστολής' : 'Send failed'));
    } finally {
      setAnnouncementSending(false);
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

    // First, try to get the post from localStorage which should have content if it was saved before
    try {
      const stored = localStorage.getItem('blogPosts');
      if (stored) {
        const allPosts: BlogPost[] = JSON.parse(stored);
        const storedPost = allPosts.find(p => p.slug === post.slug);
        
        // If stored post has content, use it
        if (storedPost && storedPost.content && (storedPost.content.el || storedPost.content.en)) {
          return {
            ...post,
            content: {
              el: storedPost.content.el || '',
              en: storedPost.content.en || ''
            }
          };
        }
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }

    // Try to load from getBlogPosts as well
    try {
      const { getBlogPosts } = await import('@/lib/blogPosts');
      const allPosts = getBlogPosts();
      const storedPost = allPosts.find(p => p.slug === post.slug);
      
      if (storedPost && storedPost.content && (storedPost.content.el || storedPost.content.en)) {
        return {
          ...post,
          content: {
            el: storedPost.content.el || '',
            en: storedPost.content.en || ''
          }
        };
      }
    } catch (error) {
      console.error('Error loading from getBlogPosts:', error);
    }

    // Try to load from hardcoded posts using the helper function
    try {
      const { getBlogPostContent } = await import('@/lib/blogPosts');
      
      // Wait a bit in case blog page hasn't loaded yet and set window.__blogPostsContent
      let content = getBlogPostContent(post.slug);
      if (!content || (!content.el && !content.en)) {
        await new Promise(resolve => setTimeout(resolve, 200));
        content = getBlogPostContent(post.slug);
      }
      
      // If still no content, wait a bit more and check window directly
      if (!content || (!content.el && !content.en)) {
        await new Promise(resolve => setTimeout(resolve, 300));
        const hardcodedPosts = (window as any).__blogPostsContent;
        if (hardcodedPosts && hardcodedPosts[post.slug] && hardcodedPosts[post.slug].content) {
          content = hardcodedPosts[post.slug].content;
        }
      }

      // Fallback: load blog post page in hidden iframe to get content (page sets window.__blogPostsContent)
      if (!content || (!content.el && !content.en)) {
        try {
          content = await new Promise<{ el: string; en: string } | null>((resolve) => {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = `/blog/${post.slug}`;
            const timeout = setTimeout(() => {
              try { iframe.remove(); } catch { /* noop */ }
              resolve(null);
            }, 8000);
            iframe.onload = () => {
              try {
                const win = (iframe.contentWindow as any);
                if (win?.__blogPostsContent?.[post.slug]?.content) {
                  clearTimeout(timeout);
                  resolve(win.__blogPostsContent[post.slug].content);
                } else {
                  resolve(null);
                }
              } catch {
                resolve(null);
              } finally {
                try { iframe.remove(); } catch { /* noop */ }
              }
            };
            document.body.appendChild(iframe);
          });
        } catch (e) {
          console.error('Iframe fallback for blog content failed:', e);
        }
      }
      
      if (content && (content.el || content.en)) {
        // Also update localStorage with this content for future use
        try {
          const stored = localStorage.getItem('blogPosts');
          if (stored) {
            const allPosts: BlogPost[] = JSON.parse(stored);
            const updatedPosts = allPosts.map(p => {
              if (p.slug === post.slug && (!p.content || (!p.content.el && !p.content.en))) {
                return {
                  ...p,
                  content: content
                };
              }
              return p;
            });
            localStorage.setItem('blogPosts', JSON.stringify(updatedPosts));
          }
        } catch (error) {
          console.error('Error updating localStorage with content:', error);
        }
        
        return {
          ...post,
          content: {
            el: content.el || '',
            en: content.en || ''
          }
        };
      }
    } catch (error) {
      console.error('Error loading from hardcoded posts:', error);
    }
    
    // If we still don't have content, return with empty content
    return {
      ...post,
      content: post.content || { el: '', en: '' }
    };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Only fetch from influencers table - brands should not appear here
      const { data: usersData, error: influencersError } = await supabase
        .from("influencers")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (influencersError) {
        console.error('Error fetching influencers:', influencersError);
        setUsers([]);
      } else if (usersData) {
        console.log(`[Admin Dashboard] Fetched ${usersData.length} influencers`);
        setUsers(usersData as any);
      } else {
        setUsers([]);
      }
      
      const { data: propData, error: proposalsError } = await supabase
        .from("proposals")
        .select("*, influencers(display_name)")
        .order("created_at", { ascending: false });

      if (proposalsError) {
        console.error('Error fetching proposals:', proposalsError);
      }

      if (usersData) {
        const total = usersData.length;
        const approved = usersData.filter((u) => u.approved).length;
        const analyticsVerified = usersData.filter((u) => u.analytics_verified).length;
      
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
          verified: approved, // Keep for backward compatibility
          approved,
          analyticsVerified,
          pending: total - approved, 
          reach: formattedReach,
          pipeline: pipelineSum.toLocaleString() + "€"
        });
      }
    } catch (error) {
      console.error('Error in fetchData:', error);
    } finally {
      setLoading(false);
    }
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
    
    // Refresh every minute - but NOT when edit modal is open
    const interval = setInterval(() => {
      if (!showEditModal && !showBlogEditModal && !showBrandEditModal) {
        loadUnreadMessages();
      }
    }, 60000); // 1 minute instead of 30 seconds
    
    return () => clearInterval(interval);
  }, [showEditModal, showBlogEditModal, showBrandEditModal]);

  useEffect(() => {
    fetchData();
    fetchConversations();
    fetchBrands();
    fetchBlogPosts();
    fetchAnnouncements();
    
    // Refresh counts periodically - but NOT when edit modal is open
    // Increased interval to 2 minutes to avoid interrupting edits
    const interval = setInterval(() => {
      // Don't auto-refresh if edit modal or blog edit modal is open
      if (!showEditModal && !showBlogEditModal && !showBrandEditModal) {
        fetchData();
        fetchConversations();
      }
    }, 120000); // 2 minutes instead of 30 seconds
    
    return () => clearInterval(interval);
  }, [showEditModal, showBlogEditModal, showBrandEditModal]);

  useEffect(() => {
    if (selectedConversation) {
      fetchConversationMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  // Broken thumbnails check disabled – δεν τρέχει αυτόματα ούτε εμφανίζεται banner
  const checkBrokenThumbnails = async () => {
    setCheckingThumbnails(true);
    const broken: Array<{ influencerId: number; influencerName: string; videoUrl: string; thumbnailUrl: string; reason: string }> = [];

    try {
      // Filter influencers that have thumbnails
      const influencersToCheck = users.filter(user => 
        user.video_thumbnails && Object.keys(user.video_thumbnails).length > 0
      );
      
      // Process in batches of 20 to avoid overwhelming the server
      const batchSize = 20;
      for (let i = 0; i < influencersToCheck.length; i += batchSize) {
        const batch = influencersToCheck.slice(i, i + batchSize);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (user) => {
          try {
            const response = await fetch('/api/video-thumbnail/check', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ influencerId: user.id })
            });

            const data = await response.json();
            
            if (data.broken && data.brokenThumbnails && data.brokenThumbnails.length > 0) {
              return data.brokenThumbnails.map((brokenThumb: any) => ({
                influencerId: user.id,
                influencerName: user.display_name || user.contact_email || 'Unknown',
                videoUrl: brokenThumb.videoUrl,
                thumbnailUrl: brokenThumb.thumbnailUrl,
                reason: brokenThumb.reason
              }));
            }
            return [];
          } catch (error) {
            console.error(`Error checking thumbnails for influencer ${user.id}:`, error);
            return [];
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        const flatResults = batchResults.flat();
        broken.push(...flatResults);
        
        // Small delay between batches to avoid rate limiting
        if (i + batchSize < influencersToCheck.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      setBrokenThumbnails(broken);
    } catch (error) {
      console.error('Error checking broken thumbnails:', error);
    } finally {
      setCheckingThumbnails(false);
    }
  };

  const toggleApproval = async (id: number, currentStatus: boolean, userEmail: string, userName: string) => {
    const { error } = await supabase.from("influencers").update({ 
      approved: !currentStatus,
      approved_at: !currentStatus ? new Date().toISOString() : null
    }).eq("id", id);
    
    if (!error) {
        // If approving, mark all unreviewed changes as reviewed
        if (!currentStatus) {
            try {
                const changesResponse = await fetch(`/api/profile-changes?influencerId=${id}&unreviewedOnly=true`);
                const changesData = await changesResponse.json();
                if (changesData.success && changesData.data && changesData.data.length > 0) {
                    const changeIds = changesData.data.map((c: any) => c.id);
                    await fetch('/api/profile-changes', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ changeIds })
                    });
                }
            } catch (e) {
                console.error('Error marking changes as reviewed:', e);
            }
        }
        
        fetchData();
        if (!currentStatus) {
                // Email to influencer (approved) – independent from brand notifications
                try {
                    await fetch('/api/emails', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'approved', email: userEmail, name: userName })
                    });
                } catch (e) {
                    console.error('Influencer approved email error:', e);
                }
                // Notify all registered brands – always run when approving
                try {
                    const notifyRes = await fetch('/api/admin/notify-brands-new-influencer', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ influencerId: id })
                    });
                    const notifyData = await notifyRes.json();
                    if (!notifyRes.ok || notifyData.resendApiKeyMissing) {
                        console.error('[Admin] Notify brands failed:', notifyData);
                        if (notifyData.resendApiKeyMissing) {
                            alert(lang === 'el' ? 'Προσοχή: RESEND_API_KEY δεν έχει οριστεί. Τα emails στις επιχειρήσεις δεν στάλθηκαν.' : 'Warning: RESEND_API_KEY is not set. Brand notification emails were not sent.');
                        } else if (notifyData.error) {
                            alert(lang === 'el' ? `Σφάλμα: ${notifyData.error}` : `Error: ${notifyData.error}`);
                        }
                    } else if (notifyData.total === 0) {
                        console.warn('[Admin] No brands with contact_email found to notify.');
                    } else if (notifyData.sent === 0) {
                        alert(lang === 'el' ? `Προσοχή: Δεν στάλθηκαν emails στις επιχειρήσεις (${notifyData.total}). Ελέγξτε τα logs.` : `Warning: No emails sent to brands (${notifyData.total}). Check logs.`);
                    } else {
                        if (notifyData.sent < notifyData.total && notifyData.errors?.length) {
                            console.error('[Admin] Notify brands partial:', notifyData.errors);
                        }
                        alert(lang === 'el' ? `Στάλθηκαν ${notifyData.sent}/${notifyData.total} emails σε επιχειρήσεις.` : `${notifyData.sent}/${notifyData.total} emails sent to brands.`);
                    }
                } catch (e) {
                    console.error('Notify brands error:', e);
                    alert(lang === 'el' ? 'Σφάλμα κατά την αποστολή emails στις επιχειρήσεις.' : 'Error sending emails to brands.');
                }
        }
    }
    
    if(selectedUser?.id === id) {
        setSelectedUser(prev => prev ? {...prev, approved: !currentStatus} : null);
    }
  };

  const toggleAnalyticsVerification = async (id: number, currentStatus: boolean) => {
    const { error } = await supabase.from("influencers").update({ 
      analytics_verified: !currentStatus,
      analytics_verified_at: !currentStatus ? new Date().toISOString() : null
    }).eq("id", id);
    
    if (!error) {
        fetchData();
    }
    
    if(selectedUser?.id === id) {
        setSelectedUser(prev => prev ? {...prev, analytics_verified: !currentStatus} : null);
    }
  };

  const refreshSocialStats = async (user?: DbInfluencer) => {
    const confirmMsg = lang === 'el' ? 'Είσαι σίγουρος;' : 'Are you sure?';
    if (!confirm(confirmMsg)) return;
    const idStr = user != null ? String(user.id) : null;
    if (idStr) setRefreshingSocialFor(idStr); else setRefreshingSocialAll(true);
    try {
      let instagramOverrides: Record<string, { followers: string; engagement_rate: string; avg_likes: string }> | undefined;
      let tiktokOverrides: Record<string, { followers: string; engagement_rate: string; avg_likes: string }> | undefined;

      if (idStr && user?.accounts?.length) {
        // Refresh one: use this user's accounts
        const igAccounts = user.accounts.filter((acc: { platform?: string }) => (acc.platform || '').toLowerCase() === 'instagram');
        const tiktokAccounts = user.accounts.filter((acc: { platform?: string }) => (acc.platform || '').toLowerCase() === 'tiktok');
        const needsAuditpr = igAccounts.length > 0 || tiktokAccounts.length > 0;
        if (needsAuditpr) {
          const storedUrl = typeof window !== 'undefined' ? (localStorage.getItem('influo_auditpr_url') || 'http://localhost:8000') : '';
          const promptMsg = lang === 'el'
            ? 'Auditpr URL (αν τρέχει τοπικά στο PC: http://localhost:8000). Αφήστε κενό για server.'
            : 'Auditpr URL (if running locally: http://localhost:8000). Leave empty for server.';
          const auditprUrl = typeof window !== 'undefined' ? prompt(promptMsg, storedUrl) : null;
          if (auditprUrl === null) {
            setRefreshingSocialFor(null);
            setRefreshingSocialAll(false);
            return;
          }
          const url = auditprUrl.trim();
          if (url) {
            if (typeof window !== 'undefined') localStorage.setItem('influo_auditpr_url', url);
            if (igAccounts.length > 0) {
              instagramOverrides = {};
              for (const acc of igAccounts) {
                const un = (acc.username || '').trim();
                if (!un) continue;
                const result = await fetchInstagramFromAuditpr(url, un);
                if ('followers' in result) {
                  instagramOverrides[un.replace(/^@+/, '').trim()] = result;
                }
              }
            }
            if (tiktokAccounts.length > 0) {
              tiktokOverrides = {};
              for (const acc of tiktokAccounts) {
                const un = (acc.username || '').trim();
                if (!un) continue;
                const result = await fetchTiktokFromAuditpr(url, un);
                if ('followers' in result) {
                  tiktokOverrides[un.replace(/^@+/, '').trim()] = result;
                }
              }
            }
          }
        }
      } else if (!idStr) {
        // Refresh all: get list of due influencers, prompt for Auditpr URL, fetch from local Auditpr for every IG/TikTok account
        const listRes = await fetch('/api/admin/refresh-social-stats', { method: 'GET' });
        const listData = await listRes.json();
        const dueList = (listData.influencers ?? []) as { id: number; display_name: string; accounts: { platform?: string; username?: string }[] }[];
        const igUsernames = new Set<string>();
        const tiktokUsernames = new Set<string>();
        for (const inf of dueList) {
          const accounts = inf.accounts ?? [];
          for (const acc of accounts) {
            const platform = (acc.platform || '').toLowerCase();
            const un = (acc.username || '').trim();
            if (!un) continue;
            if (platform === 'instagram') igUsernames.add(un);
            if (platform === 'tiktok') tiktokUsernames.add(un);
          }
        }
        const allIg = Array.from(igUsernames, (username) => ({ username }));
        const allTiktok = Array.from(tiktokUsernames, (username) => ({ username }));
        const needsAuditpr = allIg.length > 0 || allTiktok.length > 0;
        if (needsAuditpr) {
          const storedUrl = typeof window !== 'undefined' ? (localStorage.getItem('influo_auditpr_url') || 'http://localhost:8000') : '';
          const promptMsg = lang === 'el'
            ? 'Auditpr URL για ανανέωση όλων (τοπικά: http://localhost:8000). Αφήστε κενό για server (Apify).'
            : 'Auditpr URL for refresh all (local: http://localhost:8000). Leave empty for server (Apify).';
          const auditprUrl = typeof window !== 'undefined' ? prompt(promptMsg, storedUrl) : null;
          if (auditprUrl === null) {
            setRefreshingSocialAll(false);
            return;
          }
          const url = auditprUrl.trim();
          if (url) {
            if (typeof window !== 'undefined') localStorage.setItem('influo_auditpr_url', url);
            if (allIg.length > 0) {
              instagramOverrides = {};
              for (const { username: un } of allIg) {
                const result = await fetchInstagramFromAuditpr(url, un);
                if ('followers' in result) {
                  instagramOverrides[un.replace(/^@+/, '').trim()] = result;
                }
              }
            }
            if (allTiktok.length > 0) {
              tiktokOverrides = {};
              for (const { username: un } of allTiktok) {
                const result = await fetchTiktokFromAuditpr(url, un);
                if ('followers' in result) {
                  tiktokOverrides[un.replace(/^@+/, '').trim()] = result;
                }
              }
            }
          }
        }
      }

      const body: {
        influencerId?: string;
        instagramOverrides?: Record<string, { followers: string; engagement_rate: string; avg_likes: string }>;
        tiktokOverrides?: Record<string, { followers: string; engagement_rate: string; avg_likes: string }>;
      } = idStr ? { influencerId: idStr } : {};
      if (instagramOverrides && Object.keys(instagramOverrides).length > 0) body.instagramOverrides = instagramOverrides;
      if (tiktokOverrides && Object.keys(tiktokOverrides).length > 0) body.tiktokOverrides = tiktokOverrides;
      const res = await fetch('/api/admin/refresh-social-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      const summary = data.results?.length
        ? data.results.map((r: { name: string; errors?: string[] }) =>
            r.name + (r.errors?.length ? ': ' + r.errors.join('; ') : ' OK')
          ).join('\n')
        : '';
      alert((data.message || 'Done') + ': ' + data.refreshed + (summary ? '\n\n' + summary : ''));
      fetchData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setRefreshingSocialFor(null);
      setRefreshingSocialAll(false);
    }
  };
  
  const deleteUser = async (id: number) => {
    // Find user details for confirmation
    const user = users.find(u => u.id === id);
    const userEmail = user?.contact_email || 'unknown';
    const userName = user?.display_name || 'unknown';
    
    if (!confirm(
      lang === 'el' 
        ? `Είσαι σίγουρος ότι θες να διαγράψεις τον χρήστη "${userName}" (${userEmail})?\n\n⚠️ Προσοχή: Αυτή η ενέργεια θα διαγράψει:\n- Τον influencer από τη βάση\n- Τον auth user\n- Όλες τις συνομιλίες (CASCADE)\n- Όλα τα μηνύματα (CASCADE)\n- Όλα τα proposals\n\nΑυτή η ενέργεια ΔΕΝ μπορεί να αναιρεθεί!`
        : `Are you sure you want to delete user "${userName}" (${userEmail})?\n\n⚠️ Warning: This action will delete:\n- The influencer from database\n- The auth user\n- All conversations (CASCADE)\n- All messages (CASCADE)\n- All proposals\n\nThis action CANNOT be undone!`
    )) {
        return;
    }

    try {
        const response = await fetch('/api/admin/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              userId: id,
              adminEmail: adminEmail // Pass admin email for audit log
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to delete user');
        }

        fetchData();
        setSelectedUser(null);
        setSelectedUsers(selectedUsers.filter(uId => uId !== id));
        
        alert(lang === 'el' 
          ? `Ο χρήστης "${userName}" διαγράφηκε επιτυχώς.`
          : `User "${userName}" deleted successfully.`
        );
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

  const handleToggleBrandVerification = async (brandId: string, currentStatus: boolean) => {
    setUpdatingBrand(brandId);
    try {
      const response = await fetch('/api/admin/brands/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          verified: !currentStatus
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update brand verification');
      }

      // Update local state
      setBrands(prev => prev.map(b => 
        b.id === brandId ? { ...b, verified: !currentStatus } : b
      ));

      alert(lang === 'el' 
        ? `Η επιχείρηση ${!currentStatus ? 'εγκρίθηκε' : 'απορρίφθηκε'} επιτυχώς.`
        : `Brand ${!currentStatus ? 'verified' : 'unverified'} successfully.`
      );
    } catch (error: any) {
      console.error('Error toggling brand verification:', error);
      alert(lang === 'el' 
        ? `Σφάλμα: ${error.message}`
        : `Error: ${error.message}`
      );
    } finally {
      setUpdatingBrand(null);
    }
  };

  const handleUpdateBrand = async (updatedBrand: Partial<Brand>) => {
    if (!selectedBrand) return;
    
    setUpdatingBrand(selectedBrand.id);
    try {
      const response = await fetch('/api/admin/brands/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: selectedBrand.id,
          ...updatedBrand
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update brand');
      }

      // Update local state
      setBrands(prev => prev.map(b => 
        b.id === selectedBrand.id ? { ...b, ...updatedBrand } : b
      ));

      alert(lang === 'el' 
        ? 'Η επιχείρηση ενημερώθηκε επιτυχώς.'
        : 'Brand updated successfully.'
      );
      
      setShowBrandEditModal(false);
      setSelectedBrand(null);
    } catch (error: any) {
      console.error('Error updating brand:', error);
      alert(lang === 'el' 
        ? `Σφάλμα: ${error.message}`
        : `Error: ${error.message}`
      );
    } finally {
      setUpdatingBrand(null);
    }
  };

  const deleteBrand = async (brandId: string, brandName: string) => {
    if (!confirm(
      lang === 'el' 
        ? `Είσαι σίγουρος ότι θες να διαγράψεις την επιχείρηση "${brandName}";`
        : `Are you sure you want to delete the brand "${brandName}"?`
    )) {
      return;
    }

    setDeletingBrand(brandId);
    try {
      const response = await fetch('/api/admin/delete-brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete brand');
      }

      // Remove from local state
      setBrands(prev => prev.filter(b => b.id !== brandId));

      alert(lang === 'el' 
        ? `Η επιχείρηση "${brandName}" διαγράφηκε επιτυχώς.`
        : `Brand "${brandName}" deleted successfully.`
      );
    } catch (error: any) {
      console.error('Error deleting brand:', error);
      alert(lang === 'el' 
        ? `Σφάλμα: ${error.message}`
        : `Error: ${error.message}`
      );
    } finally {
      setDeletingBrand(null);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!confirm(
      lang === 'el' 
        ? 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή τη συνομιλία; Αυτή η ενέργεια θα διαγράψει και όλα τα μηνύματα και τα σχετικά στατιστικά.'
        : 'Are you sure you want to delete this conversation? This will also delete all messages and related statistics.'
    )) {
      return;
    }

    setDeletingConversation(conversationId);
    try {
      const response = await fetch('/api/admin/delete-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete conversation');
      }

      // Remove from local state
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      
      // Clear selected conversation if it was deleted
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
        setConversationMessages([]);
      }

      alert(lang === 'el' 
        ? 'Η συνομιλία διαγράφηκε επιτυχώς.'
        : 'Conversation deleted successfully.'
      );
    } catch (error: any) {
      console.error('Error deleting conversation:', error);
      alert(lang === 'el' 
        ? `Σφάλμα: ${error.message}`
        : `Error: ${error.message}`
      );
    } finally {
      setDeletingConversation(null);
    }
  };

  const handleDeleteProposal = async (proposalId: number) => {
    if (!confirm(
      lang === 'el' 
        ? 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την πρόταση; Αυτή η ενέργεια θα διαγράψει και τα σχετικά στατιστικά.'
        : 'Are you sure you want to delete this proposal? This will also delete related statistics.'
    )) {
      return;
    }

    setDeletingProposal(proposalId);
    try {
      const response = await fetch('/api/admin/delete-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete proposal');
      }

      // Remove from local state
      setProposals(prev => prev.filter(p => p.id !== proposalId));

      alert(lang === 'el' 
        ? 'Η πρόταση διαγράφηκε επιτυχώς.'
        : 'Proposal deleted successfully.'
      );
    } catch (error: any) {
      console.error('Error deleting proposal:', error);
      alert(lang === 'el' 
        ? `Σφάλμα: ${error.message}`
        : `Error: ${error.message}`
      );
    } finally {
      setDeletingProposal(null);
    }
  };

  const handleMigrateLanguages = async () => {
    if (!confirm(
      lang === "el" 
        ? "Αυτή η ενέργεια θα μετατρέψει όλες τις υπάρχουσες γλώσσες στη βάση στο νέο format. Συνεχίσω;"
        : "This will convert all existing languages in the database to the new format. Continue?"
    )) {
      return;
    }

    try {
      const response = await fetch('/api/admin/migrate-languages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Migration failed');
      }

      alert(
        lang === "el" 
          ? `Migration ολοκληρώθηκε!\n\nΣυνολικά: ${result.total}\nΕνημερωμένα: ${result.updated}`
          : `Migration completed!\n\nTotal: ${result.total}\nUpdated: ${result.updated}`
      );
      
      // Refresh data
      fetchData();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
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
        body: JSON.stringify({ 
          emails,
          adminEmail: adminEmail // Pass admin email for audit log
        }),
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
          const { error } = await supabase.from("influencers").update({ 
            approved: true,
            approved_at: new Date().toISOString()
          }).eq("id", userId);
          if (!error) {
            try {
              await fetch('/api/admin/notify-brands-new-influencer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ influencerId: userId })
              });
              await new Promise((r) => setTimeout(r, 500));
            } catch (e) {
              console.error('[Admin] Notify brands error for', userId, e);
            }
          }
        } else {
          await fetch('/api/admin/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              userId,
              adminEmail: adminEmail // Pass admin email for audit log
            }),
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
        (u.approved ? 'Approved' : 'Not Approved') + ' / ' + (u.analytics_verified ? 'Analytics Verified' : 'Not Verified'),
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-slate-900">{txt.title}</h1>
              <p className="text-xs sm:text-sm text-slate-500">{txt.sub}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button onClick={handleMigrateLanguages} className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200">
                {txt.migrate_languages}
              </button>
              <button onClick={handleCleanupTestUsers} className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                {txt.cleanup_test}
              </button>
              <a href="/admin/support" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                📧 Help Desk
              </a>
              <button 
                onClick={() => {
                  const newLang = lang === "el" ? "en" : "el";
                  setLang(newLang);
                  setStoredLanguage(newLang);
                }} 
                className="text-xs font-medium border border-slate-200 px-2 sm:px-3 py-1.5 rounded hover:bg-slate-50 text-slate-600 transition-colors"
                aria-label="Toggle language"
              >
                {lang === "el" ? "EN" : "EL"}
              </button>
              <a href="/logout" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors">Logout</a>
              <a href="/" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">{txt.back}</a>
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
          <div className="border-b border-slate-200 overflow-x-auto">
            <div className="flex min-w-max sm:min-w-0 px-4 sm:px-6">
              <button 
                onClick={() => setActiveTab("influencers")} 
                className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === "influencers" 
                    ? "border-slate-900 text-slate-900" 
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {txt.tab_inf} ({filteredUsers.length})
              </button>
              <button 
                onClick={() => setActiveTab("proposals")} 
                className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors relative whitespace-nowrap ${
                  activeTab === "proposals" 
                    ? "border-slate-900 text-slate-900" 
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {txt.tab_deals} ({proposals.length})
                {pendingProposalsCount > 0 && (
                  <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 bg-red-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full min-w-[14px] sm:min-w-[16px] h-[14px] sm:h-[16px] flex items-center justify-center px-0.5">
                    {pendingProposalsCount > 99 ? '99+' : pendingProposalsCount > 9 ? '9+' : pendingProposalsCount}
                  </span>
                )}
              </button>
              <button 
                onClick={async () => {
                  setActiveTab("conversations");
                  // Mark all unread messages as read when clicking Conversations tab
                  if (unreadMessagesCount > 0) {
                    try {
                      // Mark all unread messages as read
                      await supabase
                        .from('messages')
                        .update({ read: true })
                        .eq('read', false);
                      // Reload count to update badge
                      const { count } = await supabase
                        .from('messages')
                        .select('*', { count: 'exact', head: true })
                        .eq('read', false);
                      setUnreadMessagesCount(count || 0);
                    } catch (error) {
                      console.error('Error marking messages as read:', error);
                    }
                  }
                }}
                className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors relative whitespace-nowrap ${
                  activeTab === "conversations" 
                    ? "border-slate-900 text-slate-900" 
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                💬 Συνομιλίες ({conversations.length})
                {unreadMessagesCount > 0 && (
                  <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 bg-red-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full min-w-[14px] sm:min-w-[16px] h-[14px] sm:h-[16px] flex items-center justify-center px-0.5">
                    {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setActiveTab("brands")} 
                className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === "brands" 
                    ? "border-slate-900 text-slate-900" 
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {txt.tab_brands} ({brands.length})
              </button>
              <button 
                onClick={() => setActiveTab("blog")} 
                className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === "blog" 
                    ? "border-slate-900 text-slate-900" 
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {txt.tab_blog} ({blogPosts.length})
              </button>
              <button 
                onClick={() => setActiveTab("announcements")} 
                className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === "announcements" 
                    ? "border-slate-900 text-slate-900" 
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {txt.tab_announcements}
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
                <button
                  onClick={() => refreshSocialStats()}
                  disabled={refreshingSocialAll}
                  className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {refreshingSocialAll ? '...' : txt.refresh_social_all}
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(lang === 'el' ? 'Τρέξιμο Gemini audit για όλους σε batch (15-15). Θα δεις την πρόοδο και θα τελειώσει μόνο του. Συνέχεια;' : 'Run Gemini audit for all in batches (15 at a time). You will see progress and it will finish automatically. Continue?')) return;
                    setBackfillingAudit(true);
                    setBackfillProgress(lang === 'el' ? 'Ξεκίνημα...' : 'Starting...');
                    let totalUpdated = 0;
                    const limit = 15;
                    let skip = 0;
                    try {
                      while (true) {
                        setBackfillProgress(lang === 'el' ? `${totalUpdated} ενημερώθηκαν μέχρι τώρα...` : `${totalUpdated} updated so far...`);
                        const res = await fetch('/api/admin/backfill-audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limit, skip }) });
                        const contentType = res.headers.get('content-type') ?? '';
                        let data: { updated?: number; hasMore?: boolean; errors?: string[]; error?: string } = {};
                        if (contentType.includes('application/json')) {
                          data = await res.json();
                        } else {
                          const text = await res.text();
                          const is524 = res.status === 524;
                          const msg = text.startsWith('<')
                            ? (is524
                              ? (lang === 'el' ? 'Timeout (524): το batch διήρκησε πολύ.' : 'Timeout (524): batch took too long.')
                              : (lang === 'el' ? `Ο server απάντησε με HTML. Status: ${res.status}` : `Server returned HTML. Status: ${res.status}`))
                            : `HTTP ${res.status}: ${text.slice(0, 200)}`;
                          throw new Error(msg);
                        }
                        if (!res.ok) {
                          alert((data.error || res.statusText) as string);
                          break;
                        }
                        const batchUpdated = data.updated ?? 0;
                        totalUpdated += batchUpdated;
                        if (!data.hasMore || batchUpdated === 0) {
                          setBackfillProgress(null);
                          alert(lang === 'el' ? `Ολοκλήρωση: ${totalUpdated} influencers ενημερώθηκαν συνολικά.` : `Done: ${totalUpdated} influencers updated in total.`);
                          break;
                        }
                        skip += limit;
                        await new Promise((r) => setTimeout(r, 300));
                      }
                    } catch (e) {
                      setBackfillProgress(null);
                      alert(e instanceof Error ? e.message : 'Failed');
                    } finally {
                      setBackfillingAudit(false);
                      setBackfillProgress(null);
                    }
                  }}
                  disabled={backfillingAudit}
                  className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {backfillingAudit ? '...' : txt.backfill_audit}
                </button>
                {backfillProgress && (
                  <span className="text-sm text-amber-700 ml-1">
                    {backfillProgress}
                  </span>
                )}
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
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.modal_followers}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.col_status}</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">{txt.col_act}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">{txt.no_data}</td>
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
                                    alt={displayNameForLang(u.display_name, lang)} 
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
                                <div className="font-medium text-slate-900">{displayNameForLang(u.display_name, lang)}</div>
                                {u.category && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {(u.category.includes(',') ? u.category.split(',').map((c: string) => c.trim()) : [u.category]).map((cat: string, idx: number) => (
                                      <span
                                        key={idx}
                                        className="text-[10px] uppercase font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded"
                                      >
                                        {cat}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-900">{u.contact_email || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-900">{u.location || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-900">
                            {u.accounts && u.accounts.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {u.accounts.map((acc, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-slate-600">{acc.platform}:</span>
                                    <span className="text-xs text-slate-900">{acc.followers || '-'}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              {u.approved ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{txt.approved}</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Μη Εγκεκριμένος</span>
                              )}
                              {u.analytics_verified ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">{txt.analytics_verified}</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Μη Επαληθευμένα</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2 flex-wrap">
                              <button
                                onClick={() => { setSelectedUser(u); setShowEditModal(true); }}
                                className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                              >
                                {txt.edit}
                              </button>
                              <button
                                onClick={() => toggleApproval(u.id, u.approved || false, u.contact_email || "", u.display_name)}
                                className={`px-2 py-1 text-xs rounded transition-colors ${
                                  u.approved 
                                    ? 'text-red-600 hover:text-red-700 hover:bg-red-50' 
                                    : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                                }`}
                              >
                                {u.approved ? txt.btn_unapprove : txt.btn_approve}
                              </button>
                              <button
                                onClick={() => toggleAnalyticsVerification(u.id, u.analytics_verified || false)}
                                className={`px-2 py-1 text-xs rounded transition-colors ${
                                  u.analytics_verified 
                                    ? 'text-red-600 hover:text-red-700 hover:bg-red-50' 
                                    : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                                }`}
                              >
                                {u.analytics_verified ? txt.btn_unverify_analytics : txt.btn_verify_analytics}
                              </button>
                              <button
                                onClick={() => refreshSocialStats(u)}
                                disabled={refreshingSocialFor === String(u.id)}
                                className="px-2 py-1 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {refreshingSocialFor === String(u.id) ? '...' : txt.refresh_social}
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'Ενέργειες' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {proposals.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">{txt.no_data}</td>
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
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProposal(p.id);
                            }}
                            disabled={deletingProposal === p.id}
                            className="px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deletingProposal === p.id 
                              ? (lang === 'el' ? 'Διαγραφή...' : 'Deleting...')
                              : (lang === 'el' ? 'Διαγραφή' : 'Delete')
                            }
                          </button>
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
                <div className="flex items-center justify-between gap-4">
                  <input
                    type="text"
                    placeholder={lang === 'el' ? 'Αναζήτηση επιχείρησης...' : 'Search company...'}
                    value={brandSearchQuery}
                    onChange={(e) => setBrandSearchQuery(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    onClick={fetchBrands}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {lang === 'el' ? 'Ανανέωση' : 'Refresh'}
                  </button>
                </div>
              </div>

              {/* Brands Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'Εταιρεία' : 'Company'}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'Email' : 'Email'}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'ΑΦΜ' : 'Tax ID'}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'Επικοινωνία' : 'Contact'}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'Κλάδος' : 'Industry'}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'Ημερομηνία' : 'Date'}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'Κατάσταση' : 'Status'}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'Ενέργειες' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {brands.filter(b => 
                      brandSearchQuery === "" || 
                      b.brand_name.toLowerCase().includes(brandSearchQuery.toLowerCase()) ||
                      b.contact_email.toLowerCase().includes(brandSearchQuery.toLowerCase())
                    ).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                          {brands.length === 0 
                            ? (lang === 'el' ? 'Δεν υπάρχουν εγγεγραμμένες επιχειρήσεις' : 'No registered companies')
                            : txt.no_data}
                        </td>
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
                          <td className="px-4 py-3 text-slate-600 font-mono text-sm">{b.afm}</td>
                          <td className="px-4 py-3 text-slate-600">
                            <div className="flex flex-col gap-1">
                              {b.contact_person && (
                                <span className="text-sm">{b.contact_person}</span>
                              )}
                              {b.website && (
                                <a 
                                  href={b.website.startsWith('http') ? b.website : `https://${b.website}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  {b.website}
                                </a>
                              )}
                            </div>
                          </td>
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
                              {b.verified ? (lang === 'el' ? 'Επαληθευμένη' : 'Verified') : (lang === 'el' ? 'Αναμονή για έγκριση' : 'Pending Approval')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { setSelectedBrand(b); setShowBrandEditModal(true); }}
                                disabled={updatingBrand === b.id || deletingBrand === b.id}
                                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {lang === 'el' ? 'Επεξεργασία' : 'Edit'}
                              </button>
                              <button
                                onClick={() => handleToggleBrandVerification(b.id, b.verified)}
                                disabled={updatingBrand === b.id || deletingBrand === b.id}
                                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                                  b.verified
                                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                {updatingBrand === b.id 
                                  ? (lang === 'el' ? 'Επεξεργασία...' : 'Processing...')
                                  : b.verified
                                    ? (lang === 'el' ? 'Απόρριψη' : 'Reject')
                                    : (lang === 'el' ? 'Έγκριση' : 'Approve')
                                }
                              </button>
                              <button
                                onClick={() => deleteBrand(b.id, b.brand_name)}
                                disabled={updatingBrand === b.id || deletingBrand === b.id}
                                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {deletingBrand === b.id 
                                  ? (lang === 'el' ? 'Διαγραφή...' : 'Deleting...')
                                  : (lang === 'el' ? 'Διαγραφή' : 'Delete')
                                }
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
                                  let postWithContent = await loadBlogPostContent(post);
                                  
                                  // If still no content, try to fetch from the blog page's hardcoded posts
                                  // by making a request to load the blog page and extract content
                                  if ((!postWithContent.content?.el && !postWithContent.content?.en)) {
                                    try {
                                      // Try to get content from window object if blog page has exposed it
                                      // Or load directly from localStorage which might have been updated
                                      const stored = localStorage.getItem('blogPosts');
                                      if (stored) {
                                        const allPosts: BlogPost[] = JSON.parse(stored);
                                        const foundPost = allPosts.find(p => p.slug === post.slug);
                                        if (foundPost && foundPost.content) {
                                          postWithContent = {
                                            ...post,
                                            content: {
                                              el: foundPost.content.el || '',
                                              en: foundPost.content.en || ''
                                            }
                                          };
                                        }
                                      }
                                    } catch (error) {
                                      console.error('Error loading content fallback:', error);
                                    }
                                  }
                                  
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

          {activeTab === "announcements" && (
            <>
              <div className="p-4 border-b border-slate-200 space-y-4 text-slate-900">
                <form onSubmit={sendAnnouncement} className="space-y-4 max-w-2xl">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">{txt.ann_title}</label>
                    <input
                      type="text"
                      value={announcementTitle}
                      onChange={(e) => setAnnouncementTitle(e.target.value)}
                      placeholder={lang === 'el' ? 'Τίτλος ανακοίνωσης' : 'Announcement title'}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">{txt.ann_body}</label>
                    <textarea
                      value={announcementBody}
                      onChange={(e) => setAnnouncementBody(e.target.value)}
                      placeholder={lang === 'el' ? 'Κείμενο ανακοίνωσης' : 'Announcement content'}
                      rows={4}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white"
                      required
                    />
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-slate-900 mb-2">
                      {lang === 'el' ? 'Στοχευμένοι παραλήπτες' : 'Recipients'}
                    </span>
                    <div className="flex flex-wrap gap-4">
                      <label className="inline-flex items-center gap-2 cursor-pointer text-slate-900">
                        <input
                          type="radio"
                          name="target"
                          checked={announcementTargetType === 'all'}
                          onChange={() => { setAnnouncementTargetType('all'); setAnnouncementTargetInfluencerId(''); }}
                          className="rounded border-slate-300"
                        />
                        <span>{txt.ann_to_all}</span>
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer text-slate-900">
                        <input
                          type="radio"
                          name="target"
                          checked={announcementTargetType === 'specific'}
                          onChange={() => setAnnouncementTargetType('specific')}
                          className="rounded border-slate-300"
                        />
                        <span>{txt.ann_to_one}</span>
                      </label>
                      {announcementTargetType === 'specific' && (
                        <select
                          value={announcementTargetInfluencerId}
                          onChange={(e) => setAnnouncementTargetInfluencerId(e.target.value)}
                          className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[200px] text-slate-900 bg-white"
                          required={announcementTargetType === 'specific'}
                        >
                          <option value="">{lang === 'el' ? '— Επιλέξτε —' : '— Select —'}</option>
                          {users.map((u) => {
                            const uuid = u.auth_user_id || (typeof u.id === 'string' ? u.id : null);
                            return (
                              <option key={String(u.id)} value={uuid || ''} disabled={!uuid}>
                                {u.display_name} {u.contact_email ? `(${u.contact_email})` : ''}
                                {!uuid ? ` ${lang === 'el' ? '(χωρίς auth)' : '(no auth)'}` : ''}
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={announcementSending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {announcementSending ? '...' : txt.ann_send}
                  </button>
                </form>
              </div>
              <div className="p-4 text-slate-900">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  {lang === 'el' ? 'Απεσταλμένες ανακοινώσεις' : 'Sent announcements'}
                </h3>
                {announcementsLoading ? (
                  <p className="text-slate-600">{lang === 'el' ? 'Φόρτωση...' : 'Loading...'}</p>
                ) : announcementsList.length === 0 ? (
                  <p className="text-slate-600">{txt.no_data}</p>
                ) : (
                  <ul className="space-y-3">
                    {announcementsList.map((a) => (
                      <li key={a.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-900">{a.title}</div>
                          <div className="text-sm text-slate-800 mt-1 line-clamp-2">{a.body}</div>
                          <div className="text-xs text-slate-700 mt-2">
                            {new Date(a.created_at).toLocaleString(lang === 'el' ? 'el-GR' : 'en-GB')}
                            {a.target_type === 'specific' && a.target_influencer_id && (
                              <span className="ml-2">
                                → {lang === 'el' ? 'Σε συγκεκριμένο' : 'To specific'}
                                {(users.find(u => u.auth_user_id === a.target_influencer_id) || users.find(u => String(u.id) === a.target_influencer_id)) && (
                                  <>: {(users.find(u => u.auth_user_id === a.target_influencer_id) || users.find(u => String(u.id) === a.target_influencer_id))!.display_name}</>
                                )}
                              </span>
                            )}
                            {a.target_type === 'all' && (
                              <span className="ml-2">→ {txt.ann_to_all}</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(lang === 'el' ? 'Διαγραφή ανακοίνωσης; Δεν μπορεί να αναιρεθεί.' : 'Delete this announcement? This cannot be undone.')) return;
                            try {
                              const res = await fetch(`/api/admin/announcements/${a.id}`, { method: 'DELETE' });
                              if (res.ok) {
                                setAnnouncementsList(prev => prev.filter(x => x.id !== a.id));
                              } else {
                                const j = await res.json().catch(() => ({}));
                                alert(j.error || 'Error');
                              }
                            } catch (e) {
                              console.error('Error deleting announcement:', e);
                              alert(lang === 'el' ? 'Σφάλμα διαγραφής' : 'Delete failed');
                            }
                          }}
                          className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                          title={lang === 'el' ? 'Διαγραφή ανακοίνωσης' : 'Delete announcement'}
                        >
                          {lang === 'el' ? 'Διαγραφή' : 'Delete'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
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
                <div className="flex flex-col sm:flex-row h-[500px] sm:h-[600px] relative min-h-[400px]">
                  {/* Mobile: Backdrop overlay when conversations drawer is open */}
                  {showConversationsDrawer && (
                    <div
                      onClick={() => setShowConversationsDrawer(false)}
                      className="sm:hidden fixed inset-0 bg-black/50 z-40"
                    />
                  )}

                  {/* Mobile: Toggle button for conversations drawer */}
                  {!selectedConversation && (
                    <button
                      onClick={() => setShowConversationsDrawer(true)}
                      className="sm:hidden absolute top-2 right-2 z-50 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium shadow-lg hover:bg-blue-700 transition-colors"
                    >
                      {lang === 'el' ? '📋 Συνομιλίες' : '📋 Conversations'}
                    </button>
                  )}

                  {/* Conversations List */}
                  <div className={`w-full sm:w-80 border-r border-slate-200 overflow-y-auto bg-white ${
                    showConversationsDrawer ? 'block' : 'hidden sm:block'
                  } absolute sm:relative top-0 left-0 right-0 sm:right-auto bottom-0 sm:bottom-auto z-50 sm:z-auto shadow-xl sm:shadow-none max-h-full`}>
                    {conversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={`relative border-b border-slate-200 hover:bg-slate-50 transition-colors ${
                          selectedConversation?.id === conv.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                        }`}
                      >
                        <button
                          onClick={() => {
                            setSelectedConversation(conv);
                            // Close drawer on mobile when conversation is selected
                            setShowConversationsDrawer(false);
                          }}
                          className="w-full text-left p-4 pr-12"
                        >
                          <div className="font-semibold text-slate-900">{conv.influencer_name}</div>
                          <div className="text-xs text-slate-500 mt-1">↔ {conv.brand_name || conv.brand_email}</div>
                          <div className="text-xs text-slate-400 mt-1">
                            {new Date(conv.last_message_at).toLocaleDateString('el-GR')}
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConversation(conv.id);
                          }}
                          disabled={deletingConversation === conv.id}
                          className="absolute top-2 right-2 px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={lang === 'el' ? 'Διαγραφή συνομιλίας' : 'Delete conversation'}
                        >
                          {deletingConversation === conv.id ? '...' : '✕'}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative z-10">
                    {/* Mobile: Back button to show conversations list */}
                    {selectedConversation && (
                      <button
                        onClick={() => {
                          setSelectedConversation(null);
                          setShowConversationsDrawer(true);
                        }}
                        className="sm:hidden mb-4 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors flex items-center gap-2"
                      >
                        ← {lang === 'el' ? 'Πίσω' : 'Back'}
                      </button>
                    )}
                    {selectedConversation ? (
                      <>
                        <div className="mb-4 pb-4 border-b border-slate-200">
                          <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
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
                      <div className="flex flex-col items-center justify-center h-full text-slate-500 p-4">
                        <p className="text-center mb-4">{lang === 'el' ? 'Επέλεξε μια συνομιλία για να δεις τα μηνύματα' : 'Select a conversation to view messages'}</p>
                        <button
                          onClick={() => setShowConversationsDrawer(true)}
                          className="sm:hidden px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          {lang === 'el' ? '📋 Προβολή Συνομιλιών' : '📋 View Conversations'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showBrandEditModal && selectedBrand && (
        <EditBrandModal
          brand={selectedBrand}
          onClose={() => { setShowBrandEditModal(false); setSelectedBrand(null); }}
          onSave={handleUpdateBrand}
          lang={lang}
        />
      )}

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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Ημερομηνία' : 'Date'}</label>
                  <input
                    type="date"
                    value={selectedBlogPost.date}
                    onChange={(e) => setSelectedBlogPost({...selectedBlogPost, date: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Τίτλος (Αγγλικά)' : 'Title (English)'}</label>
                <input
                  type="text"
                  value={selectedBlogPost.title.en}
                  onChange={(e) => setSelectedBlogPost({...selectedBlogPost, title: {...selectedBlogPost.title, en: e.target.value}})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Περίληψη (Ελληνικά)' : 'Excerpt (Greek)'}</label>
                <textarea
                  value={selectedBlogPost.excerpt.el}
                  onChange={(e) => setSelectedBlogPost({...selectedBlogPost, excerpt: {...selectedBlogPost.excerpt, el: e.target.value}})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Περίληψη (Αγγλικά)' : 'Excerpt (English)'}</label>
                <textarea
                  value={selectedBlogPost.excerpt.en}
                  onChange={(e) => setSelectedBlogPost({...selectedBlogPost, excerpt: {...selectedBlogPost.excerpt, en: e.target.value}})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm text-slate-900 font-medium"
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm text-slate-900 font-medium"
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Κατηγορία (Αγγλικά)' : 'Category (English)'}</label>
                  <input
                    type="text"
                    value={selectedBlogPost.category.en}
                    onChange={(e) => setSelectedBlogPost({...selectedBlogPost, category: {...selectedBlogPost.category, en: e.target.value}})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
                    placeholder="8 λεπτά"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Χρόνος Ανάγνωσης (Αγγλικά)' : 'Read Time (English)'}</label>
                  <input
                    type="text"
                    value={selectedBlogPost.readTime.en}
                    onChange={(e) => setSelectedBlogPost({...selectedBlogPost, readTime: {...selectedBlogPost.readTime, en: e.target.value}})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
                />
              </div>

              {selectedBlogPost.image && (
                <div>
                  <img src={selectedBlogPost.image} alt={`Blog post preview: ${selectedBlogPost.title?.el || selectedBlogPost.title?.en || 'Preview'}`} className="w-full h-48 object-cover rounded-lg" />
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
