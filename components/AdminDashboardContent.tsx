// components/AdminDashboardContent.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient"; 
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
  avg_likes: string | null; 
  location: string | null;
  followers_count: string | null; 
  insights_urls: string[] | null; 
  min_rate: string | null;
  languages: string | null;
  bio: string | null;
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

export default function AdminDashboardContent({ adminEmail }: { adminEmail: string }) {
  const [lang, setLang] = useState<"el" | "en">("el");
  const txt = t[lang];

  const [activeTab, setActiveTab] = useState("influencers");
  const [users, setUsers] = useState<DbInfluencer[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  
  // MODAL STATE
  const [selectedUser, setSelectedUser] = useState<DbInfluencer | null>(null);

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

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-8 text-slate-900">
      
      {/* Header & Lang Toggle */}
      <div className="max-w-7xl mx-auto mb-8 flex justify-between items-center">
        <div>
           <h1 className="text-3xl font-bold">{txt.title}</h1>
           <p className="text-slate-500">{txt.sub}</p>
        </div>
        <div className="flex gap-4">
             <button onClick={() => setLang(lang === "el" ? "en" : "el")} className="border px-3 py-1 rounded bg-white">
                {lang === "el" ? "EN" : "EL"}
            </button>
            <a href="/logout" className="text-red-600 hover:underline">Logout</a> {/* Πρόσθεσα Logout */}
            <a href="/" className="text-blue-600 hover:underline">{txt.back}</a>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
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
            <p className="text-xs text-slate-500 uppercase">{txt.reach}</p>
            <p className="text-2xl font-bold text-purple-600">{stats.reach}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 ring-2 ring-blue-100">
            <p className="text-xs text-slate-500 uppercase">{txt.pipeline}</p>
            <p className="text-2xl font-bold text-blue-600">{stats.pipeline}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto mb-6 border-b border-slate-200">
          <div className="flex gap-6">
              <button onClick={() => setActiveTab("influencers")} className={`pb-3 font-bold text-sm ${activeTab==="influencers" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-800"}`}>
                  {txt.tab_inf}
              </button>
              <button onClick={() => setActiveTab("proposals")} className={`pb-3 font-bold text-sm ${activeTab==="proposals" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-800"}`}>
                  {txt.tab_deals} ({proposals.length})
              </button>
          </div>
      </div>

      {/* --- TAB 1: INFLUENCERS --- */}
      {activeTab === "influencers" && (
          <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                            <tr>
                                <th className="p-3">{txt.col_inf}</th>
                                <th className="p-3">{txt.col_loc}</th>
                                <th className="p-3">{txt.col_status}</th>
                                <th className="p-3 text-right">{txt.col_act}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedUser(u)}>
                                    <td className="p-3">
                                        <div className="flex items-center gap-2">
                                            {u.avatar_url && <div className="w-6 h-6 rounded-full bg-slate-200 relative overflow-hidden"><Image src={u.avatar_url} fill className="object-cover" alt="." /></div>}
                                            <span className="font-bold">{u.display_name}</span>
                                        </div>
                                    </td>
                                    <td className="p-3">{u.location || "-"}</td>
                                    <td className="p-3">
                                        {u.verified ? <span className="text-green-600 font-bold">{txt.verified}</span> : <span className="text-yellow-600 font-bold">{txt.pending}</span>}
                                    </td>
                                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}> 
                                        <button 
                                            onClick={() => toggleStatus(u.id, u.verified, u.contact_email || "", u.display_name || "")} 
                                            className="text-blue-600 font-bold text-xs mr-3 hover:underline"
                                        >
                                            {u.verified ? txt.btn_unverify : txt.btn_approve}
                                        </button>
                                        <button onClick={() => deleteUser(u.id)} className="text-red-600 font-bold text-xs hover:underline">{txt.btn_delete}</button>
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
                      <button onClick={() => setSelectedUser(null)} className="text-2xl text-slate-400 hover:text-slate-600">×</button>
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
                                      <span className="font-medium">{selectedUser.location}</span>
                                  </div>
                                  <div className="p-3 bg-slate-50 rounded">
                                      <span className="block text-slate-500 text-xs">{txt.modal_followers}</span>
                                      <span className="font-bold text-blue-600">{selectedUser.followers_count}</span>
                                  </div>
                                  <div className="p-3 bg-slate-50 rounded">
                                      <span className="block text-slate-500 text-xs">{txt.modal_gender}</span>
                                      <span className="font-medium">{selectedUser.gender}</span>
                                  </div>
                                  <div className="p-3 bg-slate-50 rounded">
                                      <span className="block text-slate-500 text-xs">{txt.modal_minrate}</span>
                                      <span className="font-medium">{selectedUser.min_rate}€</span>
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

    </div>
  );
}