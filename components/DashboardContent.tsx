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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-8 overflow-y-auto max-h-[90vh]">
                <h2 className="text-3xl font-bold mb-6 text-slate-900">Edit Your Profile</h2>
                <form onSubmit={handleSave} className="space-y-4">
                    <div className='grid md:grid-cols-2 gap-4'>
                        <div>
                            <label className="block text-sm font-bold mb-1">Name</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded text-slate-900 bg-white" required />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1">Min Rate (€)</label>
                            <input type="text" value={minRate} onChange={e => setMinRate(e.target.value)} className="w-full p-2 border rounded text-slate-900 bg-white" placeholder="e.g. 250€" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1">Engagement Rate (%)</label>
                            <input type="text" value={engage} onChange={e => setEngage(e.target.value)} className="w-full p-2 border rounded text-slate-900 bg-white" placeholder="e.g. 5.2%" />
                        </div>
                         <div>
                            <label className="block text-sm font-bold mb-1">Avg Likes/Views</label>
                            <input type="text" value={likes} onChange={e => setLikes(e.target.value)} className="w-full p-2 border rounded text-slate-900 bg-white" placeholder="e.g. 3.2k" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1">Bio</label>
                        <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} className="w-full p-2 border rounded text-slate-900 bg-white" placeholder='Tell brands about yourself...' />
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-3 bg-gray-200 rounded-lg font-bold hover:bg-gray-300">Cancel</button>
                        <button type="submit" disabled={loading} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50 hover:bg-blue-700">
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
        <div className="min-h-screen p-8 bg-slate-100">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-extrabold text-slate-900 mb-8">
                    Welcome back, {profile.display_name}!
                </h1>
                
                <div className="bg-white p-8 rounded-xl shadow-xl space-y-6">
                    <h2 className="text-2xl font-bold border-b pb-2">Your Profile Overview</h2>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        {/* STATS */}
                        <div className="p-3 bg-slate-50 rounded">
                            <span className="block text-slate-500 text-xs uppercase">Status</span>
                            <span className={`font-bold ${profile.verified ? 'text-green-600' : 'text-yellow-600'}`}>
                                {profile.verified ? '✅ VERIFIED & LIVE' : '⏳ PENDING REVIEW'}
                            </span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded">
                            <span className="block text-slate-500 text-xs uppercase">Min Rate</span>
                            <span className="font-bold">{profile.min_rate || 'N/A'}€</span>
                        </div>
                         <div className="p-3 bg-slate-50 rounded">
                            <span className="block text-slate-500 text-xs uppercase">Engagement Rate</span>
                            <span className="font-bold text-purple-600">{profile.engagement_rate || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div className="pt-4 border-t">
                        <button onClick={() => setShowEditModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold">
                            Edit Profile
                        </button>
                        <Link href="/logout" className="ml-4 text-red-500 hover:underline">
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