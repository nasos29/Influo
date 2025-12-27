// components/DashboardContent.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';

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
                                <label className="block text-sm font-medium text-slate-700 mb-1">Ονοματεπώνυμο *</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Τοποθεσία</label>
                                <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Κατηγορία</label>
                                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
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
                                <label className="block text-sm font-medium text-slate-700 mb-1">Φύλο</label>
                                <select value={gender} onChange={e => setGender(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                    <option>Female</option>
                                    <option>Male</option>
                                    <option>Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Min Rate (€)</label>
                                <input type="text" value={minRate} onChange={e => setMinRate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="250" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Engagement Rate (%)</label>
                                <input type="text" value={engage} onChange={e => setEngage(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="5.2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Avg Likes/Views</label>
                                <input type="text" value={likes} onChange={e => setLikes(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="3.2k" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Γλώσσες</label>
                                <input type="text" value={languages} onChange={e => setLanguages(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Ελληνικά, Αγγλικά" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Bio</label>
                            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" />
                        </div>
                    </div>

                    {/* Social Accounts */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase">Κανάλια Social Media</h3>
                        <div className="space-y-3">
                            {accounts.map((acc, i) => (
                                <div key={i} className="flex gap-3 items-start p-3 border border-slate-200 rounded-lg">
                                    <select value={acc.platform} onChange={e => handleAccountChange(i, 'platform', e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                        {platforms.map(p => <option key={p}>{p}</option>)}
                                    </select>
                                    <input type="text" placeholder="Username" value={acc.username} onChange={e => handleAccountChange(i, 'username', e.target.value)} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                                    <input type="text" placeholder="Followers" value={acc.followers} onChange={e => handleAccountChange(i, 'followers', e.target.value)} className="w-32 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
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
                        <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase">Κοινό</h3>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Άνδρες (%)</label>
                                <input type="number" value={malePercent} onChange={e => setMalePercent(e.target.value)} min="0" max="100" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Γυναίκες (%)</label>
                                <input type="number" value={femalePercent} onChange={e => setFemalePercent(e.target.value)} min="0" max="100" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Κύρια Ηλικιακή Ομάδα</label>
                                <input type="text" value={topAge} onChange={e => setTopAge(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="18-24" />
                            </div>
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
export default function DashboardContent({ profile: initialProfile }: { profile: InfluencerData }) {
    const [profile, setProfile] = useState(initialProfile);
    const [showEditModal, setShowEditModal] = useState(false);
    const [loading, setLoading] = useState(false);

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

    return (
        <div className="min-h-screen p-6 md:p-8 bg-slate-50">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                        Καλώς ήρθες, <span className="text-slate-900">{profile.display_name}</span>!
                    </h1>
                    <p className="text-slate-600">Διαχείριση προφίλ και ρυθμίσεων</p>
                </div>
                
                <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
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
            </div>
            
            {showEditModal && (
                <EditModal 
                    user={profile}
                    onClose={() => setShowEditModal(false)}
                    onSave={handleProfileSave}
                />
            )}
        </div>
    );
}
