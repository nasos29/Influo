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
  accounts: { platform: string; username: string; followers: string }[]; 
  avatar_url: string | null;
  
  // --- ΠΕΔΙΑ ΠΟΥ ΕΣΠΑΖΑΝ (All fields used in the component) ---
  avg_likes: string | null; 
  location: string | null;
  followers_count: string | null; 
  insights_urls: string[] | null; 
  min_rate: string | null;
  languages: string | null;
  bio: string | null;
  engagement_rate: string | null;
  audience_male_percent: number | null;
  audience_female_percent: number | null;
  audience_top_age: string | null;
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

const t = {
  el: {
    title: "Admin Dashboard",
    sub: "Επισκόπηση & Διαχείριση",
    back: "← Πίσω στο Site",
    users: "Χρήστες",
    pending: "Εκκρεμούν",
    verified: "Εγκεκριμένοι",
    reach: "Απήχηση (Reach)",
    pipeline: "Αξία Pipeline",
    tab_inf: "Λίστα Influencers",
    tab_deals: "Προτάσεις & Deals",
    col_inf: "Influencer",
    col_loc: "Τοποθεσία",
    col_status: "Status",
    col_act: "Ενέργειες",
    btn_approve: "Έγκριση",
    btn_unverify: "Ανάκληση",
    btn_delete: "Διαγραφή",
    col_date: "Ημερομηνία",
    col_brand: "Brand",
    col_srv: "Υπηρεσία",
    col_bud: "Budget",
    no_data: "Δεν υπάρχουν δεδομένα.",
    modal_basic: "Βασικές Πληροφορίες",
    modal_insights: "Αποδεικτικά Insights",
    modal_view: "Προβολή",
    modal_followers: "Followers (Δηλωμένοι)",
    modal_minrate: "Ελάχιστη Χρέωση",
    modal_gender: "Φύλο",
    modal_bio: "Bio",
    modal_socials: "Socials",
    modal_screenshots: "Screenshots"
  },
  en: {
    title: "Admin Dashboard",
    sub: "Overview & Management",
    back: "← Back to Site",
    users: "Users",
    pending: "Pending",
    verified: "Verified",
    reach: "Total Reach",
    pipeline: "Pipeline Value",
    tab_inf: "Influencers List",
    tab_deals: "Proposals & Deals",
    col_inf: "Influencer",
    col_loc: "Location",
    col_status: "Status",
    col_act: "Actions",
    btn_approve: "Approve",
    btn_unverify: "Unverify",
    btn_delete: "Delete",
    col_date: "Date",
    col_brand: "Brand",
    col_srv: "Service",
    col_bud: "Budget",
    no_data: "No data available.",
    modal_basic: "Basic Info",
    modal_insights: "Insights Proof",
    modal_view: "View",
    modal_followers: "Followers (Declared)",
    modal_minrate: "Min Rate",
    modal_gender: "Gender",
    modal_bio: "Bio",
    modal_socials: "Socials",
    modal_screenshots: "Screenshots"
  }
};

// [!!!] ΝΕΟ COMPONENT ΓΙΑ ΤΗΝ ΕΠΕΞΕΡΓΑΣΙΑ (Admin Edit)
const EditProfileModal = ({ user, onClose, onSave }: { user: DbInfluencer, onClose: () => void, onSave: (updatedUser: DbInfluencer) => void }) => {
    // Local States για όλα τα πεδία που κάνουμε edit
    const [name, setName] = useState(user.display_name);
    const [bio, setBio] = useState(user.bio || "");
    const [minRate, setMinRate] = useState(user.min_rate || "");
    const [location, setLocation] = useState(user.location || "");
    const [avgLikes, setAvgLikes] = useState(user.avg_likes || "");
    const [engage, setEngage] = useState(user.engagement_rate || "");
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
                location: location, 
                avg_likes: avgLikes, 
                engagement_rate: engage,
            })
            .eq('id', user.id)
            .select()
            .single();

        setLoading(false);

        if (error) {
            alert("Error saving: " + error.message);
        } else if (data) {
            onSave(data as DbInfluencer); // Ενημέρωσε το state του πατρικού component
            onClose(); // Κλείσιμο μετά την επιτυχία
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 overflow-y-auto max-h-[90vh] border border-slate-100">
                <h2 className="text-2xl font-bold mb-6 text-slate-900 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Edit Profile: {user.display_name}</h2>
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold mb-2 text-slate-700">Full Name</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white transition-all" required />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-2 text-slate-700">Location</label>
                            <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white transition-all" />
                        </div>
                         <div>
                            <label className="block text-sm font-semibold mb-2 text-slate-700">Min Rate (€)</label>
                            <input type="text" value={minRate} onChange={e => setMinRate(e.target.value)} className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white transition-all" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-2 text-slate-700">Engagement Rate (%)</label>
                            <input type="text" value={engage} onChange={e => setEngage(e.target.value)} className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white transition-all" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-2 text-slate-700">Avg Likes/Views</label>
                            <input type="text" value={avgLikes} onChange={e => setAvgLikes(e.target.value)} className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white transition-all" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-700">Bio</label>
                        <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white transition-all resize-none" />
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-semibold transition-all">Cancel</button>
                        <button type="submit" disabled={loading} className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-semibold disabled:opacity-50 shadow-lg shadow-blue-500/30 transition-all">
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
  const [loading, setLoading] = useState(true);
  
  // MODAL STATE
  const [selectedUser, setSelectedUser] = useState<DbInfluencer | null>(null);
  const [showEditModal, setShowEditModal] = useState(false); // ΝΕΟ: Edit Modal

  const [stats, setStats] = useState({ 
    total: 0, 
    pending: 0, 
    verified: 0, 
    reach: "0",
    pipeline: "0€" 
  });

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
      if (propData) {
          setProposals(propData as any);
          propData.forEach(p => {
              const val = parseFloat(p.budget);
              if (!isNaN(val)) pipelineSum += val;
          });
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

  useEffect(() => {
    fetchData();
  }, []);

  const toggleStatus = async (id: number, currentStatus: boolean, userEmail: string, userName: string) => {
    const { error } = await supabase.from("influencers").update({ verified: !currentStatus }).eq("id", id);
    
    if (!error) {
        fetchData();
        // Αν ΕΓΚΡΙΝΟΥΜΕ (άρα το verified γίνεται true), στέλνουμε email
        if (!currentStatus) { 
             try {
                await fetch('/api/emails', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'approved', email: userEmail, name: userName })
                });
                alert(`Ο χρήστης ${userName} εγκρίθηκε και στάλθηκε email!`);
             } catch (e) {
                 console.error(e);
                 alert("Το status άλλαξε, αλλά απέτυχε η αποστολή email.");
             }
        }
    }
    
    // Ενημέρωση του Modal αν είναι ανοιχτό
    if(selectedUser?.id === id) {
        setSelectedUser(prev => prev ? {...prev, verified: !currentStatus} : null);
    }
  };
  
  const deleteUser = async (id: number) => {
    if (confirm("Είσαι σίγουρος ότι θες να διαγράψεις αυτόν τον χρήστη;")) {
        await supabase.from("influencers").delete().eq("id", id);
        fetchData();
        setSelectedUser(null);
    }
  };

  const handleUserUpdate = (updatedUser: DbInfluencer) => {
      // Ενημέρωση του πίνακα χρηστών
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      // Κλείσιμο του modal
      setShowEditModal(false);
      setSelectedUser(updatedUser);
  };


  if (loading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50/10 to-purple-50/10 p-6 md:p-8 text-slate-900">
      
      {/* Header & Lang Toggle */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{txt.title}</h1>
           <p className="text-slate-600 mt-1">{txt.sub}</p>
        </div>
        <div className="flex gap-3">
             <button onClick={() => setLang(lang === "el" ? "en" : "el")} className="border-2 border-slate-200 px-4 py-2 rounded-lg bg-white hover:bg-slate-50 hover:border-blue-300 transition-all shadow-sm font-semibold text-sm">
                {lang === "el" ? "🇬🇧 EN" : "🇬🇷 EL"}
            </button>
            <a href="/logout" className="px-4 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-semibold transition-all shadow-sm">Logout</a>
            <a href="/" className="px-4 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold transition-all shadow-sm">{txt.back}</a>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white/90 backdrop-blur-sm p-5 rounded-xl shadow-md border border-slate-200 hover:shadow-lg transition-all">
            <p className="text-xs text-slate-500 uppercase font-semibold mb-2">{txt.users}</p>
            <p className="text-3xl font-extrabold text-slate-900">{stats.total}</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 p-5 rounded-xl shadow-md border border-yellow-200 hover:shadow-lg transition-all">
            <p className="text-xs text-yellow-700 uppercase font-semibold mb-2">{txt.pending}</p>
            <p className="text-3xl font-extrabold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-5 rounded-xl shadow-md border border-green-200 hover:shadow-lg transition-all">
            <p className="text-xs text-green-700 uppercase font-semibold mb-2">{txt.verified}</p>
            <p className="text-3xl font-extrabold text-green-600">{stats.verified}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-5 rounded-xl shadow-md border border-purple-200 hover:shadow-lg transition-all">
            <p className="text-xs text-purple-700 uppercase font-semibold mb-2">{txt.reach}</p>
            <p className="text-3xl font-extrabold text-purple-600">{stats.reach}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-xl shadow-md border-2 border-blue-300 hover:shadow-lg transition-all ring-2 ring-blue-100">
            <p className="text-xs text-blue-700 uppercase font-semibold mb-2">{txt.pipeline}</p>
            <p className="text-3xl font-extrabold text-blue-600">{stats.pipeline}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto mb-6 bg-white/50 backdrop-blur-sm rounded-xl p-2 border border-slate-200 shadow-sm">
          <div className="flex gap-2">
              <button onClick={() => setActiveTab("influencers")} className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all ${activeTab==="influencers" ? "text-blue-700 bg-blue-50 border-2 border-blue-200 shadow-sm" : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"}`}>
                  {txt.tab_inf}
              </button>
              <button onClick={() => setActiveTab("proposals")} className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all ${activeTab==="proposals" ? "text-blue-700 bg-blue-50 border-2 border-blue-200 shadow-sm" : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"}`}>
                  {txt.tab_deals} ({proposals.length})
              </button>
          </div>
      </div>

      {/* --- TAB 1: INFLUENCERS --- */}
      {activeTab === "influencers" && (
          <div className="max-w-7xl mx-auto bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 overflow-hidden">
             <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 border-b border-slate-200">
                            <tr>
                                <th className="p-4 font-semibold">{txt.col_inf}</th>
                                <th className="p-4 font-semibold">{txt.col_loc}</th>
                                <th className="p-4 font-semibold">{txt.col_status}</th>
                                <th className="p-4 text-right font-semibold">{txt.col_act}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id} className="border-b border-slate-100 hover:bg-blue-50/50 cursor-pointer transition-colors" onClick={() => setSelectedUser(u)}>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            {u.avatar_url && <div className="w-10 h-10 rounded-full bg-slate-200 relative overflow-hidden border-2 border-white shadow-sm"><Image src={u.avatar_url} fill className="object-cover" alt="." /></div>}
                                            <span className="font-bold text-slate-900">{u.display_name}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-slate-600">{u.location || "-"}</td>
                                    <td className="p-4">
                                        {u.verified ? <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">{txt.verified}</span> : <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">{txt.pending}</span>}
                                    </td>
                                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}> 
                                        <div className="flex items-center justify-end gap-2">
                                        <button 
                                            onClick={() => toggleStatus(u.id, u.verified, u.contact_email || "", u.display_name || "")} 
                                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all"
                                        >
                                            {u.verified ? txt.btn_unverify : txt.btn_approve}
                                        </button>
                                        {/* ΝΕΟ ΚΟΥΜΠΙ EDIT */}
                                        <button 
                                            onClick={() => { setSelectedUser(u); setShowEditModal(true); }} 
                                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all"
                                        >
                                            Edit
                                        </button>
                                        <button onClick={() => deleteUser(u.id)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-all">{txt.btn_delete}</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
          </div>
      )}

      {/* --- TAB 2: PROPOSALS --- */}
      {activeTab === "proposals" && (
          <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                            <tr>
                                <th className="p-3">{txt.col_brand}</th>
                                <th className="p-3">{txt.col_inf}</th>
                                <th className="p-3">{txt.col_bud}</th>
                                <th className="p-3">{txt.col_status}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {proposals.length === 0 ? <tr><td colSpan={4} className="p-4 text-center">{txt.no_data}</td></tr> : 
                            proposals.map(p => (
                                <tr key={p.id} className="border-b hover:bg-slate-50">
                                    <td className="p-3 font-bold">{p.brand_name}</td>
                                    <td className="p-3">{p.influencers?.display_name}</td>
                                    <td className="p-3 text-green-600 font-bold">{p.budget}€</td>
                                    <td className="p-3">{p.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
          </div>
      )}

      {/* RIGHT: Stats (Keep as is) */}
      <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <p className="text-xs text-slate-500 uppercase">{txt.users}</p>
              <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <p className="text-xs text-slate-500 uppercase">{txt.pending}</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <p className="text-xs text-slate-500 uppercase">{txt.verified}</p>
              <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <p className="text-xs text-slate-500 uppercase">{txt.pipeline}</p>
              <p className="text-2xl font-bold text-blue-600">{stats.pipeline}</p>
          </div>
      </div>

      {/* --- DETAIL MODAL --- */}
      {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                  
                  {/* Modal Header */}
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-slate-200 relative overflow-hidden">
                              {selectedUser.avatar_url && <Image src={selectedUser.avatar_url} fill className="object-cover" alt="Avatar" />}
                          </div>
                          <div>
                              <h2 className="text-xl font-bold text-slate-900">{selectedUser.display_name}</h2>
                              <p className="text-sm text-slate-500">{selectedUser.contact_email}</p>
                          </div>
                      </div>
                      {/* ΝΕΟ ΚΟΥΜΠΙ EDIT ΣΤΟ HEADER */}
                      <div className="flex gap-3">
                          <button onClick={() => setShowEditModal(true)} className="bg-gray-200 text-gray-700 font-bold px-3 py-1 rounded hover:bg-gray-300">Edit</button>
                          <button onClick={() => setSelectedUser(null)} className="text-2xl text-slate-400 hover:text-slate-600">×</button>
                      </div>
                  </div>

                  {/* Modal Body */}
                  <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                      
                      {/* Left: Info */}
                      <div className="space-y-6">
                          <div>
                              <h3 className="text-sm font-bold uppercase text-slate-400 mb-2">{txt.modal_basic}</h3>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div className="p-3 bg-slate-50 rounded">
                                      <span className="block text-slate-500 text-xs">Location</span>
                                      <span className="font-medium !text-slate-900">{selectedUser.location}</span> {/* FIX UI */}
                                  </div>
                                  <div className="p-3 bg-slate-50 rounded">
                                      <span className="block text-slate-500 text-xs">{txt.modal_followers}</span>
                                      <span className="font-bold text-blue-600">{selectedUser.followers_count}</span>
                                  </div>
                                  <div className="p-3 bg-slate-50 rounded">
                                      <span className="block text-slate-500 text-xs">{txt.modal_gender}</span>
                                      <span className="font-medium !text-slate-900">{selectedUser.gender}</span> {/* FIX UI */}
                                  </div>
                                  <div className="p-3 bg-slate-50 rounded">
                                      <span className="block text-slate-500 text-xs">{txt.modal_minrate}</span>
                                      <span className="font-medium !text-slate-900">{selectedUser.min_rate}€</span> {/* FIX UI */}
                                  </div>
                              </div>
                          </div>

                          <div>
                              <h3 className="text-sm font-bold uppercase text-slate-400 mb-2">{txt.modal_bio}</h3>
                              <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded leading-relaxed">{selectedUser.bio}</p>
                          </div>

                          <div>
                              <h3 className="text-sm font-bold uppercase text-slate-400 mb-2">{txt.modal_socials}</h3>
                              <div className="flex flex-wrap gap-2">
                                  {selectedUser.accounts?.map((acc, i) => (
                                      <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded border border-blue-100">
                                          {acc.platform}: {acc.username} ({acc.followers || "-"})
                                      </span>
                                  ))}
                              </div>
                          </div>
                      </div>

                      {/* Right: PROOF (Screenshots) */}
                      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                          <h3 className="text-sm font-bold uppercase text-slate-900 mb-4">📊 {txt.modal_insights} ({txt.modal_screenshots})</h3>
                          
                          {selectedUser.insights_urls && selectedUser.insights_urls.length > 0 ? (
                              <div className="grid grid-cols-2 gap-4">
                                  {selectedUser.insights_urls.map((url, i) => (
                                      <a key={i} href={url} target="_blank" className="block relative aspect-[9/16] bg-white rounded-lg overflow-hidden border border-slate-200 shadow-sm hover:ring-2 ring-blue-500 transition-all">
                                          <Image src={url} fill className="object-cover" alt="Proof" />
                                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors">
                                              <span className="bg-white/80 px-2 py-1 text-xs rounded shadow opacity-0 hover:opacity-100">{txt.modal_view}</span>
                                          </div>
                                      </a>
                                  ))}
                              </div>
                          ) : (
                              <div className="text-center py-10 text-slate-400 italic">{txt.no_data}</div>
                          )}
                      </div>

                  </div>

                  {/* Modal Footer (Actions) */}
                  <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-4">
                      <button onClick={() => deleteUser(selectedUser.id)} className="px-4 py-2 text-red-600 font-bold hover:bg-red-50 rounded">{txt.btn_delete}</button>
                      
                      {selectedUser.verified ? (
                          <button onClick={() => toggleStatus(selectedUser.id, true, selectedUser.contact_email || "", selectedUser.display_name)} className="px-6 py-2 bg-yellow-100 text-yellow-700 font-bold rounded hover:bg-yellow-200">
                              {txt.btn_unverify}
                          </button>
                      ) : (
                          <button onClick={() => toggleStatus(selectedUser.id, false, selectedUser.contact_email || "", selectedUser.display_name)} className="px-6 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700 shadow-lg">
                              ✅ {txt.btn_approve}
                          </button>
                      )}
                  </div>

              </div>
          </div>
      )}

      {/* --- EDIT MODAL (Εμφανίζεται πάνω από το Detail Modal) --- */}
      {selectedUser && showEditModal && (
          <EditProfileModal 
              user={selectedUser}
              onClose={() => setShowEditModal(false)}
              onSave={handleUserUpdate}
          />
      )}

    </div>
  );
}