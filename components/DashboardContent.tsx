// components/DashboardContent.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import { getVideoThumbnail, isVideoUrl } from '@/lib/videoThumbnail';
import Messaging from './Messaging';

interface Account {
  platform: string;
  username: string;
  followers: string;
}

interface InfluencerData {
    id: string;
    display_name: string;
    location: string;
    contact_email: string;
    verified: boolean;
    min_rate: string;
    bio: string;
    engagement_rate: string | null;
    avg_likes: string | null;
    accounts: Account[] | null;
    category: string | null;
    languages: string | null;
    avatar_url: string | null;
    gender: string | null;
    audience_male_percent: number | null;
    audience_female_percent: number | null;
    audience_top_age: string | null;
    videos: string[] | null;
    insights_urls: string[] | null;
}

// --- COMPREHENSIVE EDIT MODAL WITH SOCIAL ACCOUNTS ---
const EditModal = ({ user, onClose, onSave }: { user: InfluencerData, onClose: () => void, onSave: (updatedUser: InfluencerData) => void }) => {
    const [name, setName] = useState(user.display_name);
    const [bio, setBio] = useState(user.bio || "");
    const [minRate, setMinRate] = useState(user.min_rate || "");
    const [location, setLocation] = useState(user.location || "");
    const [engage, setEngage] = useState(user.engagement_rate || "");
    const [likes, setLikes] = useState(user.avg_likes || "");
    const [category, setCategory] = useState(user.category || "Lifestyle");
    const [languages, setLanguages] = useState(user.languages || "");
    const [gender, setGender] = useState(user.gender || "Female");
    const [accounts, setAccounts] = useState<Account[]>(
        user.accounts && Array.isArray(user.accounts) && user.accounts.length > 0
            ? user.accounts
            : [{ platform: "Instagram", username: "", followers: "" }]
    );
    const [malePercent, setMalePercent] = useState(user.audience_male_percent?.toString() || "");
    const [femalePercent, setFemalePercent] = useState(user.audience_female_percent?.toString() || "");
    const [topAge, setTopAge] = useState(user.audience_top_age || "");
    const [videos, setVideos] = useState<string[]>(Array.isArray(user.videos) ? user.videos : [""]);
    const [loading, setLoading] = useState(false);

    const handleAccountChange = (i: number, field: keyof Account, value: string) => {
        const copy = [...accounts];
        copy[i][field] = value;
        setAccounts(copy);
    };

    const addAccount = () => {
        setAccounts([...accounts, { platform: "Instagram", username: "", followers: "" }]);
    };

    const removeAccount = (i: number) => {
        if (accounts.length > 1) {
            const copy = [...accounts];
            copy.splice(i, 1);
            setAccounts(copy);
        }
    };

    const handleVideoChange = (i: number, value: string) => {
        const copy = [...videos];
        copy[i] = value;
        setVideos(copy);
    };
    const addVideo = () => setVideos([...videos, ""]);
    const removeVideo = (i: number) => {
        if (videos.length > 1) {
            const copy = [...videos];
            copy.splice(i, 1);
            setVideos(copy);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!confirm(
            "Οι αλλαγές στο προφίλ σου θα απαιτήσουν επαν-επαλήθευση. Το προφίλ σου θα μεταβεί σε 'Pending' status μέχρι να εγκριθεί ξανά. Θέλεις να συνεχίσεις;"
        )) {
            return;
        }

        setLoading(true);

        try {
            const { data, error } = await supabase
                .from('influencers')
                .update({ 
                    display_name: name,
                    bio: bio,
                    min_rate: minRate,
                    location: location,
                    engagement_rate: engage,
                    avg_likes: likes,
                    category: category,
                    languages: languages,
                    gender: gender,
                    accounts: accounts.filter(acc => acc.username && acc.platform),
                    videos: videos.filter(v => v !== ""),
                    audience_male_percent: malePercent ? parseInt(malePercent) : null,
                    audience_female_percent: femalePercent ? parseInt(femalePercent) : null,
                    audience_top_age: topAge || null,
                    verified: false, // Reset verification status
                })
                .eq('id', user.id)
                .select()
                .single();

            setLoading(false);

            if (error) {
                alert("Σφάλμα: " + error.message);
            } else if (data) {
                // Send email notification to admin
                try {
                    await fetch('/api/emails', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            type: 'profile_edit_admin',
                            email: user.contact_email,
                            name: data.display_name,
                            location: data.location || 'N/A'
                        })
                    });
                } catch (mailError) {
                    console.error("Email notification failed:", mailError);
                }

                onSave(data as InfluencerData);
                alert("Το προφίλ σου ενημερώθηκε! Θα ελέγξουμε τις αλλαγές και θα σε ενημερώσουμε όταν εγκριθεί ξανά.");
                onClose();
            }
        } catch (err: any) {
            setLoading(false);
            alert("Σφάλμα: " + err.message);
        }
    };

    const platforms = ["Instagram", "TikTok", "YouTube", "Facebook", "Twitter"];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto my-8">
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-900">Επεξεργασία Προφίλ</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                
                <form onSubmit={handleSave} className="p-6 space-y-6">
                    {/* Basic Info */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase">Βασικές Πληροφορίες</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-1">Ονοματεπώνυμο *</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" required />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-1">Τοποθεσία</label>
                                <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-1">Κατηγορία</label>
                                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900">
                                    <option>Lifestyle</option>
                                    <option>Fashion</option>
                                    <option>Beauty</option>
                                    <option>Food</option>
                                    <option>Travel</option>
                                    <option>Fitness</option>
                                    <option>Tech</option>
                                    <option>Business</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-1">Φύλο</label>
                                <select value={gender} onChange={e => setGender(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900">
                                    <option>Female</option>
                                    <option>Male</option>
                                    <option>Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-1">Min Rate (€)</label>
                                <input type="text" value={minRate} onChange={e => setMinRate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" placeholder="250" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-1">Engagement Rate (%)</label>
                                <input type="text" value={engage} onChange={e => setEngage(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" placeholder="5.2" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-1">Avg Likes/Views</label>
                                <input type="text" value={likes} onChange={e => setLikes(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" placeholder="3.2k" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-1">Γλώσσες</label>
                                <input type="text" value={languages} onChange={e => setLanguages(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" placeholder="Ελληνικά, Αγγλικά" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="block text-sm font-semibold text-slate-900 mb-1">Bio</label>
                            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-slate-900" />
                        </div>
                    </div>

                    {/* Social Accounts */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase">Κανάλια Social Media</h3>
                        <div className="space-y-3">
                            {accounts.map((acc, i) => (
                                <div key={i} className="flex gap-3 items-start p-3 border border-slate-200 rounded-lg">
                                    <select value={acc.platform} onChange={e => handleAccountChange(i, 'platform', e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900">
                                        {platforms.map(p => <option key={p}>{p}</option>)}
                                    </select>
                                    <input type="text" placeholder="Username" value={acc.username} onChange={e => handleAccountChange(i, 'username', e.target.value)} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900" />
                                    <input type="text" placeholder="Followers" value={acc.followers} onChange={e => handleAccountChange(i, 'followers', e.target.value)} className="w-32 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900" />
                                    {accounts.length > 1 && (
                                        <button type="button" onClick={() => removeAccount(i)} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg">✕</button>
                                    )}
                                </div>
                            ))}
                            <button type="button" onClick={addAccount} className="text-sm text-blue-600 hover:text-blue-700 font-medium">+ Προσθήκη Κανάλιου</button>
                        </div>
                    </div>

                    {/* Audience */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase">Κοινό</h3>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-1">Άνδρες (%)</label>
                                <input type="number" value={malePercent} onChange={e => setMalePercent(e.target.value)} min="0" max="100" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-1">Γυναίκες (%)</label>
                                <input type="number" value={femalePercent} onChange={e => setFemalePercent(e.target.value)} min="0" max="100" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-1">Κύρια Ηλικιακή Ομάδα</label>
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
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900" 
                                    placeholder="18-24" 
                                    maxLength={6}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Videos */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase">Video Links / Φωτογραφίες</h3>
                        <p className="text-xs text-slate-600 mb-3">Μπορείτε να προσθέσετε links από TikTok, Reels, YouTube ή φωτογραφίες από δουλειές σας.</p>
                        <div className="space-y-3">
                            {videos.map((video, i) => {
                                const thumbnail = getVideoThumbnail(video);
                                const isVideo = isVideoUrl(video);
                                return (
                                    <div key={i} className="flex gap-3 items-start">
                                        <div className="flex-1">
                                            <input 
                                                type="url" 
                                                value={video} 
                                                onChange={e => handleVideoChange(i, e.target.value)} 
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900" 
                                                placeholder="https://youtube.com/... ή https://image.com/..." 
                                            />
                                            {video && (
                                                <div className="mt-2 relative w-full h-32 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                                                    {thumbnail ? (
                                                        <>
                                                            <Image src={thumbnail} alt="Video thumbnail" fill className="object-cover" unoptimized />
                                                            {isVideo && (
                                                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                                                    <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                                                                        <span className="text-2xl">▶</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : video.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                                        <Image src={video} alt="Photo" fill className="object-cover" unoptimized />
                                                    ) : video && (
                                                        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                                                            {isVideo ? "Video link (no preview)" : "Image/Video link"}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {videos.length > 1 && (
                                            <button type="button" onClick={() => removeVideo(i)} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg mt-8">✕</button>
                                        )}
                                    </div>
                                );
                            })}
                            <button type="button" onClick={addVideo} className="text-sm text-blue-600 hover:text-blue-700 font-medium">+ Προσθήκη Video Link / Φωτογραφίας</button>
                        </div>
                    </div>

                    {/* Warning */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-sm text-yellow-800">
                            ⚠️ <strong>Σημαντικό:</strong> Μετά την αποθήκευση, το προφίλ σου θα μεταβεί σε "Pending" status και θα χρειαστεί επαν-επαλήθευση από τον admin.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors">Ακύρωση</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium disabled:opacity-50 transition-colors">
                            {loading ? 'Αποθήκευση...' : 'Αποθήκευση Αλλαγών'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- MAIN DASHBOARD CONTENT ---
interface Proposal {
  id: number;
  brand_name: string;
  brand_email: string;
  budget: string;
  service_type: string;
  status: string;
  message: string;
  created_at: string;
  influencer_agreement_accepted: boolean | null;
  brand_agreement_accepted: boolean | null;
  brand_added_to_past_brands: boolean | null;
}

export default function DashboardContent({ profile: initialProfile }: { profile: InfluencerData }) {
    const [profile, setProfile] = useState(initialProfile);
    const [showEditModal, setShowEditModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'messages' | 'proposals'>('profile');
    const [loading, setLoading] = useState(false);
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
    const [showAgreementModal, setShowAgreementModal] = useState(false);
    const [agreementAccepted, setAgreementAccepted] = useState(false);
    const [savingAgreement, setSavingAgreement] = useState(false);

    // Load proposals
    useEffect(() => {
        const loadProposals = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('proposals')
                    .select('*')
                    .eq('influencer_id', user.id)
                    .order('created_at', { ascending: false });
                
                if (data) {
                    setProposals(data as Proposal[]);
                }
            }
        };
        loadProposals();
    }, []);

    useEffect(() => {
        // Refresh profile data periodically
        const refreshProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('influencers')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                
                if (data) {
                    setProfile(data as InfluencerData);
                }
            }
        };

        refreshProfile();
    }, []);

    const handleProfileSave = (updatedUser: InfluencerData) => {
        setProfile(updatedUser);
        setShowEditModal(false);
    };

    const handleAcceptAgreement = async () => {
        if (!selectedProposal || !agreementAccepted) {
            alert('Παρακαλώ διαβάστε και αποδεχτείτε τους όρους χρήσης');
            return;
        }

        setSavingAgreement(true);
        try {
            const response = await fetch('/api/proposals/agreement', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    proposalId: selectedProposal.id,
                    userType: 'influencer',
                    accepted: true
                })
            });

            const result = await response.json();
            if (result.success) {
                // Refresh proposals
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data } = await supabase
                        .from('proposals')
                        .select('*')
                        .eq('influencer_id', user.id)
                        .order('created_at', { ascending: false });
                    
                    if (data) {
                        setProposals(data as Proposal[]);
                    }

                    // Refresh profile to get updated past_brands
                    const { data: profileData } = await supabase
                        .from('influencers')
                        .select('*')
                        .eq('id', user.id)
                        .single();
                    
                    if (profileData) {
                        setProfile(profileData as InfluencerData);
                    }
                }

                setShowAgreementModal(false);
                setSelectedProposal(null);
                setAgreementAccepted(false);
                alert('Η συμφωνία αποδεχτήθηκε! Το brand θα προστεθεί στις συνεργασίες σας όταν και το brand αποδεχτεί.');
            } else {
                throw new Error(result.error || 'Σφάλμα αποδοχής συμφωνίας');
            }
        } catch (err: any) {
            console.error('Error accepting agreement:', err);
            alert('Σφάλμα: ' + err.message);
        } finally {
            setSavingAgreement(false);
        }
    };

    return (
        <div className="min-h-screen p-6 md:p-8 bg-slate-50">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                        Καλώς ήρθες, <span className="text-slate-900">{profile.display_name}</span>!
                    </h1>
                    <p className="text-slate-600">Διαχείριση προφίλ και ρυθμίσεων</p>
                </div>
                
                <div className="bg-white rounded-lg border border-slate-200">
                    {/* Tabs */}
                    <div className="border-b border-slate-200">
                        <div className="flex">
                            <button
                                onClick={() => setActiveTab('profile')}
                                className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                                    activeTab === 'profile'
                                        ? 'border-slate-900 text-slate-900'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                Προφίλ
                            </button>
                            <button
                                onClick={() => setActiveTab('proposals')}
                                className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                                    activeTab === 'proposals'
                                        ? 'border-slate-900 text-slate-900'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                📋 Προσφορές
                            </button>
                            <button
                                onClick={() => setActiveTab('messages')}
                                className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                                    activeTab === 'messages'
                                        ? 'border-slate-900 text-slate-900'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                💬 Μηνύματα
                            </button>
                        </div>
                    </div>

                    <div className="p-6">
                        {activeTab === 'proposals' ? (
                            <div className="space-y-4">
                                <h2 className="text-xl font-semibold text-slate-900">Προσφορές από Brands</h2>
                                
                                {proposals.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500">
                                        <p>Δεν υπάρχουν προσφορές ακόμα.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {proposals.map((prop) => {
                                            const needsAgreement = (prop.status === 'accepted' || prop.status === 'completed') 
                                                && !prop.influencer_agreement_accepted;
                                            const hasAgreement = prop.influencer_agreement_accepted && prop.brand_agreement_accepted;
                                            
                                            return (
                                                <div key={prop.id} className={`border rounded-lg p-4 ${needsAgreement ? 'border-amber-400 bg-gradient-to-r from-amber-50 to-yellow-50 shadow-md' : hasAgreement ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-white'}`}>
                                                    {needsAgreement && (
                                                        <div className="mb-3 p-3 bg-amber-100 border border-amber-300 rounded-lg">
                                                            <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                                                                💡 <span>Γιατί να αποδεχτείτε τη συμφωνία;</span>
                                                            </p>
                                                            <ul className="text-xs text-amber-800 mt-2 space-y-1 ml-5 list-disc">
                                                                <li>Θα μπορείτε να λάβετε αξιολογήσεις που βελτιώνουν την αξιοπιστία σας</li>
                                                                <li>Το brand θα εμφανίζεται στις συνεργασίες σας, αυξάνοντας την προβολή</li>
                                                                <li>Περισσότερες συνεργασίες = πιο επαγγελματικό προφίλ</li>
                                                            </ul>
                                                        </div>
                                                    )}
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <h3 className="font-bold text-slate-900">{prop.brand_name}</h3>
                                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                                    prop.status === 'accepted' || prop.status === 'completed' 
                                                                        ? hasAgreement ? 'bg-green-100 text-green-700' : 'bg-green-100 text-green-700'
                                                                        : prop.status === 'rejected' 
                                                                        ? 'bg-red-100 text-red-700'
                                                                        : 'bg-blue-100 text-blue-700'
                                                                }`}>
                                                                    {prop.status === 'pending' ? 'Εκκρεμεί' : 
                                                                     prop.status === 'accepted' ? (hasAgreement ? '✅ Συμφωνία Αποδεκτή' : 'Αποδεκτή - Αναμένεται Συμφωνία') :
                                                                     prop.status === 'completed' ? (hasAgreement ? '✅ Ολοκληρωμένη' : 'Ολοκληρωμένη - Αναμένεται Συμφωνία') :
                                                                     prop.status === 'rejected' ? 'Απορρίφθηκε' : prop.status}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-slate-600 mb-2">
                                                                <strong>Υπηρεσία:</strong> {prop.service_type} • <strong>Budget:</strong> {prop.budget}€
                                                            </p>
                                                            {prop.message && (
                                                                <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg mt-2">{prop.message}</p>
                                                            )}
                                                            <p className="text-xs text-slate-500 mt-2">
                                                                {new Date(prop.created_at).toLocaleDateString('el-GR', { 
                                                                    day: 'numeric', 
                                                                    month: 'long', 
                                                                    year: 'numeric' 
                                                                })}
                                                            </p>
                                                        </div>
                                                        {needsAgreement && (
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedProposal(prop);
                                                                    setShowAgreementModal(true);
                                                                }}
                                                                className="ml-4 px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold rounded-lg transition-all text-sm whitespace-nowrap shadow-lg hover:shadow-xl transform hover:scale-105"
                                                            >
                                                                ⚠️ Αποδοχή Συμφωνίας
                                                            </button>
                                                        )}
                                                        {hasAgreement && (
                                                            <div className="ml-4 px-4 py-2 bg-green-100 text-green-700 font-medium rounded-lg text-sm whitespace-nowrap">
                                                                ✅ Συμφωνία Ολοκληρωμένη
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : activeTab === 'profile' ? (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-semibold text-slate-900">Επισκόπηση Προφίλ</h2>
                                    <button onClick={() => setShowEditModal(true)} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-colors">
                                        ✏️ Επεξεργασία Προφίλ
                                    </button>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="block text-xs text-slate-500 uppercase font-medium mb-2">Status</span>
                            <span className={`text-lg font-semibold ${profile.verified ? 'text-green-600' : 'text-yellow-600'}`}>
                                {profile.verified ? '✅ Εγκεκριμένο' : '⏳ Σε Εκκρεμότητα'}
                            </span>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="block text-xs text-slate-500 uppercase font-medium mb-2">Min Rate</span>
                            <span className="text-lg font-semibold text-slate-900">{profile.min_rate || 'N/A'}€</span>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="block text-xs text-slate-500 uppercase font-medium mb-2">Engagement</span>
                            <span className="text-lg font-semibold text-slate-900">{profile.engagement_rate || 'N/A'}</span>
                        </div>
                    </div>

                    {profile.accounts && profile.accounts.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-slate-700 mb-3">Κανάλια Social Media</h3>
                            <div className="grid md:grid-cols-2 gap-3">
                                {profile.accounts.map((acc, i) => (
                                    <div key={i} className="p-3 border border-slate-200 rounded-lg">
                                        <div className="font-medium text-slate-900">{acc.platform}</div>
                                        <div className="text-sm text-slate-600">@{acc.username}</div>
                                        <div className="text-sm text-slate-500">{acc.followers} followers</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                                )}
                                
                                <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
                                    <Link href="/logout" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-center transition-colors">
                                        Αποσύνδεση
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <Messaging
                                influencerId={profile.id}
                                influencerName={profile.display_name}
                                influencerEmail={profile.contact_email}
                                mode="influencer"
                                lang="el"
                            />
                        )}
                    </div>
                </div>
            </div>
            
            {showEditModal && (
                <EditModal 
                    user={profile}
                    onClose={() => setShowEditModal(false)}
                    onSave={handleProfileSave}
                />
            )}

            {/* Agreement Modal */}
            {showAgreementModal && selectedProposal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900">Συμφωνία Συνεργασίας</h2>
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
                        
                        <div className="p-6 space-y-6">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-sm text-blue-900 font-medium mb-2">
                                    Συνεργασία με: <strong>{selectedProposal.brand_name}</strong>
                                </p>
                                <p className="text-sm text-blue-800">
                                    Υπηρεσία: {selectedProposal.service_type} • Budget: {selectedProposal.budget}€
                                </p>
                            </div>

                            {/* Benefits Section */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5 space-y-3">
                                <h3 className="font-bold text-blue-900 text-lg flex items-center gap-2">
                                    ✨ Γιατί να αποδεχτείτε τη συμφωνία;
                                </h3>
                                <div className="grid md:grid-cols-2 gap-3">
                                    <div className="flex items-start gap-2">
                                        <span className="text-2xl">⭐</span>
                                        <div>
                                            <p className="font-semibold text-blue-900">Αξιολογήσεις & Reviews</p>
                                            <p className="text-sm text-blue-700">Θα μπορείτε να λάβετε αξιολογήσεις από το brand, που θα βελτιώσουν την αξιοπιστία σας</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-2xl">📈</span>
                                        <div>
                                            <p className="font-semibold text-blue-900">Μεγαλύτερη Προβολή</p>
                                            <p className="text-sm text-blue-700">Το brand θα εμφανίζεται στις συνεργασίες σας, αυξάνοντας την προβολή σας</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-2xl">🎯</span>
                                        <div>
                                            <p className="font-semibold text-blue-900">Επαγγελματικός Προφίλ</p>
                                            <p className="text-sm text-blue-700">Περισσότερες συνεργασίες = πιο επαγγελματικό και αξιόπιστο προφίλ</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-2xl">💼</span>
                                        <div>
                                            <p className="font-semibold text-blue-900">Περισσότερες Ευκαιρίες</p>
                                            <p className="text-sm text-blue-700">Το portfolio σας μεγάλωνει και ελκύει περισσότερα brands</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-blue-200">
                                    <p className="text-sm font-medium text-blue-900">
                                        💡 <strong>Συμβουλή:</strong> Οι influencers με πολλές αποδεκτές συνεργασίες εμφανίζονται πρώτοι στις αναζητήσεις!
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-900">Όροι Χρήσης & Συμφωνία</h3>
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-64 overflow-y-auto text-sm text-slate-700 space-y-3">
                                    <p><strong>1. Υποχρεώσεις Influencer:</strong></p>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>Παροχή υψηλής ποιότητας περιεχομένου σύμφωνα με τις προδιαγραφές</li>
                                        <li>Σεβασμός προθεσμιών και deadlines</li>
                                        <li>Επικοινωνία με το brand για οποιαδήποτε απορία</li>
                                        <li>Χρήση προϊόντων/υπηρεσιών όπως συμφωνήθηκε</li>
                                    </ul>

                                    <p><strong>2. Πληρωμή:</strong></p>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>Η πληρωμή θα γίνει σύμφωνα με τις προδιαγραφές της προσφοράς</li>
                                        <li>Ο influencer θα λάβει πληρωμή μετά την ολοκλήρωση και έγκριση του περιεχομένου</li>
                                    </ul>

                                    <p><strong>3. Δικαιώματα:</strong></p>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>Το brand έχει δικαίωμα έγκρισης/απόρριψης περιεχομένου</li>
                                        <li>Το brand μπορεί να χρησιμοποιήσει το περιεχόμενο για marketing σκοπούς</li>
                                    </ul>

                                    <p><strong>4. Confidentiality:</strong></p>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>Ο influencer δεσμεύεται να διατηρήσει εμπιστευτικότητα για προσωπικά στοιχεία του brand</li>
                                    </ul>

                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                                        <p className="text-xs font-medium text-amber-900">
                                            ⚠️ <strong>Σημαντικό:</strong> Με την αποδοχή αυτής της συμφωνίας:
                                        </p>
                                        <ul className="text-xs text-amber-800 mt-2 space-y-1 list-disc list-inside ml-2">
                                            <li>Συμφωνείτε με τους παραπάνω όρους χρήσης</li>
                                            <li>Το όνομα του brand θα προστεθεί στις συνεργασίες σας (public)</li>
                                            <li>Το brand θα μπορεί να σας αξιολογήσει μετά την ολοκλήρωση</li>
                                            <li>Η συνεργασία θα εμφανίζεται στο προφίλ σας</li>
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
                                        <strong>Αποδέχομαι τους όρους χρήσης</strong> και συμφωνώ να προστεθεί το brand <strong>{selectedProposal.brand_name}</strong> στις συνεργασίες μου
                                    </span>
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                <button
                                    onClick={() => {
                                        setShowAgreementModal(false);
                                        setSelectedProposal(null);
                                        setAgreementAccepted(false);
                                    }}
                                    className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                                >
                                    Ακύρωση
                                </button>
                                <button
                                    onClick={handleAcceptAgreement}
                                    disabled={!agreementAccepted || savingAgreement}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {savingAgreement ? 'Αποθήκευση...' : 'Αποδοχή Συμφωνίας'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
