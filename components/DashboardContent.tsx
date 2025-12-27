// components/DashboardContent.tsx
"use client";

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient'; // Client Auth
import Image from 'next/image';

interface InfluencerData {
    id: string;
    display_name: string;
    location: string;
    contact_email: string;
    verified: boolean;
    min_rate: string;
    bio: string;
    // Προσθέτουμε τα πεδία που θα κάνει edit
    engagement_rate: string | null;
    avg_likes: string | null;
}

// --- EDIT MODAL COMPONENT (Εδώ ο Influencer θα κάνει Edit) ---
const EditModal = ({ user, onClose, onSave }: { user: InfluencerData, onClose: () => void, onSave: (updatedUser: InfluencerData) => void }) => {
    const [name, setName] = useState(user.display_name);
    const [bio, setBio] = useState(user.bio || "");
    const [minRate, setMinRate] = useState(user.min_rate || "");
    const [engage, setEngage] = useState(user.engagement_rate || "");
    const [likes, setLikes] = useState(user.avg_likes || "");
    const [loading, setLoading] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { data, error } = await supabase
            .from('influencers')
            .update({ 
                display_name: name, 
                bio: bio, 
                min_rate: minRate,
                engagement_rate: engage,
                avg_likes: likes
            })
            .eq('id', user.id)
            .select()
            .single();

        setLoading(false);

        if (error) {
            alert("Error saving: " + error.message);
        } else if (data) {
            onSave(data as InfluencerData);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 overflow-y-auto max-h-[90vh] border border-slate-100">
                <h2 className="text-3xl font-bold mb-6 text-slate-900 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Edit Your Profile</h2>
                <form onSubmit={handleSave} className="space-y-4">
                    <div className='grid md:grid-cols-2 gap-4'>
                        <div>
                            <label className="block text-sm font-semibold mb-2 text-slate-700">Name</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white transition-all" required />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-2 text-slate-700">Min Rate (€)</label>
                            <input type="text" value={minRate} onChange={e => setMinRate(e.target.value)} className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white transition-all" placeholder="e.g. 250€" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-2 text-slate-700">Engagement Rate (%)</label>
                            <input type="text" value={engage} onChange={e => setEngage(e.target.value)} className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white transition-all" placeholder="e.g. 5.2%" />
                        </div>
                         <div>
                            <label className="block text-sm font-semibold mb-2 text-slate-700">Avg Likes/Views</label>
                            <input type="text" value={likes} onChange={e => setLikes(e.target.value)} className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white transition-all" placeholder="e.g. 3.2k" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-700">Bio</label>
                        <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white transition-all resize-none" placeholder='Tell brands about yourself...' />
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold text-slate-700 transition-all">Cancel</button>
                        <button type="submit" disabled={loading} className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-semibold disabled:opacity-50 shadow-lg shadow-blue-500/30 transition-all">
                            {loading ? 'Saving...' : 'Save Changes'}
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

    const handleProfileSave = (updatedUser: InfluencerData) => {
        setProfile(updatedUser);
        setShowEditModal(false);
    };

    return (
        <div className="min-h-screen p-6 md:p-8 bg-gradient-to-br from-white via-blue-50/10 to-purple-50/10">
            <div className="max-w-5xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-2">
                        Welcome back, <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{profile.display_name}</span>!
                    </h1>
                    <p className="text-slate-600">Manage your influencer profile and settings</p>
                </div>
                
                <div className="bg-white/90 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-slate-200/50 space-y-6">
                    <h2 className="text-2xl font-bold border-b border-slate-200 pb-3 text-slate-900">Your Profile Overview</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* STATS */}
                        <div className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100 shadow-sm">
                            <span className="block text-slate-600 text-xs uppercase font-semibold mb-2">Status</span>
                            <span className={`text-lg font-bold ${profile.verified ? 'text-green-700' : 'text-yellow-700'}`}>
                                {profile.verified ? '✅ VERIFIED & LIVE' : '⏳ PENDING REVIEW'}
                            </span>
                        </div>
                        <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 shadow-sm">
                            <span className="block text-slate-600 text-xs uppercase font-semibold mb-2">Min Rate</span>
                            <span className="text-lg font-bold text-blue-700">{profile.min_rate || 'N/A'}€</span>
                        </div>
                         <div className="p-5 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100 shadow-sm">
                            <span className="block text-slate-600 text-xs uppercase font-semibold mb-2">Engagement Rate</span>
                            <span className="text-lg font-bold text-purple-700">{profile.engagement_rate || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row gap-4">
                        <button onClick={() => setShowEditModal(true)} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl transition-all transform hover:-translate-y-0.5">
                            ✏️ Edit Profile
                        </button>
                        <Link href="/logout" className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-center transition-all">
                            Sign Out
                        </Link>
                    </div>
                </div>
            </div>
            
            {/* EDIT MODAL */}
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