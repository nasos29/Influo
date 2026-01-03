"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { recommendInfluencers, type InfluencerProfile, type BrandProfile } from '@/lib/recommendations';
import { dummyInfluencers } from './Directory';
import Messaging from '@/components/Messaging';

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
    recommendations_subtitle: "Βάσει του industry σας, προτείνουμε αυτούς τους influencers",
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
    recommendations_subtitle: "Based on your industry, we recommend these influencers",
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
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `brand-${brand.id}-${Date.now()}.${fileExt}`;
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
  const [lang, setLang] = useState<'el' | 'en'>('el');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [influencers, setInfluencers] = useState<Record<string, Influencer>>({});
  const [loading, setLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [savingAgreement, setSavingAgreement] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [brandData, setBrandData] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [recommendationFilters, setRecommendationFilters] = useState({
    minScore: 40,
    maxPrice: null as number | null,
    category: '',
    minEngagement: 0,
    minRating: 0,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [recommendationStats, setRecommendationStats] = useState({
    totalViewed: 0,
    profilesClicked: 0,
    proposalsSent: 0,
  });
  const [activeTab, setActiveTab] = useState<'recommendations' | 'proposals' | 'messages'>('recommendations');
  const router = useRouter();
  const txt = t[lang];

  useEffect(() => {
    loadData();
  }, []);

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
        .single();

      if (!brandData) {
        router.push('/login');
        return;
      }

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
      // Fetch all verified influencers from database
      const { data: influencersData, error } = await supabase
        .from('influencers')
        .select('id, display_name, category, engagement_rate, min_rate, location, gender, avg_rating, total_reviews, verified, accounts, avatar_url, audience_male_percent, audience_female_percent, audience_top_age, bio')
        .eq('verified', true)
        .limit(100); // Limit for performance
      
      if (error) throw error;
      
      // Helper function to parse follower string
      const parseFollowerString = (str: string) => {
        if (!str) return 0;
        const clean = str.toLowerCase().replace(/,/g, '').trim();
        if (clean.includes('k')) return parseFloat(clean) * 1000;
        if (clean.includes('m')) return parseFloat(clean) * 1000000;
        return parseFloat(clean) || 0;
      };
      
      // Convert database influencers to InfluencerProfile format
      const dbInfluencerProfiles: InfluencerProfile[] = (influencersData || []).map((inf: any) => {
        // Calculate followers_count from accounts array
        let maxFollowers = 0;
        let followersStr = '0';
        
        if (Array.isArray(inf.accounts)) {
          inf.accounts.forEach((acc: any) => {
            if (acc.followers) {
              const followersNum = parseFollowerString(acc.followers);
              if (followersNum > maxFollowers) {
                maxFollowers = followersNum;
                followersStr = acc.followers; // Keep original format
              }
            }
          });
        }
        
          return {
            id: inf.id,
            display_name: inf.display_name || 'Unknown',
            category: inf.category, // Primary category
            categories: inf.category ? [inf.category] : undefined, // For now, use single category as array
            engagement_rate: inf.engagement_rate,
          followers_count: followersStr,
          min_rate: inf.min_rate,
          location: inf.location,
          gender: inf.gender,
          avg_rating: inf.avg_rating,
          total_reviews: inf.total_reviews || 0,
          past_brands: inf.total_reviews || 0, // Use total_reviews as approximation for past_brands
          verified: inf.verified,
          accounts: inf.accounts,
          audience_male_percent: inf.audience_male_percent,
          audience_female_percent: inf.audience_female_percent,
          audience_top_age: inf.audience_top_age,
          bio: inf.bio,
          rate_card: undefined, // rate_card doesn't exist in DB, will be null
        };
      });
      
      // Category mapping from dummy data to standard categories
      const categoryMapping: { [key: string]: string } = {
        'Beauty': 'Beauty & Makeup',
        'Fitness': 'Health & Fitness',
        'Tech': 'Tech & Gadgets',
        'Travel': 'Travel',
        'Gaming': 'Gaming & Esports',
        'Business': 'Business & Finance',
        'Fashion': 'Fashion & Style',
        'Lifestyle': 'Lifestyle',
      };
      
      // Convert dummy influencers to InfluencerProfile format
      const dummyProfiles: InfluencerProfile[] = dummyInfluencers
        .filter(dummy => dummy.verified) // Only verified dummy influencers (filters out dummy-3)
        .map((dummy) => {
          // Get primary platform and followers
          const primaryPlatform = dummy.platform?.toLowerCase() || 'instagram';
          const primaryFollowers = dummy.followers?.[primaryPlatform] || 0;
          const followersStr = primaryFollowers >= 1000000 
            ? `${(primaryFollowers / 1000000).toFixed(1)}M`
            : primaryFollowers >= 1000 
            ? `${(primaryFollowers / 1000).toFixed(0)}K`
            : primaryFollowers.toString();
          
          // Build accounts array
          const accounts = Object.entries(dummy.socials || {})
            .filter(([_, username]) => username)
            .map(([platform, username]) => ({
              platform: platform.charAt(0).toUpperCase() + platform.slice(1),
              followers: dummy.followers?.[platform]?.toString() || '0'
            }));
          
          // Map category from dummy data to standard category
          // Use first category from array and map it
          const dummyCategory = dummy.categories?.[0] || 'Lifestyle';
          const mappedCategory = categoryMapping[dummyCategory] || 'Lifestyle';
          
          return {
            id: dummy.id,
            display_name: dummy.name,
            category: mappedCategory,
            engagement_rate: dummy.engagement_rate || '3.5%',
            followers_count: followersStr,
            min_rate: dummy.min_rate ? `€${dummy.min_rate}` : undefined,
            location: dummy.location,
            gender: dummy.gender,
            avg_rating: dummy.avg_rating,
            total_reviews: dummy.total_reviews || 0,
            past_brands: dummy.past_brands || 0,
            verified: dummy.verified || false,
            accounts: accounts.length > 0 ? accounts : undefined,
            avatar_url: dummy.avatar,
            bio: dummy.bio,
            rate_card: dummy.rate_card,
          };
        });
      
      // Combine database and dummy influencers
      const influencerProfiles: InfluencerProfile[] = [...dbInfluencerProfiles, ...dummyProfiles];
      
      // Always process recommendations, even if only dummy data exists
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
          const rate = parseFloat(inf.engagement_rate?.replace('%', '').replace(',', '.') || '0');
          return !isNaN(rate) && rate >= recommendationFilters.minEngagement;
        });
      }
      
      if (recommendationFilters.minRating > 0) {
        filteredProfiles = filteredProfiles.filter(inf => 
          (inf.avg_rating || 0) >= recommendationFilters.minRating
        );
      }
      
      // Calculate recommendations
      const matches = recommendInfluencers(brandProfile, filteredProfiles, {
        limit: 12,
        minScore: recommendationFilters.minScore,
        preferVerified: true,
        preferHighRating: true,
      });
      
      setRecommendations(matches);
      
      // Update stats - count only displayed recommendations (not cumulative)
      setRecommendationStats(prev => ({
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
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-900">{txt.title}</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowEditModal(true)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors border border-blue-200"
            >
              {txt.edit_profile}
            </button>
            <button
              onClick={() => setLang(lang === 'el' ? 'en' : 'el')}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
            >
              {lang === 'el' ? 'EN' : 'ΕΛ'}
            </button>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              {txt.logout}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="bg-white rounded-xl border border-slate-200 mb-6 overflow-hidden">
          <div className="border-b border-slate-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('recommendations')}
                className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                  activeTab === 'recommendations'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {lang === 'el' ? '🤖 Προτάσεις' : '🤖 Recommendations'}
              </button>
              <button
                onClick={() => setActiveTab('proposals')}
                className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                  activeTab === 'proposals'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {lang === 'el' ? '📋 Προσφορές' : '📋 Proposals'}
                {pendingAgreements.length > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {pendingAgreements.length > 99 ? '99+' : pendingAgreements.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('messages')}
                className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                  activeTab === 'messages'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {lang === 'el' ? '💬 Μηνύματα' : '💬 Messages'}
              </button>
            </div>
          </div>
        </div>

        {/* Recommendations Section */}
        {activeTab === 'recommendations' && (
        <div className="mb-12">
          {/* Smart Service Banner */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 mb-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">{txt.smart_service_title}</h3>
                <p className="text-blue-50 font-medium">{txt.smart_service_desc}</p>
              </div>
              <div className="text-4xl">🤖</div>
            </div>
          </div>

          <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{txt.recommendations_title}</h2>
              <p className="text-slate-600">{txt.recommendations_subtitle}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 bg-white border-2 border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <span>🔍</span>
                {txt.filters}
              </button>
              <button
                onClick={() => brandData && loadRecommendations(brandData)}
                disabled={recommendationsLoading}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <span className={recommendationsLoading ? 'animate-spin' : ''}>🔄</span>
                {txt.refresh}
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="bg-white rounded-xl p-6 border border-slate-200 mb-6 shadow-sm">
              <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
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

          {/* Stats */}
          {recommendationStats.totalViewed > 0 && (
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-6 mb-6 border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">{txt.stats_title}</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{recommendationStats.totalViewed}</div>
                  <div className="text-sm text-slate-600">{txt.total_viewed}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{recommendationStats.profilesClicked}</div>
                  <div className="text-sm text-slate-600">{txt.profiles_clicked}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">{recommendationStats.proposalsSent}</div>
                  <div className="text-sm text-slate-600">{txt.proposals_sent}</div>
                </div>
              </div>
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
                const avatarUrl = inf.avatar_url || (inf.accounts?.[0]?.username 
                  ? `https://unavatar.io/${inf.accounts?.[0]?.username}` 
                  : '/default-avatar.png');
                
                return (
                  <div
                    key={inf.id}
                    className="bg-white rounded-2xl border-2 border-slate-200 hover:border-blue-300 hover:shadow-xl transition-all overflow-hidden group"
                  >
                    {/* Match Score Badge */}
                    <div className="relative">
                      <div className="absolute top-3 right-3 z-10">
                        <div className={`px-3 py-1 rounded-full text-xs font-bold text-white ${
                          match.score >= 80 ? 'bg-green-500' :
                          match.score >= 65 ? 'bg-blue-500' :
                          'bg-amber-500'
                        }`}>
                          {match.score}% Match
                        </div>
                      </div>
                      
                      {/* Avatar */}
                      <div className="relative h-48 bg-gradient-to-br from-blue-100 to-purple-100">
                        <Image
                          src={avatarUrl}
                          alt={inf.display_name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        <div className="absolute bottom-3 left-3 right-3">
                          <h3 className="text-white font-bold text-lg mb-1">{inf.display_name}</h3>
                          {inf.category && (
                            <span className="inline-block px-2 py-1 bg-white/20 backdrop-blur-sm rounded text-xs text-white font-medium">
                              {lang === 'el' ? 
                                (categoryTranslations[inf.category]?.el || inf.category) : 
                                (categoryTranslations[inf.category]?.en || inf.category)
                              }
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="p-4">
                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                        {inf.followers_count && (
                          <div>
                            <div className="text-slate-500">{txt.followers}</div>
                            <div className="font-bold text-slate-900">{inf.followers_count}</div>
                          </div>
                        )}
                        {inf.engagement_rate && (
                          <div>
                            <div className="text-slate-500">{txt.engagement_rate}</div>
                            <div className="font-bold text-slate-900">{inf.engagement_rate}</div>
                          </div>
                        )}
                        {inf.avg_rating && (
                          <div>
                            <div className="text-slate-500">{txt.rating}</div>
                            <div className="font-bold text-slate-900">
                              {inf.avg_rating.toFixed(1)} ⭐
                            </div>
                          </div>
                        )}
                        {inf.total_reviews !== undefined && (
                          <div>
                            <div className="text-slate-500">{txt.reviews}</div>
                            <div className="font-bold text-slate-900">{inf.total_reviews || 0}</div>
                          </div>
                        )}
                      </div>
                      
                      {/* Match Reasons */}
                      <div className="mb-4">
                        <div className="text-xs font-semibold text-slate-700 mb-2">{txt.why_match}:</div>
                        <ul className="space-y-1">
                          {match.reasons.slice(0, 2).map((reason: string, i: number) => (
                            <li key={i} className="text-xs text-slate-600 flex items-start gap-1">
                              <span className="text-green-500 mt-0.5">✓</span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-2">
                        <Link
                          href={`/influencer/${inf.id}`}
                          onClick={() => setRecommendationStats(prev => ({...prev, profilesClicked: prev.profilesClicked + 1}))}
                          className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 font-medium rounded-lg text-sm text-center transition-colors"
                        >
                          {txt.view_profile}
                        </Link>
                        <Link
                          href={`/influencer/${inf.id}#proposal`}
                          onClick={() => setRecommendationStats(prev => ({...prev, proposalsSent: prev.proposalsSent + 1}))}
                          className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm text-center transition-colors"
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
              proposalId={null}
              mode="brand"
              lang={lang}
            />
          </div>
        )}

        {/* Pending Agreements Section */}
        {activeTab === 'proposals' && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">{txt.pending_agreements}</h2>
          
          {pendingAgreements.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
              <p className="text-slate-600">{txt.no_pending}</p>
            </div>
          ) : (
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
                          {influencer?.display_name || 'Unknown Influencer'}
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
                    <span className="text-blue-900 font-bold">{influencers[selectedProposal.influencer_id]?.display_name || 'N/A'}</span>
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
                        <strong>Αποδέχομαι τους όρους χρήσης</strong> και συμφωνώ να προχωρήσω στη συνεργασία με τον/την <strong>{influencers[selectedProposal.influencer_id]?.display_name || 'influencer'}</strong> σύμφωνα με τους όρους που έχουν συμφωνηθεί.
                      </>
                    ) : (
                      <>
                        <strong>I accept the terms of service</strong> and agree to proceed with the collaboration with <strong>{influencers[selectedProposal.influencer_id]?.display_name || 'influencer'}</strong> according to the agreed terms.
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

