"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { recommendInfluencers, type InfluencerProfile, type BrandProfile } from '@/lib/recommendations';
import Messaging from '@/components/Messaging';
import PushNotificationPrompt from '@/components/PushNotificationPrompt';
import { getStoredLanguage, setStoredLanguage } from '@/lib/language';
import { displayNameForLang } from '@/lib/greeklish';
import { getCachedImageUrl } from '@/lib/imageProxy';
import { prepareImageForStorage } from '@/lib/prepareImageForStorage';
import BrandCampaignsSection from '@/components/BrandCampaignsSection';

// Categories (same as Directory and InfluencerSignupForm)
const CATEGORIES = [
  "Γενικά", "Lifestyle", "Fashion & Style", "Beauty & Makeup", "Travel", "Food & Drink",
  "Health & Fitness", "Tech & Gadgets", "Business & Finance", "Gaming & Esports",
  "Parenting & Family", "Home & Decor", "Pets & Animals", "Comedy & Entertainment",
  "Art & Photography", "Music & Dance", "Education & Coaching", "Sports & Athletes",
  "DIY & Crafts", "Sustainability & Eco", "Cars & Automotive"
];

// Category translations (same as Directory)
const categoryTranslations: { [key: string]: { el: string; en: string } } = {
  "Lifestyle": { el: "Lifestyle", en: "Lifestyle" },
  "Fashion & Style": { el: "Μόδα & Στυλ", en: "Fashion & Style" },
  "Beauty & Makeup": { el: "Ομορφιά & Μακιγιάζ", en: "Beauty & Makeup" },
  "Travel": { el: "Ταξίδια", en: "Travel" },
  "Food & Drink": { el: "Φαγητό & Ποτά", en: "Food & Drink" },
  "Health & Fitness": { el: "Υγεία & Fitness", en: "Health & Fitness" },
  "Tech & Gadgets": { el: "Τεχνολογία & Gadgets", en: "Tech & Gadgets" },
  "Business & Finance": { el: "Επιχειρήσεις & Οικονομικά", en: "Business & Finance" },
  "Gaming & Esports": { el: "Gaming & Esports", en: "Gaming & Esports" },
  "Parenting & Family": { el: "Οικογένεια & Παιδιά", en: "Parenting & Family" },
  "Home & Decor": { el: "Σπίτι & Διακόσμηση", en: "Home & Decor" },
  "Pets & Animals": { el: "Κατοικίδια & Ζώα", en: "Pets & Animals" },
  "Comedy & Entertainment": { el: "Κωμωδία & Ψυχαγωγία", en: "Comedy & Entertainment" },
  "Art & Photography": { el: "Τέχνη & Φωτογραφία", en: "Art & Photography" },
  "Music & Dance": { el: "Μουσική & Χορός", en: "Music & Dance" },
  "Education & Coaching": { el: "Εκπαίδευση & Coaching", en: "Education & Coaching" },
  "Sports & Athletes": { el: "Αθλήματα & Αθλητές", en: "Sports & Athletes" },
  "DIY & Crafts": { el: "DIY & Χειροτεχνίες", en: "DIY & Crafts" },
  "Sustainability & Eco": { el: "Βιωσιμότητα & Οικολογία", en: "Sustainability & Eco" },
  "Cars & Automotive": { el: "Αυτοκίνητα", en: "Cars & Automotive" },
  "Γενικά": { el: "Γενικά", en: "General" },
};

interface Proposal {
  id: string;
  influencer_id: string;
  brand_name: string;
  brand_email: string;
  brand_id?: string;
  service_type: string;
  budget: number;
  counter_proposal_budget?: number;
  counter_proposal_message?: string;
  status: string;
  description?: string;
  created_at: string;
  influencer_agreement_accepted: boolean;
  brand_agreement_accepted: boolean;
  counter_proposal_status?: string;
}

interface Influencer {
  id: string;
  display_name: string;
  avatar_url?: string;
}

// Edit Brand Modal Component Props
type EditBrandModalProps = {
  brand: any;
  onClose: () => void;
  onSave: (updatedData: any) => void;
  updating: boolean;
  lang: 'el' | 'en';
  txt: any;
  categories: string[];
  categoryTranslations: { [key: string]: { el: string; en: string } };
};

const t = {
  el: {
    title: "Dashboard Επιχείρησης",
    logout: "Αποσύνδεση",
    edit_profile: "Επεξεργασία Προφίλ",
    save_changes: "Αποθήκευση Αλλαγών",
    cancel: "Ακύρωση",
    edit_brand_name: "Όνομα Επιχείρησης",
    edit_contact_email: "Email",
    edit_contact_person: "Επικοινωνία",
    edit_afm: "ΑΦΜ",
    edit_website: "Ιστοσελίδα",
    edit_category: "Κατηγορία",
    edit_logo: "Λογότυπο",
    upload_logo: "Ανέβασμα Λογοτύπου",
    remove_logo: "Αφαίρεση",
    profile_updated: "Το προφίλ ενημερώθηκε επιτυχώς!",
    error_updating: "Σφάλμα κατά την ενημέρωση",
    pending_agreements: "Συμφωνίες που αναμένουν αποδοχή",
    no_pending: "Δεν υπάρχουν συμφωνίες που αναμένουν αποδοχή",
    proposal_details: "Λεπτομέρειες Πρότασης",
    influencer: "Influencer",
    service: "Υπηρεσία",
    budget: "Budget",
    description: "Περιγραφή",
    accept_agreement: "Αποδοχή Συμφωνίας",
    agreement_terms: "Όροι Χρήσης",
    agreement_text: "Με την αποδοχή αυτής της συμφωνίας, συμφωνώ με τους όρους χρήσης της πλατφόρμας Influo και επιβεβαιώνω ότι είμαι πρόθυμος να προχωρήσω στη συνεργασία με τους όρους που έχουν συμφωνηθεί.",
    accepted: "Αποδεκτή",
    pending: "Εκκρεμής",
    loading: "Φόρτωση...",
    error: "Σφάλμα",
    recommendations_title: "Προτεινόμενοι Influencers για εσάς",
    recommendations_subtitle: "Βάσει του industry σας, της στρατηγικής αξιολόγησης (niche, engagement) και της αξίας για τα brands",
    recommendations_loading: "Φόρτωση προτάσεων...",
    recommendations_empty: "Δεν βρέθηκαν προτάσεις αυτή τη στιγμή",
    match_score: "Match Score",
    why_match: "Γιατί ταιριάζει",
    view_profile: "Δείτε Προφίλ",
    send_proposal: "Στείλτε Προσφορά",
    engagement_rate: "Engagement Rate",
    rating: "Αξιολόγηση",
    reviews: "Reviews",
    followers: "Ακόλουθοι",
    filters: "Φίλτρα",
    refresh: "Ανανέωση",
    min_score: "Ελάχιστο Score",
    max_price: "Μέγιστη Τιμή (€)",
    category_filter: "Κατηγορία",
    min_engagement: "Ελάχιστο Engagement (%)",
    min_rating: "Ελάχιστο Rating",
    apply_filters: "Εφαρμογή",
    clear_filters: "Καθαρισμός",
    stats_title: "Στατιστικά Προτάσεων",
    total_viewed: "Σύνολο Προτάσεων",
    profiles_clicked: "Προφίλ που Επισκέφτηκες",
    proposals_sent: "Προσφορές που Στείλατε",
    smart_service_title: "🤖 Έξυπνη Υπηρεσία Προτάσεων",
    smart_service_desc: "Το AI μας αναλύει το brand σας και προτείνει τους καλύτερους influencers. Δωρεάν για όλες τις εγγεγραμμένες επιχειρήσεις!"
  },
  en: {
    title: "Company Dashboard",
    logout: "Logout",
    edit_profile: "Edit Profile",
    save_changes: "Save Changes",
    cancel: "Cancel",
    edit_brand_name: "Company Name",
    edit_contact_email: "Email",
    edit_contact_person: "Contact Person",
    edit_afm: "Tax ID",
    edit_website: "Website",
    edit_category: "Category",
    edit_logo: "Logo",
    upload_logo: "Upload Logo",
    remove_logo: "Remove",
    profile_updated: "Profile updated successfully!",
    error_updating: "Error updating profile",
    pending_agreements: "Agreements Pending Acceptance",
    no_pending: "No agreements pending acceptance",
    recommendations_title: "Recommended Influencers for You",
    recommendations_subtitle: "Based on your industry, strategic audit (niche, engagement) and value for brands",
    recommendations_loading: "Loading recommendations...",
    recommendations_empty: "No recommendations found at this time",
    match_score: "Match Score",
    why_match: "Why This Match",
    view_profile: "View Profile",
    send_proposal: "Send Proposal",
    engagement_rate: "Engagement Rate",
    rating: "Rating",
    reviews: "Reviews",
    followers: "Followers",
    filters: "Filters",
    refresh: "Refresh",
    min_score: "Min Score",
    max_price: "Max Price (€)",
    category_filter: "Category",
    min_engagement: "Min Engagement (%)",
    min_rating: "Min Rating",
    apply_filters: "Apply",
    clear_filters: "Clear",
    stats_title: "Recommendation Stats",
    total_viewed: "Total Recommendations",
    profiles_clicked: "Profiles Viewed",
    proposals_sent: "Proposals Sent",
    smart_service_title: "🤖 Smart Recommendation Service",
    smart_service_desc: "Our AI analyzes your brand and suggests the best influencers. Free for all registered businesses!",
    proposal_details: "Proposal Details",
    influencer: "Influencer",
    service: "Service",
    budget: "Budget",
    description: "Description",
    accept_agreement: "Accept Agreement",
    agreement_terms: "Terms of Service",
    agreement_text: "By accepting this agreement, I agree to the Influo platform terms of service and confirm that I am willing to proceed with the collaboration under the agreed terms.",
    accepted: "Accepted",
    pending: "Pending",
    loading: "Loading...",
    error: "Error"
  }
};

// Edit Brand Modal Component
function EditBrandModal({ brand, onClose, onSave, updating, lang, txt, categories, categoryTranslations }: EditBrandModalProps) {
  const [brandName, setBrandName] = useState(brand.brand_name || '');
  const [contactPerson, setContactPerson] = useState(brand.contact_person || '');
  const [website, setWebsite] = useState(brand.website || '');
  const [category, setCategory] = useState(brand.industry || brand.category || '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(brand.logo_url || null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

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
    
    let logoUrl = brand.logo_url || null;
    
    // Upload new logo if selected
    if (logoFile) {
      setUploadingLogo(true);
      try {
        const preparedLogo = await prepareImageForStorage(logoFile, { maxSide: 640 });
        const safeTail = preparedLogo.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `brand-${brand.id}-${Date.now()}-${safeTail}`;
        const filePath = fileName;

        // Delete old logo if exists
        if (brand.logo_url) {
          try {
            // Extract filename from full URL
            const urlParts = brand.logo_url.split('/');
            const oldFileName = urlParts[urlParts.length - 1];
            if (oldFileName.startsWith('brand-')) {
              await supabase.storage.from('avatars').remove([oldFileName]);
            }
          } catch (deleteErr) {
            console.warn('Could not delete old logo:', deleteErr);
            // Continue anyway
          }
        }

        // Upload new logo to avatars bucket
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, preparedLogo, { 
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

    onSave({
      brand_name: brandName.trim(),
      contact_person: contactPerson.trim() || null,
      website: website.trim() || null,
      category: category.trim() || null,
      logo_url: logoUrl,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{txt.edit_profile}</h2>
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
              {txt.edit_brand_name} *
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
              {txt.edit_contact_person}
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
              {txt.edit_contact_email}
            </label>
            <input
              type="email"
              value={brand.contact_email || ''}
              disabled
              className="w-full px-4 py-3 bg-slate-100 text-slate-600 border-2 border-slate-200 rounded-xl cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">
              {lang === 'el' ? 'Το email δεν μπορεί να αλλάξει' : 'Email cannot be changed'}
            </p>
          </div>

          {/* AFM (Read-only) */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              {txt.edit_afm}
            </label>
            <input
              type="text"
              value={brand.afm || ''}
              disabled
              className="w-full px-4 py-3 bg-slate-100 text-slate-600 border-2 border-slate-200 rounded-xl cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">
              {lang === 'el' ? 'Το ΑΦΜ δεν μπορεί να αλλάξει' : 'Tax ID cannot be changed'}
            </p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              {txt.edit_category} *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {lang === 'el' ? (categoryTranslations[cat]?.el || cat) : (categoryTranslations[cat]?.en || cat)}
                </option>
              ))}
            </select>
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              {txt.edit_website}
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
              {txt.edit_logo}
            </label>
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24 rounded-lg border-2 border-slate-300 overflow-hidden bg-slate-100 flex items-center justify-center">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-200">
                    <span className="text-slate-500 text-xs font-medium">
                      {lang === 'el' ? 'ΧΩΡΙΣ ΛΟΓΟ' : 'NO LOGO'}
                    </span>
                  </div>
                )}
                {logoPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="flex-1">
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <span className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
                    {txt.upload_logo}
                  </span>
                </label>
                <p className="text-xs text-slate-500 mt-1">
                  {lang === 'el' ? 'PNG, JPG, GIF έως 5MB' : 'PNG, JPG, GIF up to 5MB'}
                </p>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
            >
              {txt.cancel}
            </button>
            <button
              type="submit"
              disabled={updating || uploadingLogo}
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updating || uploadingLogo ? (lang === 'el' ? 'Αποθήκευση...' : 'Saving...') : txt.save_changes}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BrandDashboardContent() {
  const [lang, setLang] = useState<'el' | 'en'>('el'); // Default to Greek, will be updated in useEffect
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [influencers, setInfluencers] = useState<Record<string, Influencer>>({});
  const [loading, setLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  // Load language from localStorage on client-side
  useEffect(() => {
    setLang(getStoredLanguage());
  }, []);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [savingAgreement, setSavingAgreement] = useState(false);
  const [processingCounterProposal, setProcessingCounterProposal] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [brandData, setBrandData] = useState<any>(null);

  // Update brand presence when brand is logged in (similar to influencer presence)
  useEffect(() => {
    console.log('[Brand Dashboard] Presence useEffect triggered, brandData:', brandData);
    
    if (!brandData?.contact_email) {
      console.log('[Brand Dashboard] No brandData or contact_email, skipping presence updates');
      return;
    }

    console.log(`[Brand Dashboard] Starting presence updates for: ${brandData.contact_email}`);

    const updateBrandPresence = async () => {
      try {
        const now = new Date().toISOString();
        const email = brandData.contact_email.toLowerCase().trim();
        console.log(`[Brand Dashboard] Updating presence for ${email} at ${now}`);
        
        const { error } = await supabase
          .from('brand_presence')
          .upsert({
            brand_email: email,
            is_online: true,
            last_seen: now,
            updated_at: now,
          }, {
            onConflict: 'brand_email'
          });
        
        if (error) {
          console.error('[Brand Dashboard] Error updating presence:', error);
        } else {
          console.log(`[Brand Dashboard] Successfully updated presence for ${email} at ${now} - is_online: true`);
        }
      } catch (error) {
        console.error('[Brand Dashboard] Exception updating presence:', error);
      }
    };

    // Update immediately when component mounts or brandData changes
    console.log('[Brand Dashboard] Calling updateBrandPresence immediately');
    updateBrandPresence();

    // Update every 3 seconds to keep brand online (more frequent than 5 seconds for reliability)
    const interval = setInterval(updateBrandPresence, 3000);

    // Handle browser close/tab close
    const handleBeforeUnload = async () => {
      try {
        await supabase
          .from('brand_presence')
          .update({
            is_online: false,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('brand_email', brandData.contact_email.toLowerCase().trim());
      } catch (error) {
        // Fail silently
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden - mark as offline after a delay
        setTimeout(async () => {
          if (document.hidden) {
            try {
              await supabase
                .from('brand_presence')
                .update({
                  is_online: false,
                  last_seen: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('brand_email', brandData.contact_email.toLowerCase().trim());
            } catch (error) {
              // Fail silently
            }
          }
        }, 60000); // 1 minute after tab becomes hidden
      } else {
        // Tab is visible again - mark as online
        updateBrandPresence();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Mark as offline when component unmounts
      (async () => {
        try {
          await supabase
            .from('brand_presence')
            .update({
              is_online: false,
              last_seen: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('brand_email', brandData.contact_email.toLowerCase().trim());
        } catch (error) {
          // Fail silently
        }
      })();
    };
  }, [brandData?.contact_email]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [recommendationFilters, setRecommendationFilters] = useState({
    minScore: 40,
    maxPrice: null as number | null,
    category: '',
    minEngagement: 0,
    minRating: 0,
    platform: '', // Filter by platform (instagram, tiktok, youtube, etc.)
  });
  const [showFilters, setShowFilters] = useState(false);
  // Load stats from localStorage on mount
  type RecommendationStats = {
    totalViewed: number;
    profilesClicked: number;
    proposalsSent: number;
  };
  
  const [recommendationStats, setRecommendationStats] = useState<RecommendationStats>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('brandDashboardStats');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Error parsing saved stats:', e);
        }
      }
    }
    return {
      totalViewed: 0,
      profilesClicked: 0,
      proposalsSent: 0,
    };
  });

  // Save stats to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('brandDashboardStats', JSON.stringify(recommendationStats));
    }
  }, [recommendationStats]);
  const [activeTab, setActiveTab] = useState<'recommendations' | 'campaigns' | 'proposals' | 'messages'>('recommendations');
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const router = useRouter();
  const txt = t[lang];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (brandData?.contact_email) {
      loadUnreadMessageCount();
      // Poll for unread messages every 10 seconds
      const interval = setInterval(loadUnreadMessageCount, 10000);
      return () => clearInterval(interval);
    }
  }, [brandData?.contact_email]);

  const loadUnreadMessageCount = async () => {
    if (!brandData?.contact_email) {
      setUnreadMessageCount(0);
      return;
    }
    
    try {
      // Get all conversations for this brand
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('brand_email', brandData.contact_email.toLowerCase().trim());

      if (convError) {
        console.error('Error loading conversations:', convError);
        setUnreadMessageCount(0);
        return;
      }

      if (!conversations || conversations.length === 0) {
        setUnreadMessageCount(0);
        return;
      }

      // Count unread messages (messages from influencer that are not read)
      const conversationIds = conversations.map(c => c.id);
      const { data: unreadMessages, error } = await supabase
        .from('messages')
        .select('id')
        .in('conversation_id', conversationIds)
        .eq('sender_type', 'influencer')
        .eq('read', false);

      if (error) {
        console.error('Error loading unread messages:', error);
        setUnreadMessageCount(0);
        return;
      }

      setUnreadMessageCount(unreadMessages?.length || 0);
    } catch (error) {
      console.error('Error loading unread message count:', error);
      setUnreadMessageCount(0);
    }
  };

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Get brand data
      const { data: brandData } = await supabase
        .from('brands')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!brandData) {
        router.push('/login');
        return;
      }

      console.log(`[Brand Dashboard] Loaded brandData:`, brandData);
      console.log(`[Brand Dashboard] Brand email: ${brandData.contact_email}`);
      setBrandData(brandData);
      
      // Load recommendations
      await loadRecommendations(brandData);

      // Get proposals for this brand (by email or brand_id)
      const { data: proposalsData, error: proposalsError } = await supabase
        .from('proposals')
        .select('*')
        .or(`brand_email.eq.${brandData.contact_email},brand_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (proposalsError) throw proposalsError;

      if (proposalsData) {
        setProposals(proposalsData as Proposal[]);

        // Get unique influencer IDs
        const influencerIds = [...new Set(proposalsData.map((p: Proposal) => p.influencer_id))];

        // Fetch influencer data
        if (influencerIds.length > 0) {
          const { data: influencersData } = await supabase
            .from('influencers')
            .select('id, display_name, avatar_url')
            .in('id', influencerIds);

          if (influencersData) {
            const influencersMap: Record<string, Influencer> = {};
            influencersData.forEach((inf: Influencer) => {
              influencersMap[inf.id] = inf;
            });
            setInfluencers(influencersMap);
          }
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptAgreement = async () => {
    if (!selectedProposal || !agreementAccepted) {
      alert(lang === 'el' 
        ? 'Παρακαλώ αποδεχτείτε τους όρους χρήσης' 
        : 'Please accept the terms of service');
      return;
    }

    setSavingAgreement(true);
    try {
      const response = await fetch('/api/proposals/agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: selectedProposal.id,
          userType: 'brand',
          accepted: true
        })
      });

      const result = await response.json();
      if (result.success) {
        await loadData();
        setShowAgreementModal(false);
        setSelectedProposal(null);
        setAgreementAccepted(false);
        alert(lang === 'el' 
          ? 'Η συμφωνία αποδεχτήθηκε!' 
          : 'Agreement accepted!');
      } else {
        throw new Error(result.error || 'Error accepting agreement');
      }
    } catch (err: any) {
      console.error('Error accepting agreement:', err);
      alert(err.message || txt.error);
    } finally {
      setSavingAgreement(false);
    }
  };

  const loadRecommendations = async (brand: any) => {
    setRecommendationsLoading(true);
    try {
      // First, let's check all influencers to see their approved status
      const { data: allInfluencers, error: allError } = await supabase
        .from('influencers')
        .select('id, display_name, approved, verified')
        .limit(50);
      
      console.log('[Brand Dashboard] All influencers (first 50):', allInfluencers);
      console.log('[Brand Dashboard] Approved count:', allInfluencers?.filter(inf => inf.approved === true).length);
      console.log('[Brand Dashboard] Verified count:', allInfluencers?.filter(inf => inf.verified === true).length);
      console.log('[Brand Dashboard] Unapproved count:', allInfluencers?.filter(inf => inf.approved === false || inf.approved === null).length);
      
      // Fetch only approved influencers from database (same as Directory)
      const { data: influencersData, error } = await supabase
        .from('influencers')
        .select('id, display_name, category, engagement_rate, avg_likes, min_rate, location, gender, avg_rating, total_reviews, verified, approved, analytics_verified, accounts, avatar_url, audience_male_percent, audience_female_percent, audience_top_age, bio, auditpr_audit')
        .eq('approved', true) // Only approved influencers (same as Directory)
        .order('created_at', { ascending: false }) // Sort by creation date
        .limit(200);
      
      if (error) throw error;
      
      // Debug: Log fetched influencers
      console.log('[Brand Dashboard] Fetched approved influencers from DB:', influencersData?.length || 0);
      console.log('[Brand Dashboard] All fetched influencers:', influencersData?.map(inf => ({ name: inf.display_name, approved: inf.approved, verified: inf.verified, id: inf.id })));
      console.log('[Brand Dashboard] Sample influencer:', influencersData?.[0]);
      
      // Helper function to parse follower string
      const parseFollowerString = (str: string) => {
        if (!str) return 0;
        const clean = str.toLowerCase().replace(/,/g, '').trim();
        if (clean.includes('k')) return parseFloat(clean) * 1000;
        if (clean.includes('m')) return parseFloat(clean) * 1000000;
        return parseFloat(clean) || 0;
      };
      
      // Build engagement_rate, followers, avg_likes from accounts (same source as influencer profile page) so metrics match
      const buildMetricsFromAccounts = (accounts: any[] | null) => {
        const engagementRates: { [key: string]: string } = {};
        const avgLikes: { [key: string]: string } = {};
        let maxFollowers = 0;
        let followersStr = '0';
        if (!Array.isArray(accounts)) return { engagement_rate: undefined as string | { [key: string]: string } | undefined, followers_count: '0', avg_likes: undefined as string | { [key: string]: string } | undefined };
        accounts.forEach((acc: any) => {
          if (!acc?.platform) return;
          const platform = acc.platform.toLowerCase();
          if (acc.followers) {
            const n = parseFollowerString(acc.followers);
            if (n > maxFollowers) {
              maxFollowers = n;
              followersStr = acc.followers;
            }
          }
          if (acc.engagement_rate) engagementRates[platform] = acc.engagement_rate;
          if (acc.avg_likes) avgLikes[platform] = acc.avg_likes;
        });
        const engagement_rate = Object.keys(engagementRates).length > 0 ? engagementRates : undefined;
        const avg_likes = Object.keys(avgLikes).length > 0 ? avgLikes : undefined;
        return { engagement_rate, followers_count: followersStr, avg_likes };
      };

      // Convert database influencers to InfluencerProfile format (metrics from accounts = same as profile page)
      const dbInfluencerProfiles: InfluencerProfile[] = (influencersData || []).map((inf: any) => {
        const platformFilter = recommendationFilters.platform?.toLowerCase();
        let engagement_rate: string | { [key: string]: string } | undefined;
        let followers_count = '0';
        let avg_likes: string | { [key: string]: string } | undefined;

        if (platformFilter && Array.isArray(inf.accounts)) {
          const acc = inf.accounts.find((a: any) => a.platform?.toLowerCase() === platformFilter);
          if (acc) {
            followers_count = acc.followers || '0';
            engagement_rate = acc.engagement_rate ?? inf.engagement_rate;
            avg_likes = acc.avg_likes ?? inf.avg_likes;
          }
        } else {
          const fromAccounts = buildMetricsFromAccounts(inf.accounts);
          engagement_rate = fromAccounts.engagement_rate ?? inf.engagement_rate;
          followers_count = fromAccounts.followers_count;
          avg_likes = fromAccounts.avg_likes ?? inf.avg_likes;
        }

        return {
          id: inf.id,
          display_name: inf.display_name || 'Unknown',
          category: inf.category,
          categories: inf.category
            ? (inf.category.includes(',') ? inf.category.split(',').map((c: string) => c.trim()) : [inf.category])
            : undefined,
          engagement_rate,
          followers_count,
          avg_likes,
          min_rate: inf.min_rate,
          location: inf.location,
          gender: inf.gender,
          avg_rating: inf.avg_rating,
          total_reviews: inf.total_reviews || 0,
          past_brands: inf.total_reviews || 0,
          verified: inf.analytics_verified || inf.verified || false,
          accounts: inf.accounts,
          avatar_url: inf.avatar_url,
          audience_male_percent: inf.audience_male_percent,
          audience_female_percent: inf.audience_female_percent,
          audience_top_age: inf.audience_top_age,
          bio: inf.bio,
          rate_card: undefined,
          auditpr_audit: inf.auditpr_audit ?? undefined,
        };
      }).filter(inf => {
        // Filter out influencers that don't have the selected platform
        if (recommendationFilters.platform && inf.followers_count === '0') {
          return false;
        }
        return true;
      });
      
      // Category mapping from dummy data to standard categories
      // Use only database influencers
      const influencerProfiles: InfluencerProfile[] = dbInfluencerProfiles;
      
      // Debug: Log influencers
      console.log('[Brand Dashboard] Total influencers:', influencerProfiles.length);
      console.log('[Brand Dashboard] Verified influencers:', influencerProfiles.filter(inf => inf.verified).length);
      
      // Process recommendations
      // Get brand profile
      const brandProfile: BrandProfile = {
        id: brand.id,
        brand_name: brand.brand_name,
        industry: brand.industry, // This is actually the category
        category: brand.industry, // For clarity
        contact_email: brand.contact_email,
      };
      
      // Apply filters
      let filteredProfiles = influencerProfiles;
      
      if (recommendationFilters.category) {
        filteredProfiles = filteredProfiles.filter(inf => {
          // Support "Γενικά" / "General" - matches all
          if (recommendationFilters.category === "Γενικά" || recommendationFilters.category === "General") {
            return true; // Show all
          }
          
          // Check primary category
          if (inf.category === recommendationFilters.category) {
            return true;
          }
          
          // Check all categories if available
          if (inf.categories && inf.categories.includes(recommendationFilters.category)) {
            return true;
          }
          
          return false;
        });
      }
      
      if (recommendationFilters.maxPrice) {
        filteredProfiles = filteredProfiles.filter(inf => {
          const rate = parseFloat(inf.min_rate?.replace(/[€$,\s]/g, '') || '0');
          return !isNaN(rate) && rate <= recommendationFilters.maxPrice!;
        });
      }
      
      if (recommendationFilters.minEngagement > 0) {
        filteredProfiles = filteredProfiles.filter(inf => {
          // Use platform-specific engagement rate if platform filter is set
          let engagementRateStr: string | null = null;
          
          // If engagement_rate is an object (per-platform), use the filtered platform's rate
          if (inf.engagement_rate && typeof inf.engagement_rate === 'object' && !Array.isArray(inf.engagement_rate)) {
            if (recommendationFilters.platform) {
              const platformLower = recommendationFilters.platform.toLowerCase();
              engagementRateStr = inf.engagement_rate[platformLower] || null;
            } else {
              // If no platform filter, calculate average or use first available
              const rates = Object.values(inf.engagement_rate).filter(v => v && v !== '-');
              engagementRateStr = rates.length > 0 ? rates[0] : null;
            }
          } else if (typeof inf.engagement_rate === 'string') {
            engagementRateStr = inf.engagement_rate;
          }
          
          const rate = engagementRateStr ? parseFloat(engagementRateStr.replace('%', '').replace(',', '.')) : 0;
          return !isNaN(rate) && rate >= recommendationFilters.minEngagement;
        });
      }
      
      // Filter by platform if specified
      if (recommendationFilters.platform) {
        filteredProfiles = filteredProfiles.filter(inf => {
          if (!inf.accounts || !Array.isArray(inf.accounts)) return false;
          const platformLower = recommendationFilters.platform.toLowerCase();
          return inf.accounts.some((acc: any) => 
            acc.platform?.toLowerCase() === platformLower
          );
        });
      }
      
      if (recommendationFilters.minRating > 0) {
        filteredProfiles = filteredProfiles.filter(inf => 
          (inf.avg_rating || 0) >= recommendationFilters.minRating
        );
      }
      
      // Calculate recommendations
      console.log('[Brand Dashboard] Brand profile:', brandProfile);
      console.log('[Brand Dashboard] Filtered profiles count:', filteredProfiles.length);
      console.log('[Brand Dashboard] Sample filtered profile:', filteredProfiles[0]);
      
      const matches = recommendInfluencers(brandProfile, filteredProfiles, {
        limit: 12,
        minScore: recommendationFilters.minScore,
        preferVerified: true,
        preferHighRating: true,
        lang: lang,
      });
      
      console.log('[Brand Dashboard] Recommendations count:', matches.length);
      console.log('[Brand Dashboard] Recommendations:', matches.map(m => ({ name: m.influencer.display_name, score: m.score, verified: m.influencer.verified })));
      
      setRecommendations(matches);
      
      // Update stats - count only displayed recommendations (not cumulative)
      setRecommendationStats((prev: RecommendationStats) => ({
        ...prev,
        totalViewed: matches.length, // Current session count, not cumulative
      }));
    } catch (err) {
      console.error('Error loading recommendations:', err);
    } finally {
      setRecommendationsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Get current user before signing out
      const { data: { user } } = await supabase.auth.getUser();
      
      // Mark brand as offline if they are a brand
      if (user && brandData?.contact_email) {
        try {
          await supabase
            .from('brand_presence')
            .update({
              is_online: false,
              last_seen: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('brand_email', brandData.contact_email.toLowerCase().trim());
          console.log('[Logout] Marked brand as offline:', brandData.contact_email);
        } catch (err) {
          // Fail silently - don't block logout if presence update fails
          console.error('[Logout] Error marking brand offline:', err);
        }
      }
    } catch (err) {
      console.error('[Logout] Error getting user before logout:', err);
    }
    
    await supabase.auth.signOut();
    router.push('/brand/login');
  };

  const handleUpdateProfile = async (updatedData: any) => {
    if (!brandData) return;
    
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('brands')
        .update({
          brand_name: updatedData.brand_name,
          contact_person: updatedData.contact_person || null,
          website: updatedData.website || null,
          industry: updatedData.category || null,
          logo_url: updatedData.logo_url || null,
          // Note: afm and contact_email should not be changed typically
        })
        .eq('id', brandData.id);

      if (error) throw error;

      // Reload brand data
      await loadData();
      setShowEditModal(false);
      
      alert(lang === 'el' ? txt.profile_updated : txt.profile_updated);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      alert(lang === 'el' ? txt.error_updating : txt.error_updating + ': ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  // Get pending agreements (where influencer accepted but brand hasn't)
  const pendingAgreements = proposals.filter(
    p => p.influencer_agreement_accepted && !p.brand_agreement_accepted && 
    (p.status === 'accepted' || p.status === 'completed')
  );

  // Get pending counter proposals (where influencer sent counter proposal and brand hasn't responded)
  const pendingCounterProposals = proposals.filter(
    p => p.counter_proposal_status === 'pending' && p.counter_proposal_budget
  );

  const handleAcceptCounterProposal = async (proposalId: string) => {
    setProcessingCounterProposal(proposalId);
    try {
      const response = await fetch('/api/proposals/counter/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId })
      });

      const result = await response.json();
      if (result.success) {
        await loadData();
        alert(lang === 'el' 
          ? 'Η αντιπρόταση αποδεχθηκε επιτυχώς!' 
          : 'Counter proposal accepted successfully!');
      } else {
        throw new Error(result.error || 'Error accepting counter proposal');
      }
    } catch (err: any) {
      console.error('Error accepting counter proposal:', err);
      alert(err.message || (lang === 'el' ? 'Σφάλμα αποδοχής αντιπρότασης' : 'Error accepting counter proposal'));
    } finally {
      setProcessingCounterProposal(null);
    }
  };

  const handleRejectCounterProposal = async (proposalId: string) => {
    if (!confirm(lang === 'el' 
      ? 'Είστε σίγουρος ότι θέλετε να απορρίψετε την αντιπρόταση;'
      : 'Are you sure you want to reject the counter proposal?')) {
      return;
    }

    setProcessingCounterProposal(proposalId);
    try {
      const response = await fetch('/api/proposals/counter/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId })
      });

      const result = await response.json();
      if (result.success) {
        await loadData();
        alert(lang === 'el' 
          ? 'Η αντιπρόταση απορρίφθηκε.' 
          : 'Counter proposal rejected.');
      } else {
        throw new Error(result.error || 'Error rejecting counter proposal');
      }
    } catch (err: any) {
      console.error('Error rejecting counter proposal:', err);
      alert(err.message || (lang === 'el' ? 'Σφάλμα απόρριψης αντιπρότασης' : 'Error rejecting counter proposal'));
    } finally {
      setProcessingCounterProposal(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">{txt.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PushNotificationPrompt userType="brand" userIdentifier={brandData?.contact_email || ''} lang={lang} />
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center gap-4 sm:gap-6">
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Image 
                  src="/logo.svg" 
                  alt="Influo.gr Logo" 
                  width={120} 
                  height={48} 
                  className="h-6 sm:h-8 w-auto"
                />
              </Link>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{txt.title}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <Link
                href="/"
                className="text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
              >
                {lang === "el" ? "🏠 Αρχική" : "🏠 Home"}
              </Link>
              <Link
                href="/help-desk"
                className="text-xs sm:text-sm font-medium text-purple-600 hover:text-purple-700 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-purple-50 transition-colors border border-purple-200"
              >
                📧 Help Desk
              </Link>
              <button
                onClick={() => setShowEditModal(true)}
                className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-blue-50 transition-colors border border-blue-200"
              >
                {txt.edit_profile}
              </button>
              <button
                onClick={() => {
                  const newLang = lang === 'el' ? 'en' : 'el';
                  setLang(newLang);
                  setStoredLanguage(newLang);
                }}
                className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 px-2 sm:px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
              >
                {lang === 'el' ? 'EN' : 'ΕΛ'}
              </button>
              <button
                onClick={handleLogout}
                className="text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                {txt.logout}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Tabs */}
        <div className="bg-white rounded-xl border border-slate-200 mb-6 overflow-hidden">
          <div className="border-b border-slate-200 overflow-x-auto">
            <div className="flex min-w-max sm:min-w-0">
              <button
                onClick={() => setActiveTab('recommendations')}
                className={`px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'recommendations'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {lang === 'el' ? '🤖 Προτάσεις' : '🤖 Recommendations'}
              </button>
              <button
                onClick={() => setActiveTab('campaigns')}
                className={`px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'campaigns'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {lang === 'el' ? '📣 Καμπάνιες' : '📣 Campaigns'}
              </button>
              <button
                onClick={() => setActiveTab('proposals')}
                className={`px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium border-b-2 transition-colors whitespace-nowrap relative ${
                  activeTab === 'proposals'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {lang === 'el' ? '📋 Προσφορές' : '📋 Proposals'}
                {(pendingAgreements.length > 0 || pendingCounterProposals.length > 0) && (
                  <span className="ml-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[16px] sm:min-w-[18px] h-[16px] sm:h-[18px] flex items-center justify-center px-1">
                    {pendingAgreements.length + pendingCounterProposals.length > 99 ? '99+' : pendingAgreements.length + pendingCounterProposals.length}
                  </span>
                )}
              </button>
              <button
                onClick={async () => {
                  setActiveTab('messages');
                  // Mark all unread messages as read when clicking Messages tab
                  if (unreadMessageCount > 0 && brandData?.contact_email) {
                    try {
                      // Get all conversations for this brand
                      const { data: conversations } = await supabase
                        .from('conversations')
                        .select('id')
                        .eq('brand_email', brandData.contact_email.toLowerCase().trim());

                      if (conversations && conversations.length > 0) {
                        const conversationIds = conversations.map(c => c.id);
                        // Mark all unread messages from influencer as read
                        await supabase
                          .from('messages')
                          .update({ read: true })
                          .in('conversation_id', conversationIds)
                          .eq('sender_type', 'influencer')
                          .eq('read', false);
                        // Reload count to update badge
                        loadUnreadMessageCount();
                      }
                    } catch (error) {
                      console.error('Error marking messages as read:', error);
                    }
                  }
                }}
                className={`px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium border-b-2 transition-colors relative whitespace-nowrap ${
                  activeTab === 'messages'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {lang === 'el' ? '💬 Μηνύματα' : '💬 Messages'}
                {unreadMessageCount > 0 && (
                  <span className="absolute top-1.5 sm:top-2 right-1 sm:right-2 bg-red-500 text-white text-[10px] sm:text-xs font-bold rounded-full min-w-[16px] sm:min-w-[18px] h-[16px] sm:h-[18px] flex items-center justify-center px-1">
                    {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {activeTab === 'campaigns' && brandData && (
          <div className="mb-12">
            <BrandCampaignsSection
              brandId={brandData.id}
              lang={lang}
              brandVerified={!!brandData.verified}
            />
          </div>
        )}

        {/* Recommendations Section */}
        {activeTab === 'recommendations' && (
        <div className="mb-12">
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">{txt.recommendations_title}</h2>
              <p className="text-slate-500 text-sm mt-1">{txt.recommendations_subtitle}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <span aria-hidden>🔍</span>
                {txt.filters}
              </button>
              <button
                onClick={() => brandData && loadRecommendations(brandData)}
                disabled={recommendationsLoading}
                className="px-3 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <span className={recommendationsLoading ? 'animate-spin' : ''} aria-hidden>↻</span>
                {txt.refresh}
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-6">
              <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{txt.min_score}</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={recommendationFilters.minScore}
                    onChange={(e) => setRecommendationFilters({...recommendationFilters, minScore: parseInt(e.target.value) || 40})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{txt.max_price}</label>
                  <input
                    type="number"
                    min="0"
                    value={recommendationFilters.maxPrice || ''}
                    onChange={(e) => setRecommendationFilters({...recommendationFilters, maxPrice: e.target.value ? parseInt(e.target.value) : null})}
                    placeholder="Όχι όριο"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{txt.category_filter}</label>
                  <select
                    value={recommendationFilters.category}
                    onChange={(e) => setRecommendationFilters({...recommendationFilters, category: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
                  >
                    <option value="">{lang === 'el' ? 'Όλες οι κατηγορίες' : 'All Categories'}</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {lang === 'el' ? categoryTranslations[cat]?.el || cat : categoryTranslations[cat]?.en || cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{txt.min_engagement}</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={recommendationFilters.minEngagement}
                    onChange={(e) => setRecommendationFilters({...recommendationFilters, minEngagement: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{txt.min_rating}</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={recommendationFilters.minRating}
                    onChange={(e) => setRecommendationFilters({...recommendationFilters, minRating: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Πλατφόρμα' : 'Platform'}</label>
                  <select
                    value={recommendationFilters.platform}
                    onChange={(e) => setRecommendationFilters({...recommendationFilters, platform: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
                  >
                    <option value="">{lang === 'el' ? 'Όλες' : 'All'}</option>
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="youtube">YouTube</option>
                    <option value="twitter">Twitter/X</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => brandData && loadRecommendations(brandData)}
                  className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {txt.apply_filters}
                </button>
                <button
                  onClick={() => {
                    setRecommendationFilters({
                      minScore: 40,
                      maxPrice: null,
                      category: '',
                      minEngagement: 0,
                      minRating: 0,
                      platform: '',
                    });
                    if (brandData) loadRecommendations(brandData);
                  }}
                  className="px-6 py-2 bg-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-300 transition-colors"
                >
                  {txt.clear_filters}
                </button>
              </div>
            </div>
          )}

          {/* Stats – compact */}
          {recommendationStats.totalViewed > 0 && (
            <div className="flex flex-wrap gap-6 mb-6 text-sm text-slate-600">
              <span><strong className="text-slate-900">{recommendationStats.totalViewed}</strong> {txt.total_viewed}</span>
              <span><strong className="text-slate-900">{recommendationStats.profilesClicked}</strong> {txt.profiles_clicked}</span>
              <span><strong className="text-slate-900">{recommendationStats.proposalsSent}</strong> {txt.proposals_sent}</span>
            </div>
          )}
          
          {recommendationsLoading ? (
            <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">{txt.recommendations_loading}</p>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
              <p className="text-slate-600">{txt.recommendations_empty}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {recommendations.map((match, index) => {
                const inf = match.influencer;
                // Priority: 1) avatar_url from DB (via proxy to reduce Supabase egress), 2) Instagram/unavatar, 3) fallback to initials
                let avatarUrl = getCachedImageUrl(inf.avatar_url) ?? inf.avatar_url;
                if (!avatarUrl && inf.accounts && Array.isArray(inf.accounts)) {
                  // Try to find Instagram username first
                  const instagramAccount = inf.accounts.find((acc: any) => 
                    acc.platform?.toLowerCase() === 'instagram' || acc.platform?.toLowerCase() === 'instagram'
                  );
                  if (instagramAccount?.username) {
                    avatarUrl = `https://unavatar.io/instagram/${instagramAccount.username}`;
                  } else if (inf.accounts[0]?.username) {
                    // Fallback to first account username
                    avatarUrl = `https://unavatar.io/${inf.accounts[0].username}`;
                  }
                }
                // Final fallback: generate avatar with initials
                if (!avatarUrl) {
                  avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(inf.display_name)}&background=random&size=256`;
                }
                
                return (
                  <div
                    key={inf.id}
                    className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all overflow-hidden"
                  >
                    <div className="relative">
                      <div className="absolute top-2 right-2 z-10">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold text-white ${
                          match.score >= 80 ? 'bg-emerald-600' :
                          match.score >= 65 ? 'bg-blue-600' :
                          'bg-slate-500'
                        }`}>
                          {match.score}% {lang === 'el' ? 'Match' : 'Match'}
                        </span>
                      </div>
                      
                      {/* Avatar */}
                      <div className="relative h-48 bg-gradient-to-br from-blue-100 to-purple-100">
                        <Image
                          src={avatarUrl}
                          alt={displayNameForLang(inf.display_name, lang)}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        <div className="absolute bottom-3 left-3 right-3">
                          <h3 className="text-white font-bold text-lg mb-1.5">{displayNameForLang(inf.display_name, lang)}</h3>
                          {(inf.categories && inf.categories.length > 0 ? inf.categories : (inf.category ? [inf.category] : [])).slice(0, 3).map((cat: string, idx: number) => (
                            <span key={idx} className="inline-block px-2 py-1 bg-white/20 backdrop-blur-sm rounded text-xs text-white font-medium mr-1 mb-1">
                              {lang === 'el' ? 
                                (categoryTranslations[cat]?.el || cat) : 
                                (categoryTranslations[cat]?.en || cat)
                              }
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="p-4">
                      {/* Stats – Followers, Engagement, Avg Likes only (reviews stay in algorithm, not shown) */}
                      <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                        {inf.followers_count && inf.followers_count !== '0' && (
                          <div>
                            <div className="text-slate-500 uppercase tracking-wide">{txt.followers}</div>
                            <div className="font-semibold text-slate-900">{inf.followers_count}</div>
                          </div>
                        )}
                        {(inf.engagement_rate && (typeof inf.engagement_rate === 'object' ? Object.keys(inf.engagement_rate).length > 0 : true)) && (
                          <div>
                            <div className="text-slate-500 uppercase tracking-wide">{txt.engagement_rate}</div>
                            <div className="font-semibold text-slate-900">
                              {typeof inf.engagement_rate === 'object' && inf.engagement_rate !== null && !Array.isArray(inf.engagement_rate)
                                ? (Object.entries(inf.engagement_rate) as [string, string][]).map(([platform, rate]) => {
                                    const r = rate && !String(rate).includes('%') ? `${rate}%` : rate;
                                    const label = platform === 'instagram' ? 'IG' : platform === 'tiktok' ? 'TT' : platform.slice(0, 2).toUpperCase();
                                    return `${label} ${r}`;
                                  }).join(' · ')
                                : (inf.engagement_rate && !String(inf.engagement_rate).includes('%') ? `${inf.engagement_rate}%` : inf.engagement_rate)}
                            </div>
                          </div>
                        )}
                        {inf.avg_likes && (typeof inf.avg_likes === 'object' ? Object.keys(inf.avg_likes).length > 0 : inf.avg_likes) && (
                          <div>
                            <div className="text-slate-500 uppercase tracking-wide">{lang === 'el' ? 'Μ.Ο. Likes' : 'Avg Likes'}</div>
                            <div className="font-semibold text-slate-900">
                              {typeof inf.avg_likes === 'object' && inf.avg_likes !== null && !Array.isArray(inf.avg_likes)
                                ? (Object.entries(inf.avg_likes) as [string, string][]).map(([platform, val]) => {
                                    const label = platform === 'instagram' ? 'IG' : platform === 'tiktok' ? 'TT' : platform.slice(0, 2).toUpperCase();
                                    return `${label} ${val}`;
                                  }).join(' · ')
                                : inf.avg_likes}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Match Reasons */}
                      <div className="mb-4">
                        <p className="text-xs font-medium text-slate-500 mb-1.5">{txt.why_match}</p>
                        <ul className="space-y-1">
                          {match.reasons.slice(0, 3).map((reason: string, i: number) => (
                            <li key={i} className="text-xs text-slate-700 flex items-start gap-2">
                              <span className="text-emerald-500 shrink-0 mt-0.5" aria-hidden>•</span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-2">
                        <Link
                          href={`/influencer/${inf.id}`}
                          onClick={async () => {
                            // Set session flag to indicate user is brand
                            if (typeof window !== 'undefined') {
                              sessionStorage.setItem('isBrand', 'true');
                            }
                            setRecommendationStats((prev: RecommendationStats) => {
                              const updated = {...prev, profilesClicked: prev.profilesClicked + 1};
                              // Save to localStorage immediately
                              if (typeof window !== 'undefined') {
                                localStorage.setItem('brandDashboardStats', JSON.stringify(updated));
                              }
                              return updated;
                            });
                            
                            // Track profile_click analytics
                            try {
                              const { data: { user } } = await supabase.auth.getUser();
                              const brandEmail = user?.email || null;
                              let brandName = null;
                              if (brandEmail) {
                                const { data: brandData } = await supabase
                                  .from('brands')
                                  .select('brand_name')
                                  .or(`contact_email.ilike.${brandEmail},email.ilike.${brandEmail}`)
                                  .maybeSingle();
                                brandName = brandData?.brand_name || null;
                              }
                              
                              fetch('/api/analytics/track', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  influencerId: inf.id,
                                  eventType: 'profile_click',
                                  brandEmail: brandEmail,
                                  brandName: brandName,
                                  metadata: { source: 'brand_dashboard' }
                                }),
                                keepalive: true
                              }).catch(() => {});
                            } catch (err) {
                              // Fail silently
                            }
                          }}
                          className="flex-1 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg text-center transition-colors"
                        >
                          {txt.view_profile}
                        </Link>
                        <Link
                          href={`/influencer/${inf.id}#proposal`}
                          onClick={() => {
                            // Set session flag to indicate user is brand
                            if (typeof window !== 'undefined') {
                              sessionStorage.setItem('isBrand', 'true');
                            }
                            // Note: proposalsSent is now updated only after successful proposal submission
                          }}
                          className="flex-1 px-3 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg text-center transition-colors"
                        >
                          {txt.send_proposal}
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </div>
        )}

        {/* Messages Section */}
        {activeTab === 'messages' && brandData && (
          <div className="mb-12">
            <Messaging
              influencerId={undefined as any}
              influencerName=""
              influencerEmail=""
              brandEmail={brandData.contact_email}
              brandName={brandData.brand_name}
              proposalId={undefined}
              mode="brand"
              lang={lang}
              onUnreadCountChange={setUnreadMessageCount}
            />
          </div>
        )}

        {/* Proposals Section */}
        {activeTab === 'proposals' && (
        <div className="mb-6 space-y-8">
          {/* Pending Counter Proposals */}
          {pendingCounterProposals.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                {lang === 'el' ? '💰 Αντιπροτάσεις που Αναμένουν Απόκριση' : '💰 Counter Proposals Pending Response'}
              </h2>
              <div className="space-y-4">
                {pendingCounterProposals.map((proposal) => {
                  const influencer = influencers[proposal.influencer_id];
                  const isProcessing = processingCounterProposal === proposal.id;
                  return (
                    <div
                      key={proposal.id}
                      className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-6 border-2 border-amber-200 hover:shadow-lg transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded">ΝΕΑ</span>
                            <h3 className="text-lg font-bold text-slate-900">
                              {displayNameForLang(influencer?.display_name, lang) || 'Unknown Influencer'}
                            </h3>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                            <div>
                              <span className="text-slate-500">{txt.service}:</span>{' '}
                              <span className="font-medium text-slate-900">{proposal.service_type}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">{lang === 'el' ? 'Προσφερόμενη Τιμή:' : 'Original Price:'}</span>{' '}
                              <span className="font-medium text-slate-600 line-through">€{proposal.budget}</span>
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-4 mb-3 border border-amber-300">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600 text-sm font-medium">{lang === 'el' ? 'Αντιπρόταση:' : 'Counter Proposal:'}</span>
                              <span className="text-amber-700 text-xl font-bold">€{proposal.counter_proposal_budget}</span>
                            </div>
                            {proposal.counter_proposal_message && (
                              <div className="mt-3 pt-3 border-t border-amber-200">
                                <p className="text-xs text-slate-500 mb-1">{lang === 'el' ? 'Σχόλιο:' : 'Comment:'}</p>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{proposal.counter_proposal_message}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleAcceptCounterProposal(proposal.id)}
                          disabled={isProcessing}
                          className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                          {isProcessing ? (lang === 'el' ? 'Επεξεργασία...' : 'Processing...') : (lang === 'el' ? '✅ Αποδοχή Αντιπρότασης' : '✅ Accept Counter Proposal')}
                        </button>
                        <button
                          onClick={() => handleRejectCounterProposal(proposal.id)}
                          disabled={isProcessing}
                          className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                          {lang === 'el' ? '❌ Απόρριψη' : '❌ Reject'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending Agreements */}
          {pendingAgreements.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-4">{txt.pending_agreements}</h2>
              <div className="space-y-4">
                {pendingAgreements.map((proposal) => {
                  const influencer = influencers[proposal.influencer_id];
                  return (
                    <div
                      key={proposal.id}
                      className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 mb-2">
                            {displayNameForLang(influencer?.display_name, lang) || 'Unknown Influencer'}
                          </h3>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-slate-500">{txt.service}:</span>{' '}
                              <span className="font-medium text-slate-900">{proposal.service_type}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">{txt.budget}:</span>{' '}
                              <span className="font-medium text-slate-900">
                                €{proposal.counter_proposal_budget || proposal.budget}
                              </span>
                            </div>
                          </div>
                          {proposal.description && (
                            <div className="mt-2 text-sm text-slate-600">
                              <span className="text-slate-500">{txt.description}:</span>{' '}
                              {proposal.description}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setSelectedProposal(proposal);
                            setShowAgreementModal(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                          {txt.accept_agreement}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No Pending Items */}
          {pendingAgreements.length === 0 && pendingCounterProposals.length === 0 && (
            <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
              <p className="text-slate-600">{txt.no_pending}</p>
            </div>
          )}
        </div>
        )}

        {/* Edit Profile Modal */}
        {showEditModal && brandData && (
          <EditBrandModal
            brand={brandData}
            onClose={() => setShowEditModal(false)}
            onSave={handleUpdateProfile}
            updating={updating}
            lang={lang}
            txt={txt}
            categories={CATEGORIES}
            categoryTranslations={categoryTranslations}
          />
        )}

      {/* Agreement Modal */}
      {showAgreementModal && selectedProposal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full my-8">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h3 className="text-2xl font-bold text-slate-900">{txt.agreement_terms}</h3>
              <button
                onClick={() => {
                  setShowAgreementModal(false);
                  setSelectedProposal(null);
                  setAgreementAccepted(false);
                }}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Proposal Summary */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
                <h4 className="font-bold text-blue-900 mb-4 text-lg">
                  {lang === 'el' ? 'Σύνοψη Συμφωνίας' : 'Agreement Summary'}
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700 font-medium">{txt.influencer}:</span>
                    <span className="text-blue-900 font-bold">{displayNameForLang(influencers[selectedProposal.influencer_id]?.display_name, lang) || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700 font-medium">{txt.service}:</span>
                    <span className="text-blue-900 font-bold">{selectedProposal.service_type}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700 font-medium">{txt.budget}:</span>
                    <span className="text-blue-900 font-bold text-lg">
                      €{selectedProposal.counter_proposal_budget || selectedProposal.budget}
                    </span>
                  </div>
                  {selectedProposal.description && (
                    <div className="pt-3 border-t border-blue-200">
                      <span className="text-blue-700 font-medium">{txt.description}:</span>
                      <p className="text-blue-800 mt-1">{selectedProposal.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Benefits Section */}
              {lang === 'el' ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                  <h4 className="font-bold text-green-900 mb-4 flex items-center gap-2">
                    <span>✨</span> Τι Κερδίζετε με την Αποδοχή
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">✅</span>
                      <div>
                        <p className="font-semibold text-green-900">Επιβεβαίωση Συνεργασίας</p>
                        <p className="text-sm text-green-700">Η συνεργασία ολοκληρώνεται και ξεκινά η εκπόνηση</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🤝</span>
                      <div>
                        <p className="font-semibold text-green-900">Επαγγελματική Σχέση</p>
                        <p className="text-sm text-green-700">Δημιουργείται επίσημη σχέση συνεργασίας</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">📈</span>
                      <div>
                        <p className="font-semibold text-green-900">Αξιολόγηση</p>
                        <p className="text-sm text-green-700">Θα μπορείτε να αξιολογήσετε τον/την influencer μετά την ολοκλήρωση</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🎯</span>
                      <div>
                        <p className="font-semibold text-green-900">Περιεχόμενο Υψηλής Ποιότητας</p>
                        <p className="text-sm text-green-700">Εγγύηση για την ποιότητα και την προθεσμία παράδοσης</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                  <h4 className="font-bold text-green-900 mb-4 flex items-center gap-2">
                    <span>✨</span> What You Gain by Accepting
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">✅</span>
                      <div>
                        <p className="font-semibold text-green-900">Collaboration Confirmation</p>
                        <p className="text-sm text-green-700">The collaboration is finalized and work begins</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🤝</span>
                      <div>
                        <p className="font-semibold text-green-900">Professional Relationship</p>
                        <p className="text-sm text-green-700">Official collaboration relationship is established</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">📈</span>
                      <div>
                        <p className="font-semibold text-green-900">Review Ability</p>
                        <p className="text-sm text-green-700">You can review the influencer after completion</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🎯</span>
                      <div>
                        <p className="font-semibold text-green-900">High-Quality Content</p>
                        <p className="text-sm text-green-700">Guarantee for quality and delivery deadlines</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Terms & Conditions */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 text-lg">
                  {lang === 'el' ? 'Όροι Χρήσης & Συμφωνία' : 'Terms & Conditions'}
                </h4>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 max-h-96 overflow-y-auto text-sm text-slate-700 space-y-4">
                  {lang === 'el' ? (
                    <>
                      <div>
                        <p className="font-bold text-slate-900 mb-2">1. Υποχρεώσεις Επιχείρησης:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1 text-slate-700">
                          <li>Πληρωμή σύμφωνα με τις προδιαγραφές της συμφωνίας</li>
                          <li>Παροχή όλων των απαραίτητων υλικών και πληροφοριών στον/στην influencer</li>
                          <li>Επικοινωνία σε εύλογο χρόνο για οποιαδήποτε απορία ή αλλαγή</li>
                          <li>Σεβασμός των προθεσμιών και deadlines που έχουν συμφωνηθεί</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900 mb-2">2. Πληρωμή:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1 text-slate-700">
                          <li>Η πληρωμή θα γίνει σύμφωνα με τις προδιαγραφές της προσφοράς</li>
                          <li>Η πληρωμή θα πραγματοποιηθεί μετά την ολοκλήρωση και έγκριση του περιεχομένου</li>
                          <li>Οι όροι πληρωμής αναφέρονται στη συμφωνία</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900 mb-2">3. Δικαιώματα:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1 text-slate-700">
                          <li>Έχετε δικαίωμα έγκρισης/απόρριψης περιεχομένου πριν τη δημοσίευση</li>
                          <li>Μπορείτε να χρησιμοποιήσετε το περιεχόμενο για marketing σκοπούς</li>
                          <li>Ο/Η influencer διατηρεί τα δικαιώματα του περιεχομένου εκτός αν συμφωνηθεί διαφορετικά</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900 mb-2">4. Επικοινωνία & Συνεργασία:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1 text-slate-700">
                          <li>Η επικοινωνία θα γίνεται μέσω της πλατφόρμας Influo</li>
                          <li>Οι δύο πλευρές δεσμεύονται για επαγγελματική και σεβαστική επικοινωνία</li>
                          <li>Οποιαδήποτε αλλαγή στη συμφωνία θα πρέπει να συζητηθεί και να συμφωνηθεί</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900 mb-2">5. Εμπιστευτικότητα:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1 text-slate-700">
                          <li>Και οι δύο πλευρές δεσμεύονται να διατηρήσουν εμπιστευτικότητα</li>
                          <li>Προσωπικά στοιχεία και πληροφορίες παραμένουν εμπιστευτικά</li>
                        </ul>
                      </div>

                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                        <p className="font-medium text-amber-900 mb-2">
                          ⚠️ <strong>Σημαντικό:</strong> Με την αποδοχή αυτής της συμφωνίας:
                        </p>
                        <ul className="text-amber-800 space-y-1 list-disc list-inside ml-2 text-xs">
                          <li>Συμφωνείτε με όλους τους παραπάνω όρους χρήσης</li>
                          <li>Η συνεργασία θεωρείται επίσημα ξεκίνημενη</li>
                          <li>Θα μπορείτε να αξιολογήσετε τον/την influencer μετά την ολοκλήρωση</li>
                          <li>Το brand θα προστεθεί στο portfolio του/της influencer</li>
                          <li>Η πλατφόρμα Influo λειτουργεί ως μεσάζων για την ομαλή εξέλιξη της συνεργασίας</li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="font-bold text-slate-900 mb-2">1. Company Obligations:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1 text-slate-700">
                          <li>Payment according to agreement specifications</li>
                          <li>Provision of all necessary materials and information to the influencer</li>
                          <li>Communication in reasonable time for any questions or changes</li>
                          <li>Respect for agreed deadlines</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900 mb-2">2. Payment:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1 text-slate-700">
                          <li>Payment will be made according to proposal specifications</li>
                          <li>Payment will occur after completion and approval of content</li>
                          <li>Payment terms are stated in the agreement</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900 mb-2">3. Rights:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1 text-slate-700">
                          <li>You have the right to approve/reject content before publication</li>
                          <li>You can use the content for marketing purposes</li>
                          <li>The influencer retains content rights unless otherwise agreed</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900 mb-2">4. Communication & Collaboration:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1 text-slate-700">
                          <li>Communication will be through the Influo platform</li>
                          <li>Both parties commit to professional and respectful communication</li>
                          <li>Any changes to the agreement must be discussed and agreed upon</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900 mb-2">5. Confidentiality:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1 text-slate-700">
                          <li>Both parties commit to maintaining confidentiality</li>
                          <li>Personal data and information remain confidential</li>
                        </ul>
                      </div>

                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                        <p className="font-medium text-amber-900 mb-2">
                          ⚠️ <strong>Important:</strong> By accepting this agreement:
                        </p>
                        <ul className="text-amber-800 space-y-1 list-disc list-inside ml-2 text-xs">
                          <li>You agree to all the above terms of service</li>
                          <li>The collaboration is considered officially started</li>
                          <li>You can review the influencer after completion</li>
                          <li>The brand will be added to the influencer's portfolio</li>
                          <li>The Influo platform acts as an intermediary for smooth collaboration</li>
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Acceptance Checkbox */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreementAccepted}
                    onChange={(e) => setAgreementAccepted(e.target.checked)}
                    className="mt-1 w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">
                    {lang === 'el' ? (
                      <>
                        <strong>Αποδέχομαι τους όρους χρήσης</strong> και συμφωνώ να προχωρήσω στη συνεργασία με τον/την <strong>{displayNameForLang(influencers[selectedProposal.influencer_id]?.display_name, lang) || 'influencer'}</strong> σύμφωνα με τους όρους που έχουν συμφωνηθεί.
                      </>
                    ) : (
                      <>
                        <strong>I accept the terms of service</strong> and agree to proceed with the collaboration with <strong>{displayNameForLang(influencers[selectedProposal.influencer_id]?.display_name, lang) || 'influencer'}</strong> according to the agreed terms.
                      </>
                    )}
                  </span>
                </label>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex gap-3 rounded-b-2xl">
              <button
                onClick={() => {
                  setShowAgreementModal(false);
                  setSelectedProposal(null);
                  setAgreementAccepted(false);
                }}
                className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                {lang === 'el' ? 'Ακύρωση' : 'Cancel'}
              </button>
              <button
                onClick={handleAcceptAgreement}
                disabled={!agreementAccepted || savingAgreement}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
              >
                {savingAgreement ? txt.loading : txt.accept_agreement}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

